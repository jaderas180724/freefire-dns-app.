package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/devflow-labs/proxy-interceptor/internal/config"
	"github.com/devflow-labs/proxy-interceptor/internal/modifier"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/zap"
)

var (
	requestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "proxy_requests_total",
		Help: "Total number of proxy requests",
	}, []string{"method", "modified"})

	requestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "proxy_request_duration_seconds",
		Help:    "Duration of proxy requests",
		Buckets: prometheus.DefBuckets,
	}, []string{"method"})

	modifiedResponses = promauto.NewCounter(prometheus.CounterOpts{
		Name: "proxy_modified_responses_total",
		Help: "Total number of modified responses",
	})
)

type ProjectConfig struct {
	ProjectID      string   `json:"projectId"`
	MasterSwitch   bool     `json:"masterSwitch"`
	InjectionValue string   `json:"injectionValue"`
	TargetKeys     []string `json:"targetKeys"`
	FetchedAt      time.Time
}

type ProxyHandler struct {
	cfg         *config.Config
	logger      *zap.Logger
	httpClient  *http.Client
	configCache map[string]*ProjectConfig
	cacheMu     sync.RWMutex
}

func NewProxyHandler(cfg *config.Config, logger *zap.Logger) *ProxyHandler {
	return &ProxyHandler{
		cfg:    cfg,
		logger: logger,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost: 10,
				IdleConnTimeout:     90 * time.Second,
			},
		},
		configCache: make(map[string]*ProjectConfig),
	}
}

func (h *ProxyHandler) HandlePAC(w http.ResponseWriter, r *http.Request) {
	subdomain := h.extractSubdomain(r.Host)
	pacScript := fmt.Sprintf(`function FindProxyForURL(url, host) {
    return "PROXY %s.%s:%d; DIRECT";
}`, subdomain, h.cfg.ProxyDomain, h.cfg.ProxyPort)

	w.Header().Set("Content-Type", "application/x-ns-proxy-autoconfig")
	fmt.Fprint(w, pacScript)
}

func (h *ProxyHandler) HandleRequest(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	subdomain := h.extractSubdomain(r.Host)
	if subdomain == "" {
		http.Error(w, `{"error":"Invalid proxy subdomain"}`, http.StatusBadRequest)
		return
	}

	h.logger.Debug("Incoming request",
		zap.String("subdomain", subdomain),
		zap.String("method", r.Method),
		zap.String("url", r.URL.String()),
		zap.String("host", r.Host),
	)

	projectCfg, err := h.getProjectConfig(subdomain)
	if err != nil {
		h.logger.Error("Failed to get project config",
			zap.String("subdomain", subdomain),
			zap.Error(err),
		)
		http.Error(w, `{"error":"Project not found"}`, http.StatusNotFound)
		return
	}

	targetURL := h.buildTargetURL(r)

	proxyReq, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, r.Body)
	if err != nil {
		h.logger.Error("Failed to create proxy request", zap.Error(err))
		http.Error(w, `{"error":"Internal server error"}`, http.StatusInternalServerError)
		return
	}

	copyHeaders(proxyReq.Header, r.Header)
	proxyReq.Header.Del("Host")

	resp, err := h.httpClient.Do(proxyReq)
	if err != nil {
		h.logger.Error("Failed to forward request",
			zap.String("url", targetURL),
			zap.Error(err),
		)
		http.Error(w, `{"error":"Failed to reach upstream server"}`, http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		h.logger.Error("Failed to read response body", zap.Error(err))
		http.Error(w, `{"error":"Failed to read upstream response"}`, http.StatusBadGateway)
		return
	}

	wasModified := false

	if projectCfg.MasterSwitch && isJSONResponse(resp) && len(projectCfg.TargetKeys) > 0 {
		modifiedBody, modified := modifier.ModifyJSON(body, projectCfg.TargetKeys, projectCfg.InjectionValue)
		if modified {
			body = modifiedBody
			wasModified = true
			modifiedResponses.Inc()
			h.logger.Info("Response modified",
				zap.String("project", projectCfg.ProjectID),
				zap.Int("keys_modified", len(projectCfg.TargetKeys)),
			)
		}
	}

	copyHeaders(w.Header(), resp.Header)
	if wasModified {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", len(body)))
		w.Header().Set("X-DevFlow-Modified", "true")
	}
	w.WriteHeader(resp.StatusCode)
	w.Write(body)

	duration := time.Since(start)
	modifiedStr := "false"
	if wasModified {
		modifiedStr = "true"
	}
	requestsTotal.WithLabelValues(r.Method, modifiedStr).Inc()
	requestDuration.WithLabelValues(r.Method).Observe(duration.Seconds())

	go h.logRequest(projectCfg.ProjectID, r.Method, targetURL, resp.StatusCode, wasModified, duration)
}

func (h *ProxyHandler) extractSubdomain(host string) string {
	host = strings.Split(host, ":")[0]
	parts := strings.SplitN(host, ".", 2)
	if len(parts) >= 2 {
		return parts[0]
	}
	return host
}

func (h *ProxyHandler) buildTargetURL(r *http.Request) string {
	scheme := "https"
	if r.TLS == nil {
		scheme = "http"
	}

	originalHost := r.Header.Get("X-Original-Host")
	if originalHost == "" {
		originalHost = r.Header.Get("X-Forwarded-Host")
	}
	if originalHost == "" {
		originalHost = r.Host
	}

	return fmt.Sprintf("%s://%s%s", scheme, originalHost, r.URL.RequestURI())
}

func (h *ProxyHandler) getProjectConfig(subdomain string) (*ProjectConfig, error) {
	h.cacheMu.RLock()
	cached, exists := h.configCache[subdomain]
	h.cacheMu.RUnlock()

	if exists && time.Since(cached.FetchedAt) < time.Duration(h.cfg.CacheTTLSeconds)*time.Second {
		return cached, nil
	}

	url := fmt.Sprintf("%s/api/v1/config/proxy/%s", h.cfg.ConfigServiceURL, subdomain)
	resp, err := h.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch config: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("config service returned status %d", resp.StatusCode)
	}

	var cfg ProjectConfig
	if err := json.NewDecoder(resp.Body).Decode(&cfg); err != nil {
		return nil, fmt.Errorf("failed to decode config: %w", err)
	}
	cfg.FetchedAt = time.Now()

	h.cacheMu.Lock()
	h.configCache[subdomain] = &cfg
	h.cacheMu.Unlock()

	return &cfg, nil
}

func (h *ProxyHandler) logRequest(projectID, method, url string, statusCode int, wasModified bool, duration time.Duration) {
	logURL := fmt.Sprintf("%s/api/v1/config/proxy/log", h.cfg.ConfigServiceURL)
	payload := map[string]interface{}{
		"projectId":      projectID,
		"method":         method,
		"url":            url,
		"statusCode":     statusCode,
		"wasModified":    wasModified,
		"responseTimeMs": duration.Milliseconds(),
	}

	body, _ := json.Marshal(payload)
	resp, err := h.httpClient.Post(logURL, "application/json", bytes.NewReader(body))
	if err != nil {
		h.logger.Warn("Failed to log request", zap.Error(err))
		return
	}
	resp.Body.Close()
}

func copyHeaders(dst, src http.Header) {
	for key, values := range src {
		for _, value := range values {
			dst.Add(key, value)
		}
	}
}

func isJSONResponse(resp *http.Response) bool {
	contentType := resp.Header.Get("Content-Type")
	return strings.Contains(contentType, "application/json") ||
		strings.Contains(contentType, "text/json")
}

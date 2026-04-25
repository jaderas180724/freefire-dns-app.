package config

import (
	"os"
	"strconv"
)

type Config struct {
	ProxyPort        int
	ConfigServiceURL string
	RedisURL         string
	ProxyDomain      string
	CacheTTLSeconds  int
}

func Load() *Config {
	port, _ := strconv.Atoi(getEnv("PROXY_PORT", "8080"))
	cacheTTL, _ := strconv.Atoi(getEnv("CACHE_TTL_SECONDS", "30"))

	return &Config{
		ProxyPort:        port,
		ConfigServiceURL: getEnv("CONFIG_SERVICE_URL", "http://localhost:3001"),
		RedisURL:         getEnv("REDIS_URL", "redis://localhost:6379"),
		ProxyDomain:      getEnv("PROXY_DOMAIN", "devflowlabs.io"),
		CacheTTLSeconds:  cacheTTL,
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

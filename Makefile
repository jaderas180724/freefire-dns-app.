.PHONY: help build up down logs clean test deploy

DOCKER_COMPOSE = docker compose

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

build: ## Build all Docker images
	$(DOCKER_COMPOSE) build

up: ## Start all services
	$(DOCKER_COMPOSE) up -d

down: ## Stop all services
	$(DOCKER_COMPOSE) down

logs: ## View logs from all services
	$(DOCKER_COMPOSE) logs -f

clean: ## Remove all containers, volumes, and images
	$(DOCKER_COMPOSE) down -v --rmi all

restart: ## Restart all services
	$(DOCKER_COMPOSE) down && $(DOCKER_COMPOSE) up -d

# ─── Individual Services ───
build-frontend: ## Build frontend image
	$(DOCKER_COMPOSE) build frontend

build-config: ## Build config service image
	$(DOCKER_COMPOSE) build config-service

build-proxy: ## Build proxy interceptor image
	$(DOCKER_COMPOSE) build proxy-interceptor

# ─── Development ───
dev-frontend: ## Run frontend in dev mode
	cd frontend && npm run dev

dev-config: ## Run config service in dev mode
	cd services/config-service && npm run dev

dev-proxy: ## Run proxy interceptor in dev mode
	cd services/proxy-interceptor && go run cmd/proxy/main.go

# ─── Testing ───
test: ## Run all tests
	cd services/config-service && npm test
	cd services/proxy-interceptor && go test ./...
	cd frontend && npm test

test-config: ## Run config service tests
	cd services/config-service && npm test

test-proxy: ## Run proxy interceptor tests
	cd services/proxy-interceptor && go test ./...

test-frontend: ## Run frontend tests
	cd frontend && npm test

# ─── Kubernetes ───
k8s-apply: ## Apply all Kubernetes manifests
	kubectl apply -f infrastructure/kubernetes/base/
	kubectl apply -f infrastructure/kubernetes/monitoring/
	kubectl apply -f infrastructure/kubernetes/gateway/

k8s-delete: ## Delete all Kubernetes resources
	kubectl delete -f infrastructure/kubernetes/gateway/ || true
	kubectl delete -f infrastructure/kubernetes/monitoring/ || true
	kubectl delete -f infrastructure/kubernetes/base/ || true

# ─── Linting ───
lint: ## Run linters
	cd frontend && npm run lint
	cd services/config-service && npm run lint

# ─── Kong Setup ───
kong-setup: ## Configure Kong routes and services
	./infrastructure/kong/setup.sh

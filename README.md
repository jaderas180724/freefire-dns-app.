# DevFlow Labs

<div align="center">

![DevFlow Labs](https://img.shields.io/badge/DevFlow_Labs-Enterprise_SaaS-blue?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Go](https://img.shields.io/badge/Go-00ADD8?style=for-the-badge&logo=go&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)

**Enterprise-grade SaaS platform for real-time API response interception and A/B testing on mobile applications**

</div>

---

## Architecture Overview

DevFlow Labs uses a microservices architecture designed for high performance and scalability:

```
┌─────────────────────────────────────────────────────────────┐
│                      Kong API Gateway                       │
│                   (Routing, Auth, Rate Limiting)            │
├────────────┬──────────────────┬──────────────────────────────┤
│            │                  │                              │
│  ┌─────────▼──────┐  ┌───────▼────────┐  ┌────────────────┐│
│  │   Frontend     │  │ Config Service  │  │    Proxy       ││
│  │  (Next.js)     │  │ (Node.js/TS)   │  │  Interceptor   ││
│  │  Port: 3000    │  │  Port: 3001    │  │    (Go)        ││
│  └────────────────┘  └───────┬────────┘  │  Port: 8080    ││
│                              │           └───────┬────────┘│
│                     ┌────────▼────────┐          │         │
│                     │   PostgreSQL    │◄─────────┘         │
│                     │   Port: 5432    │                    │
│                     └─────────────────┘                    │
│                     ┌─────────────────┐                    │
│                     │     Redis       │                    │
│                     │   Port: 6379    │                    │
│                     └─────────────────┘                    │
├────────────────────────────────────────────────────────────┤
│  Monitoring: Prometheus │ Grafana │ Loki                   │
└────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Frontend** | Next.js 14, React, Tailwind CSS, Shadcn/ui, Monaco Editor | SSR Dashboard with dark theme |
| **Config Service** | Node.js, Fastify, TypeScript, PostgreSQL | User/project management, config API |
| **Proxy Interceptor** | Go, gjson/sjson | High-performance API response modification |
| **API Gateway** | Kong 3.6 | Routing, authentication, rate limiting |
| **Cache** | Redis 7 | Configuration caching, session store |
| **Database** | PostgreSQL 16 | Primary data store |
| **Monitoring** | Prometheus, Grafana 10.4 | Metrics collection & visualization |
| **Logging** | Loki 2.9 | Centralized log aggregation |
| **Orchestration** | Kubernetes (K8s), Docker Compose | Container orchestration |
| **CI/CD** | GitHub Actions | Automated build, test, deploy |

## Quick Start

### Prerequisites

- Docker & Docker Compose v2+
- Node.js 20+ (for local development)
- Go 1.22+ (for local development)

### One-Command Deploy (Local)

```bash
# Clone the repository
git clone https://github.com/your-org/devflow-labs.git
cd devflow-labs

# Start all services
make up

# Or with docker compose directly
docker compose up -d
```

### Access Points

| Service | URL |
|---------|-----|
| **Dashboard** | http://localhost:3000 |
| **API Gateway** | http://localhost:8000 |
| **Config Service** | http://localhost:3001 |
| **Proxy Interceptor** | http://localhost:8080 |
| **Kong Admin** | http://localhost:8001 |
| **Grafana** | http://localhost:3002 (admin/devflow_grafana) |
| **Prometheus** | http://localhost:9090 |

### Configure Kong Routes

```bash
make kong-setup
```

## Features

### Dashboard
- **OAuth 2.0 Authentication** — Google & GitHub OAuth + JWT-based email/password
- **Project Management** — Create and manage multiple interception projects
- **Monaco Editor** — VS Code-quality JSON editor with syntax highlighting & validation
- **Target Key Management** — Dynamic CRUD for JSON path keys per project
- **Injection History** — Track all injection values with one-click restore
- **Master Switch** — Global on/off toggle per project with visual indicators

### Proxy Interceptor
- **Subdomain-based Routing** — Each project gets a unique proxy subdomain
- **JSON Response Modification** — Real-time key replacement using gjson/sjson
- **In-Memory Caching** — Configurable TTL cache for project configurations
- **Prometheus Metrics** — Request rates, latency histograms, modification counts
- **Async Request Logging** — Non-blocking log persistence

### iOS Configuration Profiles
- **Dynamic .mobileconfig Generation** — Per-project proxy configuration
- **PAC Script Injection** — Automatic proxy routing via PAC files
- **One-Click Download** — Serve profiles directly from the backend

### Monitoring
- **Grafana Dashboards** — Pre-configured dashboards for proxy metrics
- **Prometheus Scraping** — Auto-discovery of service metrics
- **Loki Log Aggregation** — Centralized logging with Grafana integration

## Development

### Local Development (Individual Services)

```bash
# Frontend
make dev-frontend

# Config Service
make dev-config

# Proxy Interceptor
make dev-proxy
```

### Running Tests

```bash
# All tests
make test

# Individual services
make test-config
make test-proxy
make test-frontend
```

### Linting

```bash
make lint
```

## Kubernetes Deployment

### Apply All Manifests

```bash
make k8s-apply
```

### Manual Deployment

```bash
# Create namespace and base services
kubectl apply -f infrastructure/kubernetes/base/

# Deploy monitoring stack
kubectl apply -f infrastructure/kubernetes/monitoring/

# Deploy API gateway
kubectl apply -f infrastructure/kubernetes/gateway/
```

### Auto-Scaling

The Proxy Interceptor and Config Service are configured with Horizontal Pod Autoscalers:

- **Proxy Interceptor**: 3-20 replicas, scales at 60% CPU
- **Config Service**: 2-10 replicas, scales at 70% CPU / 80% memory

## CI/CD Pipeline

GitHub Actions workflows handle:

1. **CI Pipeline** (`ci.yml`)
   - Lint, build, and test all services in parallel
   - Build and push Docker images to GHCR
   - Validate Kubernetes manifests

2. **Deploy Pipeline** (`deploy.yml`)
   - Triggered on push to `main` or manual dispatch
   - Supports staging/production environments
   - Rolling updates with health verification

## API Reference

### Authentication

```
POST /api/v1/auth/register   — Create account
POST /api/v1/auth/login      — Login with email/password
POST /api/v1/auth/oauth/callback — OAuth callback
GET  /api/v1/auth/me          — Get current user
```

### Projects

```
GET    /api/v1/projects           — List projects
POST   /api/v1/projects           — Create project
GET    /api/v1/projects/:id       — Get project details
PUT    /api/v1/projects/:id       — Update project
DELETE /api/v1/projects/:id       — Delete project
POST   /api/v1/projects/:id/keys  — Add target key
PUT    /api/v1/projects/:id/keys/:keyId — Update target key
DELETE /api/v1/projects/:id/keys/:keyId — Delete target key
```

### Configuration (Internal)

```
GET  /api/v1/config/proxy/:subdomain — Get project config by subdomain
POST /api/v1/config/proxy/log        — Log proxy request
GET  /api/v1/config/logs/:projectId  — Get request logs
```

### Profiles

```
GET /api/v1/profiles/ios/:projectId      — Download .mobileconfig
GET /api/v1/profiles/proxy-info/:projectId — Get proxy info
```

## Project Structure

```
devflow-labs/
├── .github/workflows/       # CI/CD pipelines
├── frontend/                 # Next.js dashboard
│   ├── src/
│   │   ├── app/              # Next.js app router
│   │   ├── components/       # React components (Shadcn/ui)
│   │   └── lib/              # Utilities
│   ├── Dockerfile
│   └── package.json
├── services/
│   ├── config-service/       # Node.js/TypeScript API
│   │   ├── src/
│   │   │   ├── routes/       # Fastify route handlers
│   │   │   ├── middleware/   # Auth, metrics, error handling
│   │   │   ├── models/       # Database schema & migrations
│   │   │   └── utils/        # DB, Redis, logging utilities
│   │   ├── Dockerfile
│   │   └── package.json
│   └── proxy-interceptor/    # Go proxy service
│       ├── cmd/proxy/        # Entry point
│       ├── internal/
│       │   ├── handler/      # HTTP handlers
│       │   ├── config/       # Configuration
│       │   └── modifier/     # JSON modification engine
│       ├── Dockerfile
│       └── go.mod
├── infrastructure/
│   ├── kong/                 # API Gateway configuration
│   ├── kubernetes/           # K8s manifests
│   │   ├── base/             # Core services
│   │   ├── monitoring/       # Prometheus, Grafana, Loki
│   │   └── gateway/          # Kong deployment
│   └── monitoring/           # Monitoring configs
│       ├── prometheus/
│       ├── grafana/
│       └── loki/
├── docker-compose.yml        # Local development stack
├── Makefile                  # Build & deployment commands
└── README.md
```

## License

MIT License — see [LICENSE](LICENSE) for details.

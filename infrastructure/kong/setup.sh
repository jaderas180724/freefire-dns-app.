#!/bin/bash
set -euo pipefail

KONG_ADMIN_URL="${KONG_ADMIN_URL:-http://localhost:8001}"

echo "=== Configuring Kong API Gateway ==="

# Config Service
echo "Creating Config Service upstream..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d name=config-service \
  -d url=http://config-service:3001 \
  > /dev/null

curl -s -X POST "$KONG_ADMIN_URL/services/config-service/routes" \
  -d name=config-api \
  -d "paths[]=/api/v1/auth" \
  -d "paths[]=/api/v1/projects" \
  -d "paths[]=/api/v1/config" \
  -d "paths[]=/api/v1/profiles" \
  -d strip_path=false \
  > /dev/null

# Proxy Interceptor Service
echo "Creating Proxy Interceptor upstream..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d name=proxy-interceptor \
  -d url=http://proxy-interceptor:8080 \
  > /dev/null

curl -s -X POST "$KONG_ADMIN_URL/services/proxy-interceptor/routes" \
  -d name=proxy-route \
  -d "hosts[]=*.devflowlabs.io" \
  -d strip_path=false \
  > /dev/null

# Frontend
echo "Creating Frontend upstream..."
curl -s -X POST "$KONG_ADMIN_URL/services" \
  -d name=frontend \
  -d url=http://frontend:3000 \
  > /dev/null

curl -s -X POST "$KONG_ADMIN_URL/services/frontend/routes" \
  -d name=frontend-route \
  -d "paths[]=/" \
  -d strip_path=false \
  > /dev/null

# Rate Limiting Plugin
echo "Enabling rate limiting..."
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d name=rate-limiting \
  -d "config.minute=60" \
  -d "config.policy=local" \
  > /dev/null

# CORS Plugin
echo "Enabling CORS..."
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d name=cors \
  -d "config.origins[]=*" \
  -d "config.methods[]=GET" \
  -d "config.methods[]=POST" \
  -d "config.methods[]=PUT" \
  -d "config.methods[]=DELETE" \
  -d "config.methods[]=PATCH" \
  -d "config.headers[]=Content-Type" \
  -d "config.headers[]=Authorization" \
  -d "config.credentials=true" \
  > /dev/null

# Request Logging
echo "Enabling request logging..."
curl -s -X POST "$KONG_ADMIN_URL/plugins" \
  -d name=file-log \
  -d "config.path=/tmp/kong-access.log" \
  > /dev/null

echo "=== Kong configuration complete ==="

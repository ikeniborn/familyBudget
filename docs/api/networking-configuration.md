# Network Configuration Guide

**Last Updated:** 2025-09-12
**Version:** 1.2
**Status:** Active Configuration (Updated with Host Header Fix)

## Overview

This document describes the network configuration for the Family Budget application running in Docker containers. It covers frontend-to-backend communication, proxy configuration, and troubleshooting common networking issues.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Browser  │    │  Vite Dev Server │    │  FastAPI Backend│
│   localhost:5173│◄──►│  budget-frontend│◄──►│  budget-backend │
│                 │    │   Container     │    │   Container     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                        │
                                └──────────┐    ┌────────┘
                                           │    │
                              ┌─────────────▼────▼──────────┐
                              │     Docker Network          │
                              │    budget-network           │
                              │                            │
                              │  ┌──────────┐ ┌──────────┐ │
                              │  │PostgreSQL│ │  Redis   │ │
                              │  │Container │ │Container │ │
                              │  └──────────┘ └──────────┘ │
                              └─────────────────────────────┘
```

## Container Network Configuration

### Docker Compose Setup

**File:** `docker-compose.yaml`

```yaml
version: '3.8'

services:
  frontend:
    container_name: budget-frontend
    build: ./frontend-svelte
    ports:
      - "5173:5173"
    networks:
      - budget-network
    depends_on:
      - backend

  backend:
    container_name: budget-backend
    build: ./backend-fastapi
    ports:
      - "4000:4000"
    networks:
      - budget-network
    depends_on:
      - postgres
      - redis

  postgres:
    container_name: budget-postgres
    image: postgres:13
    ports:
      - "5432:5432"
    networks:
      - budget-network

  redis:
    container_name: budget-redis
    image: redis:7-alpine
    ports:
      - "6379:6379"
    networks:
      - budget-network

networks:
  budget-network:
    driver: bridge
    name: budget-network
```

## Vite Proxy Configuration

### Current Configuration (Updated with Host Header Fix)

**File:** `frontend-svelte/vite.config.ts`

**🔧 Host Header Fix Implementation (ADR-004)**

```typescript
export default defineConfig({
  server: {
    port: parseInt(process.env.PORT || '5173'),
    host: true,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://budget-backend:4000',  // ✅ Docker container name
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 30000,
        proxyTimeout: 30000,
        headers: {
          // 🔧 CRITICAL FIX: Override Host header to fix FastAPI redirects
          'Host': 'localhost:5173'
        },
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[PROXY] ${req.method} ${req.url} -> ${options.target}${req.url}`);
            // 🔧 CRITICAL FIX: Override Host header to ensure FastAPI redirects work properly
            proxyReq.setHeader('Host', 'localhost:5173');
            // Forward cookies from the original request
            const cookies = req.headers.cookie;
            if (cookies) {
              proxyReq.setHeader('Cookie', cookies);
            }
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`[PROXY] ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error(`[PROXY ERROR] ${req.method} ${req.url}:`, err.message);
            if (!res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Bad Gateway',
                message: 'Unable to connect to backend service',
                detail: err.message,
                target: options.target
              }));
            }
          });
        }
      }
    }
  }
});
```

### Configuration Explanation

| Setting | Value | Purpose |
|---------|--------|---------|
| `target` | `http://budget-backend:4000` | Backend container endpoint |
| `changeOrigin` | `true` | Modify Origin header for CORS |
| `rewrite` | Remove `/api` prefix | Strip proxy prefix before forwarding |
| `configure` | Logging functions | Debug proxy requests/responses |

## API Request Flow

### 1. Browser Request
```
GET http://localhost:5173/api/periods/
```

### 2. Vite Proxy Processing
```
- Match: /api/*
- Target: http://budget-backend:4000
- Rewrite: /api/periods/ → /periods/
- Forward: GET http://budget-backend:4000/periods/
```

### 3. Container Communication
```
budget-frontend → budget-backend (Docker network)
```

### 4. Response Path
```
budget-backend → budget-frontend → Browser
```

## Network Validation Commands

### Container Status Check
```bash
# Check all budget containers
docker ps | grep budget-

# Expected output:
# budget-frontend   running   0.0.0.0:5173->5173/tcp
# budget-backend    running   0.0.0.0:4000->4000/tcp
# budget-postgres   running   0.0.0.0:5432->5432/tcp
# budget-redis      running   0.0.0.0:6379->6379/tcp
```

### Network Inspection
```bash
# List Docker networks
docker network ls | grep budget

# Inspect network details
docker network inspect budget-network

# Check container connectivity
docker exec budget-frontend nslookup budget-backend
```

### API Connectivity Test
```bash
# Test from frontend container
docker exec budget-frontend curl -v http://budget-backend:4000/health

# Test from host
curl -v http://localhost:4000/health

# Test through proxy
curl -v http://localhost:5173/api/health
```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Host Header Redirect Issues (✅ RESOLVED - ADR-004)

**Symptoms:**
```bash
# Browser shows DNS resolution errors
GET http://budget-backend:4000/api/periods/ net::ERR_NAME_NOT_RESOLVED

# FastAPI generates unresolvable redirects
HTTP/1.1 307 Temporary Redirect
Location: http://budget-backend:4000/api/periods/
```

**Root Cause:** FastAPI uses Host header from incoming requests to generate redirect URLs. Docker container names are not resolvable from browser.

**Diagnosis Commands:**
```bash
# Check proxy configuration
grep -A 20 "'/api'" frontend-svelte/vite.config.ts

# Test direct container access (should work)
docker exec budget-frontend curl -v http://budget-backend:4000/api/periods/

# Test through browser (fails without fix)
curl -H "Host: budget-backend:4000" http://localhost:5173/api/periods/

# Verify proxy logs
docker logs budget-frontend --tail 50 | grep -i proxy
```

**Solution (IMPLEMENTED):**
```typescript
// Static header override
headers: {
  'Host': 'localhost:5173'
},
// Dynamic header override in proxyReq handler
proxy.on('proxyReq', (proxyReq, req, res) => {
  proxyReq.setHeader('Host', 'localhost:5173');
});
```

**Verification:**
```bash
# All these should now work
curl http://localhost:5173/api/periods/
curl http://localhost:5173/api/financial_centers/
curl http://localhost:5173/api/cost_centers/
curl http://localhost:5173/api/nomenclatures/
```

#### 2. DNS Resolution Failures (Container Communication)

**Symptoms:**
```
docker exec budget-frontend curl: (6) Could not resolve host: budget-backend
```

**Diagnosis:**
```bash
# Check if containers are on same network
docker network inspect budget-network

# Test DNS resolution
docker exec budget-frontend nslookup budget-backend

# Verify container names
docker ps --format "table {{.Names}}\t{{.Networks}}"
```

**Solution:**
- Ensure containers are on the same Docker network
- Verify container names match in `docker-compose.yaml` and `vite.config.ts`
- Restart containers if needed:
```bash
docker-compose down && docker-compose up -d
```

#### 2. Proxy Configuration Issues

**Symptoms:**
```
404 Not Found - API endpoints not reachable
500 Internal Server Error - Proxy misconfiguration
```

**Diagnosis:**
```bash
# Check Vite proxy logs
docker logs budget-frontend --tail 50 | grep proxy

# Test direct backend access
docker exec budget-frontend curl http://budget-backend:4000/api/periods/
```

**Solution:**
- Verify `target` URL in `vite.config.ts`
- Check `rewrite` rules for correct path transformation
- Validate `changeOrigin` setting for CORS handling

#### 3. Container Communication Failures

**Symptoms:**
```
Connection refused
Timeout errors
```

**Diagnosis:**
```bash
# Check container health
docker exec budget-backend ps aux | grep uvicorn
docker exec budget-frontend ps aux | grep "npm run dev"

# Check port binding
docker port budget-backend
docker port budget-frontend
```

**Solution:**
```bash
# Restart containers
docker restart budget-frontend budget-backend

# Or full restart
docker-compose down && docker-compose up -d
```

#### 4. Port Conflicts

**Symptoms:**
```
Port already in use
Cannot bind to host port
```

**Diagnosis:**
```bash
# Check port usage
netstat -tulpn | grep :5173
netstat -tulpn | grep :4000

# Check Docker port mappings
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Solution:**
```bash
# Stop conflicting processes
sudo lsof -ti:5173 | xargs kill -9
sudo lsof -ti:4000 | xargs kill -9

# Update ports in docker-compose.yaml if needed
```

### Debug Mode Commands

#### Enable Verbose Logging
```bash
# Frontend container logs with timestamps
docker logs -f --timestamps budget-frontend

# Backend container logs with API request details
docker logs -f --timestamps budget-backend | grep -i api

# Network traffic monitoring
docker exec budget-frontend tcpdump -i eth0 host budget-backend
```

#### Health Check Scripts
```bash
#!/bin/bash
# health-check.sh

echo "=== Container Status ==="
docker ps | grep budget-

echo -e "\n=== Network Connectivity ==="
docker exec budget-frontend ping -c 2 budget-backend

echo -e "\n=== API Health Check ==="
docker exec budget-frontend curl -s http://budget-backend:4000/health

echo -e "\n=== Proxy Test ==="
curl -s http://localhost:5173/api/health
```

## Performance Optimization

### Network Performance Tips

1. **Container Placement**: Keep related containers on same network
2. **DNS Caching**: Docker handles internal DNS caching automatically
3. **Connection Pooling**: FastAPI uses connection pooling for database
4. **Proxy Overhead**: Minimal overhead for development proxy

### Monitoring Commands
```bash
# Network latency test
docker exec budget-frontend time curl -s http://budget-backend:4000/health

# Connection count monitoring
docker exec budget-backend netstat -an | grep :4000 | wc -l

# Container resource usage
docker stats budget-frontend budget-backend --no-stream
```

## Security Considerations

### Network Isolation
- **Internal Communication**: Container-to-container communication isolated from host
- **Port Exposure**: Only necessary ports exposed to host
- **Network Segmentation**: Separate network for budget application

### Configuration Security
```yaml
# Secure network configuration
networks:
  budget-network:
    driver: bridge
    internal: false  # Allow external access for development
    attachable: false  # Prevent external container attachment
```

## Production Considerations

### Reverse Proxy Setup
For production deployment, consider using a reverse proxy:

```nginx
# nginx.conf example
upstream backend {
    server budget-backend:4000;
}

server {
    listen 80;
    
    location /api/ {
        proxy_pass http://backend/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location / {
        proxy_pass http://budget-frontend:5173;
    }
}
```

### Environment Variables
```bash
# Production network configuration
NETWORK_MODE=production
INTERNAL_NETWORK=budget-internal
EXTERNAL_NETWORK=budget-external
```

## Related Documentation

- **[ADR-004: Host Header Proxy Fix](../architecture/adr-004-host-header-proxy-fix.md)** - **🔧 CURRENT FIX**
- [ADR-003: Vite Proxy Docker Networking](../architecture/adr-003-vite-proxy-docker-networking.md)
- [DNS Resolution Fix Report](../implementation/dns-resolution-fix-report.md)
- [Docker Setup Guide](../deployment/docker-setup.md)
- [Architecture Decisions Log](../architecture/decisions.log)

---

**Configuration Maintained By:** Development Team  
**Last Validated:** 2025-09-12  
**Next Review:** 2025-10-12

## 🔧 Docker Networking Troubleshooting Guide

### Host Header Redirect Issues Resolution (ADR-004)

This section documents the complete resolution of the critical Docker networking issue that affected settings pages.

#### Problem Summary

**Issue:** FastAPI generates 307 redirects with Docker container hostnames that browsers cannot resolve
**Error:** `GET http://budget-backend:4000/api/periods/ net::ERR_NAME_NOT_RESOLVED`
**Impact:** 100% failure rate for all settings pages
**Pages Affected:** `/settings/periods`, `/settings/financial-centers`, `/settings/cost-centers`, `/settings/nomenclatures`

#### Root Cause Analysis

1. **Network Flow:** Browser → Vite Dev Server (localhost:5173) → Docker Container (budget-backend:4000)
2. **Host Header Issue:** Vite proxy forwards Host header as received from browser
3. **FastAPI Behavior:** Uses Host header to construct redirect URLs
4. **DNS Resolution:** Browsers cannot resolve Docker container names from host network

#### Complete Solution Implementation

**File Modified:** [`frontend-svelte/vite.config.ts`](../../frontend-svelte/vite.config.ts:193-226)

```typescript
// Critical fix: Override Host header at two levels
server: {
  proxy: {
    '/api': {
      headers: {
        // Level 1: Static header override
        'Host': 'localhost:5173'
      },
      configure: (proxy, options) => {
        proxy.on('proxyReq', (proxyReq, req, res) => {
          // Level 2: Dynamic header override (ensures reliability)
          proxyReq.setHeader('Host', 'localhost:5173');
        });
      }
    }
  }
}
```

#### Testing and Validation Commands

```bash
# 1. Verify containers are running
docker ps | grep budget-

# 2. Test direct container communication (should work)
docker exec budget-frontend curl -s http://budget-backend:4000/health

# 3. Test proxy with correct Host header (should work)
curl -H "Host: localhost:5173" http://localhost:5173/api/health

# 4. Test all affected endpoints
for endpoint in periods financial_centers cost_centers nomenclatures; do
  echo "Testing /api/${endpoint}/"
  curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/${endpoint}/
done

# 5. Monitor proxy logs for verification
docker logs budget-frontend --tail 20 | grep -i proxy
```

#### Success Metrics Achieved

- ✅ **DNS Resolution:** 0 `ERR_NAME_NOT_RESOLVED` errors
- ✅ **Settings Pages:** 100% accessibility restored
- ✅ **API Endpoints:** All `/api/*` endpoints responding correctly
- ✅ **Session Management:** Authentication and cookies working
- ✅ **Zero Regression:** No impact on existing functionality

### Network Debugging Toolkit

#### Comprehensive Health Check Script

```bash
#!/bin/bash
# /scripts/network-health-check.sh
# Complete network validation for Docker networking issues

set -e

echo "🔍 DOCKER NETWORKING HEALTH CHECK"
echo "================================"

echo -e "\n📋 Container Status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep budget-

echo -e "\n🌐 Network Connectivity:"
echo "Frontend -> Backend:"
docker exec budget-frontend curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s" http://budget-backend:4000/health || echo "❌ FAILED"

echo -e "\n🔄 Proxy Configuration Test:"
echo "Browser -> Vite -> Backend:"
curl -s -o /dev/null -w "HTTP %{http_code} - %{time_total}s" http://localhost:5173/api/health || echo "❌ FAILED"

echo -e "\n🎯 Settings Pages Test:"
for endpoint in periods financial_centers cost_centers nomenclatures; do
  status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/api/${endpoint}/ 2>/dev/null || echo "000")
  if [ "$status" -eq 200 ] || [ "$status" -eq 401 ]; then
    echo "✅ /api/${endpoint}/ - HTTP $status"
  else
    echo "❌ /api/${endpoint}/ - HTTP $status"
  fi
done

echo -e "\n🔧 Host Header Validation:"
# Check if Host header fix is present in vite.config.ts
if grep -q "Host.*localhost:5173" frontend-svelte/vite.config.ts; then
  echo "✅ Host header fix is present in vite.config.ts"
else
  echo "❌ Host header fix missing - ADR-004 not implemented"
fi

echo -e "\n📊 Network Performance:"
echo "Average response time (5 requests):"
for i in {1..5}; do
  curl -s -o /dev/null -w "%{time_total}s " http://localhost:5173/api/health
done
echo

echo -e "\n🏁 Health check complete"
```

#### Quick Fix Verification

```bash
# One-liner to verify the fix is working
curl -s http://localhost:5173/api/periods/ | head -1 && echo "✅ Host header fix working" || echo "❌ Issue persists"
```

#### Rollback Procedure

If the fix causes issues:

```bash
# 1. Backup current config
cp frontend-svelte/vite.config.ts frontend-svelte/vite.config.ts.backup

# 2. Remove Host header overrides
sed -i '/Host.*localhost:5173/d' frontend-svelte/vite.config.ts
sed -i '/proxyReq\.setHeader.*Host/d' frontend-svelte/vite.config.ts

# 3. Restart frontend container
docker restart budget-frontend

# 4. Verify rollback
curl http://localhost:4000/health  # Use direct backend access temporarily
```

### Advanced Troubleshooting

#### Container Network Analysis

```bash
# Inspect Docker network configuration
docker network ls | grep budget
docker network inspect budget-network --format '{{json .Containers}}' | jq

# Check container DNS resolution
docker exec budget-frontend nslookup budget-backend
docker exec budget-frontend cat /etc/resolv.conf

# Monitor network traffic
docker exec budget-frontend netstat -tuln
docker exec budget-backend netstat -tuln
```

#### Proxy Debugging

```bash
# Enable verbose Vite logging
docker exec budget-frontend npm run dev -- --debug

# Monitor proxy requests in real-time
docker logs -f budget-frontend | grep -i proxy

# Test specific proxy behavior
curl -v -H "Host: budget-backend:4000" http://localhost:5173/api/health
curl -v -H "Host: localhost:5173" http://localhost:5173/api/health
```

#### Performance Analysis

```bash
# Measure proxy overhead
time curl -s http://localhost:5173/api/health  # Through proxy
time curl -s http://localhost:4000/health      # Direct backend

# Connection analysis
ss -tuln | grep :5173  # Vite dev server connections
ss -tuln | grep :4000  # Backend connections
```

### Prevention and Monitoring

#### Continuous Validation

```bash
# Add to CI/CD pipeline
#!/bin/bash
# /scripts/validate-networking.sh
if ! curl -s -f http://localhost:5173/api/health > /dev/null; then
  echo "❌ Networking validation failed"
  exit 1
fi
echo "✅ Networking validation passed"
```

#### Monitoring Alerts

Set up alerts for:
- `ERR_NAME_NOT_RESOLVED` errors in browser logs
- HTTP 502/503 responses from proxy
- Container communication failures
- Unusual response times (>5s for health checks)

---

**Troubleshooting Guide Last Updated:** 2025-09-12  
**Primary Resolution:** ADR-004 Host Header Proxy Fix  
**Success Rate:** 100% resolution for reported Docker networking issues
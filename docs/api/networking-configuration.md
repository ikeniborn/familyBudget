# Network Configuration Guide

**Last Updated:** 2025-09-12  
**Version:** 1.1  
**Status:** Active Configuration

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

### Current Configuration

**File:** `frontend-svelte/vite.config.ts`

```typescript
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://budget-backend:4000',  // ✅ Docker container name
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        },
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

#### 1. DNS Resolution Failures

**Symptoms:**
```
GET http://budget-backend:4000/api/periods/ net::ERR_NAME_NOT_RESOLVED
```

**Diagnosis:**
```bash
# Check if containers are on same network
docker network inspect budget-network

# Test DNS resolution
docker exec budget-frontend nslookup budget-backend
```

**Solution:**
- Ensure containers are on the same Docker network
- Verify container names match in `docker-compose.yaml` and `vite.config.ts`
- Restart containers if needed

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

- [ADR-003: Vite Proxy Docker Networking](../architecture/adr-003-vite-proxy-docker-networking.md)
- [DNS Resolution Fix Report](../implementation/dns-resolution-fix-report.md)
- [Docker Setup Guide](../deployment/docker-setup.md)

---

**Configuration Maintained By:** Development Team  
**Last Validated:** 2025-09-12  
**Next Review:** 2025-10-12
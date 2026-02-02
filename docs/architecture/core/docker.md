# Docker Architecture - Multi-Stage Builds & Custom Images

**Дата создания**: 2026-01-21
**Версия**: 1.0 (Registry-First)
**Статус**: Active

## Обзор

Family Budget использует **5 кастомных Docker образов**, все собираемых через multi-stage builds в GitHub Actions CI/CD. Образы публикуются в GitHub Container Registry (ghcr.io) с semver тегами.

**Registry-First Architecture**: Все образы собираются ТОЛЬКО в CI/CD, на сервере - только pull готовых образов.

### Custom Images (v9.0)

1. **familybudget-backend** (~500 MB) - FastAPI backend с embedded frontend
2. **familybudget-bot** (~400 MB) - Telegram bot (python-telegram-bot)
3. **familybudget-nginx** (~50 MB) - Reverse proxy + TLS termination
4. **familybudget-redis** (~40 MB) - In-memory cache + pub/sub
5. **familybudget-postgresql** (~250 MB) - Database server

**Total size**: ~1.2 GB на версию

---

## 1. Backend Dockerfile - Multi-Stage with Embedded Frontend

**Location**: `backend/Dockerfile`
**Base images**: `python:3.11-slim` (builder), `node:18-alpine` (frontend), `python:3.11-slim` (runtime)
**Final size**: ~500 MB

### Architecture (3 stages)

```dockerfile
┌────────────────────────────────────────┐
│ Stage 1: python-builder                │
│ Purpose: Build Python dependencies    │
│ Size: ~300 MB (discarded)             │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│ Stage 2: frontend-builder             │
│ Purpose: Build frontend assets        │
│ Size: ~500 MB (discarded)             │
└────────────────────────────────────────┘
                  ↓
┌────────────────────────────────────────┐
│ Stage 3: runtime                       │
│ Purpose: Final production image        │
│ Size: ~500 MB (FINAL)                 │
└────────────────────────────────────────┘
```

### Stage 1: Python Dependencies Builder

```dockerfile
FROM python:3.11-slim as python-builder

ARG PYTHON_VERSION=3.11

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python packages
WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt
```

**Purpose**:
- Изолированная сборка Python dependencies
- Использует venv для портабельности
- Build tools (gcc, make) не попадают в финальный образ

**Output**: `/opt/venv` (copied to runtime stage)

---

### Stage 2: Frontend Builder

```dockerfile
FROM node:18-alpine as frontend-builder

ARG CACHE_VERSION
ENV CACHE_VERSION=${CACHE_VERSION}

WORKDIR /build

# Install Node dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY frontend/ ./frontend/
COPY scripts/ ./scripts/
COPY VERSION ./

# Build production frontend (already cache-busted in CI)
RUN npm run build:prod

# Verify build artifacts
RUN ls -lh frontend/web/static/css/ && \
    ls -lh frontend/web/static/js/dist/ && \
    echo "Frontend build complete with CACHE_VERSION=${CACHE_VERSION}"
```

**Purpose**:
- Frontend build (Vite + TypeScript → ES Modules → IIFE bundles)
- Минификация CSS/JS
- Cache versions УЖЕ обновлены в CI (через cache_busting_ci.sh)

**Output**: `frontend/` directory с built assets (copied to runtime)

**Key Point**: CACHE_VERSION передается из GitHub Actions (git short hash)

---

### Stage 3: Runtime

```dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_HOME=/app

# Install runtime dependencies (no build tools!)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy Python venv from python-builder
COPY --from=python-builder /opt/venv /opt/venv

WORKDIR $APP_HOME

# Copy backend source code
COPY --chown=appuser:appuser backend/ $APP_HOME/backend/

# CRITICAL: Copy BUILT frontend from frontend-builder (NOT source!)
COPY --from=frontend-builder --chown=appuser:appuser /build/frontend/ $APP_HOME/frontend/

# Copy Service Worker and Manifest (PWA)
COPY --from=frontend-builder --chown=appuser:appuser /build/sw.min.js $APP_HOME/sw.min.js
COPY --from=frontend-builder --chown=appuser:appuser /build/sw.min.js.gz $APP_HOME/sw.min.js.gz
COPY --from=frontend-builder --chown=appuser:appuser /build/manifest.json $APP_HOME/manifest.json

# Create directories
RUN mkdir -p $APP_HOME/logs $APP_HOME/uploads $APP_HOME/uploads/temp && \
    chown -R appuser:appuser $APP_HOME/logs $APP_HOME/uploads

USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production command (single worker)
CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
```

**Purpose**:
- Минимальный runtime-only образ
- Embedded frontend (no bind mounts needed)
- Non-root user (security)
- Health check для docker compose

**Security features**:
- ✅ Non-root user (appuser)
- ✅ Read-only frontend (immutable)
- ✅ No build tools в runtime
- ✅ Minimal attack surface

**Frontend serving**:
- Backend serves `/static/` через FastAPI StaticFiles
- Frontend в `/app/frontend/web/static/`
- Nginx proxies ALL requests to backend

---

## 2. Bot Dockerfile

**Location**: `bot/Dockerfile`
**Base image**: `python:3.11-slim`
**Final size**: ~400 MB

### Multi-Stage Build

```dockerfile
# Stage 1: Builder
FROM python:3.11-slim as builder

ARG PYTHON_VERSION=3.11

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies
WORKDIR /build
COPY bot/requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_HOME=/app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv

# Create non-root user
RUN groupadd -r botuser && useradd -r -g botuser botuser

WORKDIR $APP_HOME

# Copy bot source
COPY --chown=botuser:botuser bot/ $APP_HOME/bot/

# Create logs directory
RUN mkdir -p $APP_HOME/logs && \
    chown -R botuser:botuser $APP_HOME/logs

USER botuser

# Health check (check if bot process is running)
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "python.*bot.main" || exit 1

# Start bot
CMD ["python", "-m", "bot.main"]
```

**Key features**:
- ✅ Separate user (botuser)
- ✅ Health check via pgrep
- ✅ Minimal runtime dependencies
- ✅ No shared code with backend (isolated)

---

## 3. Nginx Dockerfile

**Location**: `nginx/Dockerfile`
**Base image**: `nginx:alpine`
**Final size**: ~50 MB

### Simple Configuration

```dockerfile
FROM nginx:alpine

# Copy nginx configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/ /etc/nginx/conf.d/

# Create directories
RUN mkdir -p /var/log/nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx

# Health check (nginx config test)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD nginx -t || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

**Purpose**:
- Reverse proxy для backend
- TLS termination (Let's Encrypt certificates)
- WebSocket proxying
- HTTP/2 support

**IMPORTANT**: НЕ отдает /static/ файлы (backend handles это)

**Nginx config highlights**:
```nginx
# nginx/conf.d/app-https.conf.template
location / {
    proxy_pass http://backend:8000;  # ВСЕ запросы → backend
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

location /api/v1/budget/ws {
    proxy_pass http://backend:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_header_upgrade;
    proxy_set_header Connection $connection_upgrade;
}
```

---

## 4. Redis Dockerfile

**Location**: `redis/Dockerfile`
**Base image**: `redis:7-alpine`
**Final size**: ~40 MB

### Minimal Customization

```dockerfile
FROM redis:7-alpine

# Create data directory
RUN mkdir -p /data && chown -R redis:redis /data

EXPOSE 6379

# Health check (redis ping)
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
    CMD redis-cli ping || exit 1

# Command passed via docker-compose (allows runtime config)
CMD ["redis-server"]
```

**Purpose**:
- In-memory caching
- Redis Pub/Sub для WebSocket broadcasting
- Session storage

**Runtime configuration** (via docker-compose):
```yaml
redis:
  image: ghcr.io/<owner>/familybudget-redis:6.6.0
  command: >
    redis-server
    --maxmemory 512mb
    --maxmemory-policy allkeys-lru
    --save 900 1
    --appendonly yes
    --requirepass "${REDIS_PASSWORD}"
```

**Key features**:
- ✅ AOF persistence (appendonly yes)
- ✅ Password protection
- ✅ Maxmemory limits
- ✅ Health check included

---

## 5. PostgreSQL Dockerfile

**Location**: `postgres/Dockerfile`
**Base image**: `postgres:16-alpine`
**Final size**: ~250 MB

### Database Server

```dockerfile
FROM postgres:16-alpine

# Create backups directory
RUN mkdir -p /backups && chown -R postgres:postgres /backups

EXPOSE 5432

# Health check (pg_isready)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER:-familybudget} || exit 1
```

**Purpose**:
- Primary data store
- SCD Type 1 + History tables
- Closure Table для article hierarchy
- Full-text search

**Runtime configuration** (via docker-compose):
```yaml
postgres:
  image: ghcr.io/<owner>/familybudget-postgresql:6.6.0
  environment:
    POSTGRES_DB: familybudget
    POSTGRES_USER: familybudget
    POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data  # Persistent storage
```

**Extensions used**:
- `pg_stat_statements` - Query performance monitoring
- Built-in full-text search

---

## .dockerignore - Build Context Optimization

**Location**: `.dockerignore`
**Purpose**: Reduce Docker build context size by 30-50%

### Complete .dockerignore

```
# Git
.git
.gitignore
.github

# CI/CD
.gitlab-ci.yml
.travis.yml

# Documentation
docs/
*.md
README*
CHANGELOG*
LICENSE

# Tests
tests/
.pytest_cache/
.coverage
htmlcov/
*.test
*.spec

# Python cache
__pycache__/
*.py[cod]
*$py.class
.python-version
.mypy_cache/
.ruff_cache/

# Node modules
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm/

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Environment
.env
.env.local
.env.*

# Logs
logs/
*.log

# Temp files
tmp/
temp/
*.tmp

# OS
.DS_Store
Thumbs.db

# Deployment (не нужны в образе)
deploy.sh
setup.sh
scripts/lib/
archive/

# Docker
docker-compose*.yml
Dockerfile*
.dockerignore

# Backups
backups/
*.sql
*.dump
```

**Impact**:
- **Before**: ~500 MB build context
- **After**: ~250 MB build context
- **Improvement**: 50% reduction

**Benefits**:
- ✅ Faster uploads to Docker daemon
- ✅ Faster CI/CD builds
- ✅ Smaller cache footprint
- ✅ Better security (no .env, .git in images)

---

## Build Optimization Strategies

### 1. Layer Caching

**Principle**: Order Dockerfile commands from least to most frequently changing

**Example** (backend Dockerfile):
```dockerfile
# 1. Base image (rarely changes)
FROM python:3.11-slim as builder

# 2. System dependencies (rarely changes)
RUN apt-get update && apt-get install -y build-essential

# 3. Python dependencies (changes occasionally)
COPY backend/requirements.txt .
RUN pip install -r requirements.txt

# 4. Application code (changes frequently)
COPY backend/ /app/backend/
```

**Result**: Code changes don't invalidate dependency cache

---

### 2. Multi-Stage Builds

**Principle**: Build artifacts в отдельных stages, copy только финальные файлы

**Example** (backend):
```dockerfile
# Builder stage (300 MB, discarded)
FROM python:3.11-slim as builder
RUN pip install -r requirements.txt

# Runtime stage (500 MB, FINAL)
FROM python:3.11-slim
COPY --from=builder /opt/venv /opt/venv  # Only venv, not build tools
```

**Benefits**:
- ✅ Smaller final images (no build tools)
- ✅ Faster deployments (less to pull)
- ✅ Better security (minimal attack surface)

---

### 3. GitHub Actions Cache

**Configuration** (`.github/workflows/build-and-push.yml`):
```yaml
- name: Build and push backend
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

**Result**:
- First build: 5-8 min
- Subsequent builds (code change only): 30-60 seconds

---

### 4. Selective Image Rebuilding

**Mechanism**: `IMAGE_VERSIONS.json` tracks git hash для каждого образа

**Example**:
```json
{
  "backend": {
    "version": "6.6.0",
    "hash": "abc1234",
    "paths": ["backend/", "frontend/", "package.json"]
  },
  "nginx": {
    "version": "1.0.0",
    "hash": "def5678",
    "paths": ["nginx/"]
  }
}
```

**Logic**:
```bash
# scripts/ci/check_image_changes.sh
current_hash=$(git log -1 --pretty=format:%h -- backend/ frontend/)
saved_hash=$(jq -r '.backend.hash' IMAGE_VERSIONS.json)

if [[ "$current_hash" == "$saved_hash" ]]; then
    echo "skip"  # No changes, skip build
else
    echo "build"  # Changes detected, rebuild
fi
```

**Benefits**:
- ✅ Skip unchanged images (saves 2-4 min)
- ✅ Only rebuild what changed
- ✅ Faster CI/CD overall

---

## Image Sizes Breakdown

### Production Images (v9.0)

| Image | Base | Final Size | Layers | Optimization |
|-------|------|------------|--------|--------------|
| **backend** | python:3.11-slim | ~500 MB | 15 | Multi-stage + embedded frontend |
| **bot** | python:3.11-slim | ~400 MB | 12 | Multi-stage |
| **nginx** | nginx:alpine | ~50 MB | 8 | Alpine base |
| **redis** | redis:7-alpine | ~40 MB | 6 | Alpine base |
| **postgresql** | postgres:16-alpine | ~250 MB | 10 | Alpine base |
| **TOTAL** | - | **~1.2 GB** | - | - |

### Size Comparison

**Backend image breakdown**:
- Base image (python:3.11-slim): 150 MB
- Python packages (from venv): 200 MB
- Frontend assets (built): 50 MB
- Application code: 30 MB
- Service Worker + Manifest: 5 MB
- Runtime deps (libpq5, curl): 15 MB
- Misc layers: 50 MB
- **Total**: ~500 MB

**Optimization potential**:
- ❌ Can't reduce base image (python:3.11-alpine has issues with binary packages)
- ✅ Could optimize frontend assets (tree shaking, code splitting)
- ✅ Could use distroless for slight reduction (~20-30 MB)

---

## Docker Compose Integration

### Registry-Only Mode (v9.0)

**File**: `docker-compose.yml`

```yaml
services:
  postgres:
    image: ghcr.io/ikeniborn/familybudget-postgresql:${VERSION:-6.6.0}
    container_name: familybudget-postgres
    # NO build: section (registry-only!)
    volumes:
      - postgres_data:/var/lib/postgresql/data  # Data persistence

  redis:
    image: ghcr.io/ikeniborn/familybudget-redis:${VERSION:-6.6.0}
    container_name: familybudget-redis
    volumes:
      - redis_data:/data  # AOF persistence

  backend:
    image: ghcr.io/ikeniborn/familybudget-backend:${VERSION:-6.6.0}
    container_name: familybudget-backend
    # NO build: section
    # NO bind mounts for code (embedded!)
    volumes:
      - ./logs:/app/logs          # Logs only
      - ./uploads:/app/uploads    # Uploads only

  nginx:
    image: ghcr.io/ikeniborn/familybudget-nginx:${VERSION:-6.6.0}
    container_name: familybudget-nginx
    volumes:
      - nginx_cache:/var/cache/nginx
      - ./logs/nginx:/var/log/nginx
      - /etc/letsencrypt:/etc/letsencrypt:ro  # SSL certificates

  bot:
    image: ghcr.io/ikeniborn/familybudget-bot:${VERSION:-6.6.0}
    container_name: familybudget-bot
    volumes:
      - ./logs:/app/logs
```

**Key points**:
- ✅ No `build:` sections (registry-only)
- ✅ No bind mounts для code (embedded)
- ✅ Only data volumes (postgres_data, redis_data, uploads)
- ✅ VERSION variable determines tag

---

### Критическое изменение v9.0

**Docker Compose НЕ собирает образы на сервере**

**docker-compose.yml** (v9.0):
```yaml
services:
  backend:
    image: ghcr.io/ikeniborn/familybudget-backend:${BACKEND_VERSION:-latest}
    # НЕТ секции build: - образы только из registry

  bot:
    image: ghcr.io/ikeniborn/familybudget-bot:${BOT_VERSION:-latest}
    # НЕТ секции build:

  nginx:
    image: ghcr.io/ikeniborn/familybudget-nginx:${NGINX_VERSION:-latest}
    # НЕТ секции build:
```

**Откуда берутся образы:**

**1. CI/CD сборка** (GitHub Actions):
- Multi-stage Dockerfile для каждого сервиса
- Frontend embedded в backend образ
- Push в ghcr.io с семантическими версиями

**2. Server pull** (deploy.sh):
- Чтение IMAGE_VERSIONS.json
- `docker pull ghcr.io/ikeniborn/familybudget-*:VERSION`
- `docker compose up -d` (без --build!)

---

### Multi-Stage Builds (в CI/CD)

**backend/Dockerfile** (пример):
```dockerfile
# Stage 1: python-builder (~300 MB, отбрасывается)
FROM python:3.11-slim as python-builder
WORKDIR /opt/venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: frontend-builder (~500 MB, отбрасывается)
FROM node:18-alpine as frontend-builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY frontend/ ./frontend/
RUN npm run build:prod

# Stage 3: runtime (~500 MB, FINAL IMAGE)
FROM python:3.11-slim
COPY --from=python-builder /opt/venv /opt/venv
COPY --from=frontend-builder /build/frontend/web/static /app/frontend/web/static
COPY backend/ /app/backend/
```

**Результат**:
- Финальный образ: ~500 MB (только runtime dependencies)
- Отброшено: ~800 MB (build tools, npm, компиляторы)
- На сервер приходит ТОЛЬКО финальный образ

---

### Что НЕ требуется на сервере

**Dependencies:**
- ❌ Node.js
- ❌ npm
- ❌ Python build tools (gcc, make)
- ❌ Build essentials
- ❌ Любые компиляторы

**Requirements:**
- ✅ Только Docker + Docker Compose
- ✅ ghcr.io access (GitHub Container Registry)

---

### Development Mode (docker-compose.dev.yml)

**File**: `docker-compose.dev.yml` (override)

```yaml
services:
  backend:
    # Override: use local code (для live reload)
    volumes:
      - ./backend:/app/backend:ro
      - ./frontend:/app/frontend:ro
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    environment:
      DEBUG: "true"
      LOG_LEVEL: debug
      RELOAD: "true"
    command: >
      uvicorn backend.app.main:app
      --host 0.0.0.0
      --port 8000
      --reload
      --reload-dir /app/backend
      --reload-dir /app/frontend

  nginx:
    # Override: use local config
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro

  redis:
    # Override: disable persistence (faster restarts)
    command: >
      redis-server
      --save ""
      --appendonly no
      --requirepass "${REDIS_PASSWORD}"
```

**Usage**:
```bash
# Development с live reload
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production (registry images)
docker compose up
```

---

## Health Checks

### All Images Include Health Checks

**Backend**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
```

**Bot**:
```dockerfile
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
    CMD pgrep -f "python.*bot.main" || exit 1
```

**Nginx**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD nginx -t || exit 1
```

**Redis**:
```dockerfile
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
    CMD redis-cli ping || exit 1
```

**PostgreSQL**:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U familybudget || exit 1
```

**Benefits**:
- ✅ Docker knows container health
- ✅ docker compose waits for healthy before starting dependents
- ✅ Automatic restart on unhealthy

---

## Troubleshooting

### Issue 1: Frontend не в backend образе

**Symptom**: 404 on /static/ requests

**Проверка**:
```bash
docker exec familybudget-backend ls -lh /app/frontend/web/static/css/
```

**Причина**: Multi-stage COPY failed

**Решение**: Rebuild образа
```bash
# Локально (НЕ рекомендуется)
docker build -f backend/Dockerfile -t test-backend .

# Правильно: через CI/CD
git push origin test
```

---

### Issue 2: Large image size

**Symptom**: Backend image >700 MB (should be ~500 MB)

**Причина**: node_modules в образе (не excluded by .dockerignore)

**Решение**:
```bash
# Проверка .dockerignore
cat .dockerignore | grep node_modules  # Должно быть

# Rebuild с .dockerignore
docker build --no-cache -f backend/Dockerfile .
```

---

### Issue 3: Slow builds в CI

**Symptom**: Builds take 5-8 min (should be 2-4 min)

**Причина**: Cache miss

**Решение**: Normal after cache invalidation
- First build: 5-8 min (rebuilds cache)
- Next builds: 2-4 min (uses cache)

**Check cache**:
```yaml
# .github/workflows/build-and-push.yml
cache-from: type=gha  # Must be present
cache-to: type=gha,mode=max
```

---

### Issue 4: Health check fails

**Symptom**: Container unhealthy, constantly restarting

**Backend**:
```bash
# Check logs
docker logs familybudget-backend

# Manual health check
docker exec familybudget-backend curl http://localhost:8000/health
```

**PostgreSQL**:
```bash
# Check if ready
docker exec familybudget-postgres pg_isready -U familybudget

# Check logs
docker logs familybudget-postgres
```

---

### Issue 5: Permission denied в containers

**Symptom**: `PermissionError: [Errno 13] Permission denied: '/app/logs'`

**Причина**: Non-root user can't write to mounted volumes

**Решение**:
```bash
# На сервере: fix ownership
sudo chown -R 999:999 /opt/budget/logs /opt/budget/uploads

# 999:999 = appuser UID:GID в container
```

---

## Security Best Practices

### 1. Non-Root Users

**All images run as non-root**:
- backend: `appuser` (UID 999)
- bot: `botuser` (UID 999)
- nginx: `nginx` (built-in)
- redis: `redis` (built-in)
- postgresql: `postgres` (built-in)

**Benefit**: Limited blast radius if container compromised

---

### 2. Read-Only Filesystems

**Example** (docker-compose.yml):
```yaml
backend:
  image: ghcr.io/<owner>/familybudget-backend:6.6.0
  read_only: true  # Filesystem immutable
  tmpfs:
    - /tmp  # Writable tmp only
  volumes:
    - ./logs:/app/logs  # Writable logs
    - ./uploads:/app/uploads  # Writable uploads
```

**Status**: Planned (not yet implemented)

---

### 3. No Secrets in Images

**Rule**: НИКОГДА не COPY secrets в Dockerfile

**Correct** (via environment variables):
```dockerfile
# Dockerfile
ENV DATABASE_PASSWORD=${DATABASE_PASSWORD}
```

```yaml
# docker-compose.yml
environment:
  DATABASE_PASSWORD: ${DATABASE_PASSWORD}
```

```bash
# .env (gitignored)
DATABASE_PASSWORD=secret123
```

---

### 4. Minimal Attack Surface

**Strategy**: Only install necessary packages

**Example**:
```dockerfile
# ❌ BAD: Installing unnecessary tools
RUN apt-get install -y vim git wget curl netcat

# ✅ GOOD: Only runtime deps
RUN apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*
```

---

## Related Documentation

- **CI/CD Build Pipeline**: [ci-cd-build-deploy.md](../operations/ci-cd-build-deploy.md)
- **CI/CD Summary**: [CI-CD-REGISTRY-SUMMARY.md](../../CI-CD-REGISTRY-SUMMARY.md)
- **Deploy Test Skill**: [.claude/skills/deploy-test/SKILL.md](../../.claude/skills/deploy-test/SKILL.md)
- **Deploy Prod Skill**: [.claude/skills/deploy-prod/SKILL.md](../../.claude/skills/deploy-prod/SKILL.md)

---

**Last Updated**: 2026-01-21
**Maintainer**: Family Budget Team
**Version**: 1.0 (Registry-First Architecture)
**Breaking Changes**: 5 custom images, multi-stage builds, embedded frontend

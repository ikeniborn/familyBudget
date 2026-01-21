# Multi-stage build for Family Budget Backend
# Stage 1: Python dependencies builder
FROM python:3.11-slim as python-builder

ARG PYTHON_VERSION=3.11
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY backend/requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Stage 2: Frontend builder
FROM node:18-alpine as frontend-builder

ARG CACHE_VERSION
ENV CACHE_VERSION=${CACHE_VERSION}

WORKDIR /build

# Копируем package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Копируем build configuration files (required for npm run build:prod)
COPY build-all.js ./
COPY vite*.ts ./
COPY vitest.config.ts postcss.config.js ./
COPY tsconfig*.json ./
COPY tailwind.config.js eslint.config.js ./
COPY sw.js manifest.json ./

# Копируем исходники frontend
COPY frontend/ ./frontend/
COPY scripts/ ./scripts/
COPY VERSION ./

# Минификация и сборка (cache busting уже выполнен в CI)
RUN npm run build:prod

# Проверка результатов (включая Service Worker)
RUN ls -lh frontend/web/static/css/ && \
    ls -lh frontend/web/static/js/dist/ && \
    echo "Checking for Service Worker files..." && \
    ls -lh sw.min.js* 2>&1 || echo "SW files not in /build root" && \
    find . -name "sw.min.js*" -type f && \
    echo "Frontend build complete with CACHE_VERSION=${CACHE_VERSION}"

# Stage 3: Runtime image
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_HOME=/app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -r appuser && useradd -r -g appuser appuser

# Копируем Python venv из python-builder
COPY --from=python-builder /opt/venv /opt/venv

WORKDIR $APP_HOME

# Копируем backend исходники
COPY --chown=appuser:appuser backend/ $APP_HOME/backend/

# ВАЖНО: Копируем frontend ИЗ FRONTEND-BUILDER (с собранными assets)
COPY --from=frontend-builder --chown=appuser:appuser /build/frontend/ $APP_HOME/frontend/

# Копируем scripts (для create_admin_user.py и других утилит)
COPY --from=frontend-builder --chown=appuser:appuser /build/scripts/ $APP_HOME/scripts/

# Копируем Service Worker и Manifest
# Note: sw.min.js is required, .gz is optional (may be created with wrong path by compression plugin)
COPY --from=frontend-builder --chown=appuser:appuser /build/sw.min.js $APP_HOME/sw.min.js
COPY --from=frontend-builder --chown=appuser:appuser /build/manifest.json $APP_HOME/manifest.json

# Создаем директории
RUN mkdir -p $APP_HOME/logs $APP_HOME/uploads $APP_HOME/uploads/temp && \
    chown -R appuser:appuser $APP_HOME/logs $APP_HOME/uploads

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

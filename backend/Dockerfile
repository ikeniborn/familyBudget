# Multi-stage build for Family Budget Backend
# Stage 1: Python dependencies builder
FROM python:3.11-slim-bookworm as python-builder

ARG PYTHON_VERSION=3.11
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt && \
    pip install --upgrade 'jaraco.context>=6.1.0' 'wheel>=0.46.2'

# Stage 2: Frontend builder
FROM node:18-alpine as frontend-builder

ARG CACHE_VERSION
ENV CACHE_VERSION=${CACHE_VERSION}

WORKDIR /build

# Копируем package files
COPY package*.json ./

# Install dependencies with BuildKit cache mount
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Копируем build configuration files (required for npm run build:prod)
COPY build-all.js ./
COPY config/ ./config/
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
    ls -lh frontend/web/static/sw.min.js* && \
    echo "Frontend build complete with CACHE_VERSION=${CACHE_VERSION}"

# Stage 3: Runtime image
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    APP_HOME=/app

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (rarely changes)
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy Python venv from builder (changes when dependencies change)
COPY --from=python-builder /opt/venv /opt/venv

WORKDIR $APP_HOME

# Create directories early (rarely changes)
RUN mkdir -p $APP_HOME/logs $APP_HOME/uploads $APP_HOME/uploads/temp

# Copy VERSION, manifest, sw.min.js (change on release)
COPY --from=frontend-builder --chown=appuser:appuser /build/VERSION $APP_HOME/VERSION
COPY --from=frontend-builder --chown=appuser:appuser /build/manifest.json $APP_HOME/manifest.json
COPY --from=frontend-builder --chown=appuser:appuser /build/frontend/web/static/sw.min.js $APP_HOME/sw.min.js

# Copy scripts (changes rarely)
COPY --from=frontend-builder --chown=appuser:appuser /build/scripts/ $APP_HOME/scripts/

# Copy backend code (changes frequently) - NEAR END for better cache hit
COPY --chown=appuser:appuser backend/ $APP_HOME/backend/

# Copy frontend assets (changes frequently) - NEAR END for better cache hit
COPY --from=frontend-builder --chown=appuser:appuser /build/frontend/ $APP_HOME/frontend/

# Fix ownership for runtime directories
RUN chown -R appuser:appuser $APP_HOME/logs $APP_HOME/uploads

USER appuser

# OCI Image Labels (OpenContainer Initiative metadata standard)
LABEL org.opencontainers.image.title="Family Budget Backend" \
      org.opencontainers.image.description="FastAPI backend with embedded frontend (PWA + HTMX + Tailwind + DaisyUI)" \
      org.opencontainers.image.vendor="Family Budget Team" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/ikeniborn/familybudget" \
      org.opencontainers.image.documentation="https://github.com/ikeniborn/familybudget/blob/main/docs/architecture/docker.md"

# Dynamic labels (set via build args in CI/CD)
ARG VERSION
ARG GIT_COMMIT
ARG BUILD_DATE
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

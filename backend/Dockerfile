# Resolve wheels on glibc for the same CPython ABI as the runtime.
FROM python:3.11-slim-bookworm AS python-builder

ENV PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /build
COPY backend/requirements.txt .
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --target=/opt/packages -r requirements.txt

# Stage 2: Frontend builder
FROM node:18-alpine as frontend-builder

ARG CACHE_VERSION
ENV CACHE_VERSION=${CACHE_VERSION}

WORKDIR /build

# Install bash and perl for cache_busting_ci.sh script
RUN apk add --no-cache bash perl

# Копируем package files (change rarely - good cache layer)
COPY package*.json ./

# Install dependencies with BuildKit cache mount (cache hit if package*.json unchanged)
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Копируем build configuration files (change rarely - good cache layer)
# These are required for npm run build:prod
COPY build-all.js ./
COPY config/ ./config/
COPY sw.js manifest.json ./

# Копируем исходники frontend (change frequently - near end for better cache)
# Moved after dependencies to maximize cache hit rate
COPY frontend/ ./frontend/
COPY scripts/ ./scripts/

# Copy VERSION last (changes on every release - invalidates least layers)
COPY VERSION ./

# Set production environment for Vite minification
ENV NODE_ENV=production

# Минификация и сборка frontend assets (FIRST - with PLACEHOLDER in templates)
RUN npm run build:prod

# Cache busting - замена PLACEHOLDER на CACHE_VERSION во всех template files
# This only modifies templates for serving, NOT source files
RUN if [ -n "$CACHE_VERSION" ]; then \
        echo "Running cache busting with version: $CACHE_VERSION"; \
        bash scripts/ci/cache_busting_ci.sh "$CACHE_VERSION"; \
    else \
        echo "WARNING: CACHE_VERSION not set, skipping cache busting"; \
    fi

# Проверка результатов (включая Service Worker)
RUN ls -lh frontend/web/static/css/ && \
    ls -lh frontend/web/static/js/dist/ && \
    echo "Checking for Service Worker files..." && \
    ls -lh frontend/web/static/sw.min.js* && \
    echo "Frontend build complete with CACHE_VERSION=${CACHE_VERSION}"

# Install signed Wolfi packages into an empty root. APK retains the package
# database for Trivy. The installer and its shell stay in the build stage.
FROM cgr.dev/chainguard/wolfi-base@sha256:6ab86c5e059da41ff1454b6f69ecd7422b94af41969f4e231aa23244e47d4a81 AS runtime-packages
ARG BUILD_DATE=local
RUN echo "Resolving runtime packages for ${BUILD_DATE}" && \
    mkdir -p /runtime/etc/apk/keys && \
    cp /etc/apk/keys/wolfi-signing.rsa.pub /runtime/etc/apk/keys/ && \
    echo https://packages.wolfi.dev/os > /runtime/etc/apk/repositories && \
    apk --root /runtime --initdb --no-cache add busybox wolfi-baselayout ca-certificates-bundle python-3.11 tzdata libstdc++ && \
    apk --root /runtime --no-cache --no-commit-hooks del busybox && \
    chroot /runtime /usr/bin/ldconfig && \
    chroot /runtime /usr/bin/python3.11 -c "import ssl, sqlite3; from zoneinfo import ZoneInfo; ZoneInfo('Europe/Moscow')"

FROM scratch
COPY --from=runtime-packages /runtime/ /
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/opt/venv/lib/python3.11/site-packages:/app \
    APP_HOME=/app
COPY --from=python-builder /opt/packages/ /opt/venv/lib/python3.11/site-packages/

WORKDIR $APP_HOME

# Copy VERSION, manifest, sw.min.js (change on release)
COPY --from=frontend-builder /build/VERSION $APP_HOME/VERSION
COPY --from=frontend-builder /build/manifest.json $APP_HOME/manifest.json
COPY --from=frontend-builder /build/frontend/web/static/sw.min.js $APP_HOME/sw.min.js

# Copy scripts (changes rarely)
COPY --from=frontend-builder /build/scripts/ $APP_HOME/scripts/

# Copy backend code (changes frequently) - NEAR END for better cache hit
COPY backend/ $APP_HOME/backend/

# Copy entrypoint and healthcheck scripts
COPY backend/start_server.py $APP_HOME/start_server.py
COPY backend/healthcheck.py $APP_HOME/healthcheck.py

# Copy frontend assets (changes frequently) - NEAR END for better cache hit
COPY --from=frontend-builder /build/frontend/ $APP_HOME/frontend/

# Note: Runtime directories (/app/logs, /app/uploads) will be created via volume mounts in docker-compose.yml

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

# The Mini PC poller also invokes this interpreter path directly.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["/usr/bin/python3.11", "/app/healthcheck.py"]

ENTRYPOINT ["/usr/bin/python3.11"]

# Start server via Python script (supports WORKERS env var)
CMD ["/app/start_server.py"]

# Multi-stage build for Family Budget Backend
# Stage 1: Python dependencies builder
FROM python:3.11-slim-bookworm as python-builder

ARG PYTHON_VERSION=3.11
# BUILD_DATE invalidates apt layer cache each CI run so security patches
# (e.g. krb5 u4 -> u5 for CVE-2026-40356) are picked up promptly.
ARG BUILD_DATE=unknown
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN echo "apt refresh: ${BUILD_DATE}" && \
    apt-get update && \
    apt-get dist-upgrade -y && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Regenerate distroless-format dpkg metadata for packages whose .so files we
# copy into the runtime image. Distroless ships stale /var/lib/dpkg/status.d/*
# files that mismatch the upgraded libraries we copy, producing false-positive
# Trivy reports (e.g. CVE-2026-40356 krb5 u4→u5).
RUN mkdir -p /opt/dpkg-status && \
    for pkg in libgssapi-krb5-2 libk5crypto3 libkrb5-3 libkrb5support0 \
               libldap-2.5-0 liblber-2.5-0 libsasl2-2 \
               libgnutls30 libcom-err2 libkeyutils1 \
               libp11-kit0 libidn2-0 libunistring2 libtasn1-6 \
               libnettle8 libhogweed6 libgmp10 libffi8 libpq5; do \
        dpkg-query -W -f='Package: ${Package}\nStatus: ${Status}\nPriority: ${Priority}\nSection: ${Section}\nInstalled-Size: ${Installed-Size}\nMaintainer: ${Maintainer}\nArchitecture: ${Architecture}\nMulti-Arch: ${Multi-Arch}\nSource: ${Source}\nVersion: ${Version}\nDepends: ${Depends}\nDescription: ${Description}\n' "$pkg" > "/opt/dpkg-status/$pkg" 2>/dev/null || true ; \
    done

# Remove vulnerable system Python packages before creating venv
RUN pip uninstall -y wheel jaraco.context setuptools 2>/dev/null || true

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

# Stage 3: Runtime image (Distroless for security and size optimization)
FROM gcr.io/distroless/python3-debian12:latest

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH="/opt/venv/lib/python3.11/site-packages:${PYTHONPATH}" \
    APP_HOME=/app

# Copy runtime libraries from builder (distroless doesn't have package manager)
# PostgreSQL client library (required by asyncpg)
COPY --from=python-builder /usr/lib/x86_64-linux-gnu/libpq.so.5* /usr/lib/x86_64-linux-gnu/
# Copy all libpq dependencies from /lib/x86_64-linux-gnu/ (Kerberos, LDAP, SASL, GnuTLS, etc.)
# This includes: libgssapi_krb5, libldap-2.5, liblber-2.5, libsasl2, libgnutls, libkrb5, libk5crypto, libcom_err, libkrb5support, libkeyutils
COPY --from=python-builder /lib/x86_64-linux-gnu/libgssapi_krb5.so.2* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libldap-2.5.so.0* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/liblber-2.5.so.0* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libsasl2.so.2* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libgnutls.so.30* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libkrb5.so.3* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libk5crypto.so.3* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libcom_err.so.2* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libkrb5support.so.0* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libkeyutils.so.1* /lib/x86_64-linux-gnu/
# Transitive dependencies (required by GnuTLS and libpq)
COPY --from=python-builder /lib/x86_64-linux-gnu/libresolv.so.2* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libp11-kit.so.0* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libidn2.so.0* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libunistring.so.2* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libtasn1.so.6* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libnettle.so.8* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libhogweed.so.6* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libgmp.so.10* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libffi.so.8* /lib/x86_64-linux-gnu/
# SSL/TLS libraries (already in distroless, but copy for consistency)
COPY --from=python-builder /lib/x86_64-linux-gnu/libssl.so.3* /lib/x86_64-linux-gnu/
COPY --from=python-builder /lib/x86_64-linux-gnu/libcrypto.so.3* /lib/x86_64-linux-gnu/
# CA certificates (required for TLS verification)
COPY --from=python-builder /etc/ssl/certs /etc/ssl/certs

# Refresh dpkg metadata for upgraded libraries so Trivy reports match the
# actual binaries we just copied (overrides stale distroless status.d).
COPY --from=python-builder /opt/dpkg-status/ /var/lib/dpkg/status.d/

# Copy Python venv from builder (changes when dependencies change)
COPY --from=python-builder /opt/venv /opt/venv

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
# Distroless runs as nonroot user (UID 65532) - no RUN commands available

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

# Python-based healthcheck (no curl in distroless)
# Use distroless system Python + venv packages via PYTHONPATH
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["/usr/bin/python3.11", "/app/healthcheck.py"]

# Use distroless system Python (no venv binary issues)
# Packages loaded from /opt/venv/lib/python3.11/site-packages via PYTHONPATH
ENTRYPOINT ["/usr/bin/python3.11"]

# Start server via Python script (supports WORKERS env var)
CMD ["/app/start_server.py"]

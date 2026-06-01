# Multi-stage build for Family Budget Bot
# Stage 1: Builder
# Force rebuild: v11.4.51 - healthcheck fix deployed
FROM python:3.11-slim-bookworm as builder

ARG PYTHON_VERSION=3.11
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies (may be needed for some packages)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create venv
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /build
COPY bot/requirements.txt .

# Install dependencies with BuildKit cache mount
# pip pinned explicitly: CVE-2025-8869, CVE-2026-1703, CVE-2026-3219, CVE-2026-6357 fixed in 26.1
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install "pip==26.1.2" setuptools wheel && \
    pip install -r requirements.txt

# Stage 2: Runtime (Distroless for security and size optimization)
FROM gcr.io/distroless/python3-debian12:latest

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/opt/venv/bin:$PATH" \
    PYTHONPATH=/opt/venv/lib/python3.11/site-packages:/app

# Copy SSL/TLS libraries from builder (required for Telegram API HTTPS connections)
COPY --from=builder /usr/lib/x86_64-linux-gnu/libssl.so.3* /usr/lib/x86_64-linux-gnu/
COPY --from=builder /usr/lib/x86_64-linux-gnu/libcrypto.so.3* /usr/lib/x86_64-linux-gnu/
# CA certificates (required for TLS verification)
COPY --from=builder /etc/ssl/certs /etc/ssl/certs

# Copy venv from builder
COPY --from=builder /opt/venv /opt/venv

WORKDIR /app

# Copy bot application (distroless runs as nonroot user UID 65532)
COPY bot/ /app/bot/

# Copy healthcheck script with executable permissions (Python-based, no pgrep needed in distroless)
COPY --chmod=755 bot/healthcheck.py /app/healthcheck.py

# Note: Runtime directories (/app/logs) will be created via volume mounts in docker-compose.yml

# Python-based healthcheck (no pgrep in distroless)
# ENTRYPOINT is inherited from distroless base image (/usr/bin/python3.11)
# NOTE: Distroless doesn't support shebang, must explicitly call python3
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD ["python3", "/app/healthcheck.py"]

# OCI Image Labels (OpenContainer Initiative metadata standard)
LABEL org.opencontainers.image.title="Family Budget Bot" \
      org.opencontainers.image.description="Telegram bot (python-telegram-bot 21.10)" \
      org.opencontainers.image.vendor="Family Budget Team" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/ikeniborn/familybudget"

# Dynamic labels (set via build args in CI/CD)
ARG VERSION
ARG GIT_COMMIT
ARG BUILD_DATE
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# ENTRYPOINT is inherited from distroless base image (/usr/bin/python3.11)
# CMD provides only the arguments to python
CMD ["-m", "bot.main"]

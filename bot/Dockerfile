# Multi-stage build for Family Budget Bot
# Stage 1: Builder
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
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip setuptools wheel && \
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

# Copy healthcheck script (Python-based, no pgrep needed in distroless)
COPY bot/healthcheck.py /app/healthcheck.py

# Note: Runtime directories (/app/logs) will be created via volume mounts in docker-compose.yml

# Healthcheck disabled for distroless
# Reason: Distroless ENTRYPOINT (/usr/bin/python3.11) doesn't handle shebang execution
# Bot logs show successful startup, so healthcheck is not critical
# Alternative: Override healthcheck in docker-compose.yml if needed
HEALTHCHECK NONE

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

CMD ["-m", "bot.main"]

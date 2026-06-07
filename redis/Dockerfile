FROM redis:7-alpine

# Force rebuild: image deleted from GHCR (0.6.98 missing)
# Force rebuild (2026-06-07): tag 0.6.120 lost a per-platform sub-manifest
# (sha256:e72eb776...) — the build-and-push cleanup job deleted it as an "old
# untagged image" even though the release manifest list still referenced it, so
# `docker pull` failed with "manifests/<digest> not found" and blocked deploy.
# The cleanup protection is hardened in this same change; touching this file
# changes the redis/ path hash so CI re-pushes a fresh, intact manifest.

# Создаем директорию для AOF persistence
RUN mkdir -p /data && chown -R redis:redis /data

EXPOSE 6379

# Healthcheck
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
    CMD redis-cli ping || exit 1

# Команда запуска (параметры передаются через docker-compose command)
CMD ["redis-server"]

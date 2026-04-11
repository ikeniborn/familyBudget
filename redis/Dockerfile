FROM redis:7-alpine

# Force rebuild: image deleted from GHCR (0.6.98 missing)

# Создаем директорию для AOF persistence
RUN mkdir -p /data && chown -R redis:redis /data

EXPOSE 6379

# Healthcheck
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=10 \
    CMD redis-cli ping || exit 1

# Команда запуска (параметры передаются через docker-compose command)
CMD ["redis-server"]

FROM nginx:alpine

# Force rebuild: image deleted from GHCR (0.6.98 missing)

# Копируем nginx конфигурацию
# Context: ./nginx (paths relative to nginx/ directory)
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# Копируем entrypoint скрипт для обработки templates
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Создаем директории для логов и cache
RUN mkdir -p /var/log/nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD nginx -t || exit 1

EXPOSE 80 443

ENTRYPOINT ["/docker-entrypoint.sh"]

FROM nginx:alpine

# Копируем nginx конфигурацию
COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/conf.d/ /etc/nginx/conf.d/

# Создаем директории для логов и cache
RUN mkdir -p /var/log/nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx /var/cache/nginx

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD nginx -t || exit 1

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]

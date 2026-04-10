# syntax=docker/dockerfile:1
FROM postgres:16-alpine

# Создаем директорию для backups
RUN mkdir -p /backups && chown -R postgres:postgres /backups

EXPOSE 5432

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER:-familybudget} || exit 1

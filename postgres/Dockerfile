# syntax=docker/dockerfile:1
#
# Rebuild forced (2026-06-07): the previously published tag had a manifest that
# referenced a layer blob garbage-collected from ghcr.io, so `docker pull` failed
# with "blob ... not found" and blocked every deploy at the pull step. A manifest
# inspect alone could not detect this, so CI's registry-existence fallback never
# triggered a rebuild. Touching this file changes the postgres/ path hash, which
# forces image-build-push to re-push the image with fresh, intact blobs.
FROM postgres:16-alpine

# Создаем директорию для backups
RUN mkdir -p /backups && chown -R postgres:postgres /backups

EXPOSE 5432

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=5 \
    CMD pg_isready -U ${POSTGRES_USER:-familybudget} || exit 1

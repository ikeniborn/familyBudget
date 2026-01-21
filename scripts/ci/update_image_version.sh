#!/bin/bash
# Обновляет version и hash для ОДНОГО образа в IMAGE_VERSIONS.json после сборки
set -e

IMAGE_NAME="$1"
NEW_VERSION="$2"
IMAGE_VERSIONS_FILE="IMAGE_VERSIONS.json"

if [[ -z "$IMAGE_NAME" || -z "$NEW_VERSION" ]]; then
    echo "Usage: update_image_version.sh <image_name> <version>" >&2
    exit 1
fi

if [[ ! -f "$IMAGE_VERSIONS_FILE" ]]; then
    echo "ERROR: IMAGE_VERSIONS.json not found" >&2
    exit 1
fi

# Проверяем что образ существует в JSON
if ! jq -e ".${IMAGE_NAME}" "$IMAGE_VERSIONS_FILE" > /dev/null 2>&1; then
    echo "ERROR: Image '${IMAGE_NAME}' not found in IMAGE_VERSIONS.json" >&2
    exit 1
fi

# Получаем paths для образа
paths=$(jq -r ".${IMAGE_NAME}.paths[]" "$IMAGE_VERSIONS_FILE" 2>/dev/null | tr '\n' ' ')

if [[ -z "$paths" ]]; then
    echo "ERROR: No paths defined for ${IMAGE_NAME}" >&2
    exit 1
fi

# Вычисляем текущий hash (последний коммит затронувший эти пути)
current_hash=$(git log -1 --pretty=format:%h -- $paths 2>/dev/null || echo "")

if [[ -z "$current_hash" ]]; then
    echo "WARNING: No git history for paths: $paths, using HEAD hash" >&2
    current_hash=$(git rev-parse --short HEAD)
fi

# Обновляем JSON с валидацией
timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

jq --arg version "$NEW_VERSION" \
   --arg hash "$current_hash" \
   --arg timestamp "$timestamp" \
   ".${IMAGE_NAME}.version = \$version | .${IMAGE_NAME}.hash = \$hash | .${IMAGE_NAME}.lastModified = \$timestamp" \
   "$IMAGE_VERSIONS_FILE" > "${IMAGE_VERSIONS_FILE}.tmp"

# Validate JSON
if ! jq . "${IMAGE_VERSIONS_FILE}.tmp" > /dev/null 2>&1; then
    echo "ERROR: Generated invalid JSON" >&2
    cat "${IMAGE_VERSIONS_FILE}.tmp" >&2
    rm "${IMAGE_VERSIONS_FILE}.tmp"
    exit 1
fi

# Atomic move
mv "${IMAGE_VERSIONS_FILE}.tmp" "$IMAGE_VERSIONS_FILE"

echo "✓ Updated ${IMAGE_NAME}: version=${NEW_VERSION}, hash=${current_hash}"

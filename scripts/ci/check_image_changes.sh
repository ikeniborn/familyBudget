#!/bin/bash
# Проверяет какие образы нужно пересобрать на основе IMAGE_VERSIONS.json
set -e

IMAGE_NAME="$1"
IMAGE_VERSIONS_FILE="IMAGE_VERSIONS.json"

if [[ -z "$IMAGE_NAME" ]]; then
    echo "Usage: check_image_changes.sh <image_name>" >&2
    exit 1
fi

if [[ ! -f "$IMAGE_VERSIONS_FILE" ]]; then
    echo "skip"
    echo "IMAGE_VERSIONS.json not found, skipping change detection" >&2
    exit 0
fi

# Получить paths для образа из JSON
paths=$(jq -r ".${IMAGE_NAME}.paths[]" "$IMAGE_VERSIONS_FILE" 2>/dev/null)

if [[ -z "$paths" || "$paths" == "null" ]]; then
    echo "build"
    echo "Image '${IMAGE_NAME}' not found in IMAGE_VERSIONS.json, forcing build" >&2
    exit 0
fi

# Вычислить hash для текущего состояния (последний коммит затронувший эти пути)
current_hash=$(git log -1 --pretty=format:%h -- $paths 2>/dev/null || echo "")

if [[ -z "$current_hash" ]]; then
    echo "build"
    echo "No git history for paths, forcing build" >&2
    exit 0
fi

# Сравнить с сохраненным hash
saved_hash=$(jq -r ".${IMAGE_NAME}.hash" "$IMAGE_VERSIONS_FILE" 2>/dev/null || echo "")

if [[ "$saved_hash" == "null" || "$saved_hash" == "placeholder" || -z "$saved_hash" ]]; then
    echo "build"
    echo "No saved hash for ${IMAGE_NAME}, forcing build" >&2
    exit 0
fi

if [[ "$current_hash" == "$saved_hash" ]]; then
    echo "skip"
    echo "No changes detected for ${IMAGE_NAME} (hash: $current_hash)" >&2
else
    echo "build"
    echo "Changes detected for ${IMAGE_NAME}: $saved_hash → $current_hash" >&2
fi

exit 0

#!/bin/bash
# Helper script для автоматического обновления Web Workers WORKER_VERSION
# Использует timestamp в формате cache busting (YYYYMMDD_HHMM)
#
# Обновляет WORKER_VERSION в workerWrapper.js при деплое

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

WORKER_FILE="frontend/web/static/js/workers/core/workerWrapper.js"

echo -e "${YELLOW}[INFO]${NC} Updating Web Workers version..."

# Проверить что workerWrapper.js существует
if [ ! -f "$WORKER_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} $WORKER_FILE not found!"
    exit 1
fi

# Получить timestamp (формат cache busting: YYYYMMDD_HHMM)
TIMESTAMP=$(date +"%Y%m%d_%H%M")

# Новая версия: v{timestamp}
NEW_VERSION="v${TIMESTAMP}"

echo -e "${YELLOW}[INFO]${NC} New version: $NEW_VERSION"

# Backup текущего workerWrapper.js
cp "$WORKER_FILE" "${WORKER_FILE}.bak"

# Обновить WORKER_VERSION в workerWrapper.js
# Pattern: const WORKER_VERSION = 'v{YYYYMMDD_HHMM}';
sed -i.tmp "s/const WORKER_VERSION = 'v[^']*';/const WORKER_VERSION = '${NEW_VERSION}';/" "$WORKER_FILE"
rm -f "${WORKER_FILE}.tmp"

# Проверить что замена прошла успешно
if grep -q "const WORKER_VERSION = '${NEW_VERSION}';" "$WORKER_FILE"; then
    echo -e "${GREEN}[SUCCESS]${NC} Worker version updated to: $NEW_VERSION"
    rm -f "${WORKER_FILE}.bak"
else
    echo -e "${RED}[ERROR]${NC} Failed to update version, restoring backup..."
    mv "${WORKER_FILE}.bak" "$WORKER_FILE"
    exit 1
fi

# Показать diff
echo -e "${YELLOW}[INFO]${NC} Changes:"
grep "const WORKER_VERSION" "$WORKER_FILE"

echo -e "${GREEN}[SUCCESS]${NC} Done! workerWrapper.js version updated"

#!/bin/bash
# Helper script для автоматического обновления Service Worker CACHE_VERSION
# Использует git hash для уникальной версии

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SW_FILE="sw.js"

echo -e "${YELLOW}[INFO]${NC} Updating Service Worker cache version..."

# Проверить что sw.js существует
if [ ! -f "$SW_FILE" ]; then
    echo -e "${RED}[ERROR]${NC} $SW_FILE not found!"
    exit 1
fi

# Получить git hash (короткая версия, 7 символов)
GIT_HASH=$(git rev-parse --short=7 HEAD 2>/dev/null || echo "unknown")

# Получить timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Новая версия: v{timestamp}_{git_hash}
NEW_VERSION="v${TIMESTAMP}_${GIT_HASH}"

echo -e "${YELLOW}[INFO]${NC} New version: $NEW_VERSION"

# Backup текущего sw.js
cp "$SW_FILE" "${SW_FILE}.bak"

# Обновить CACHE_VERSION в sw.js
sed -i.tmp "s/const CACHE_VERSION = 'v[^']*';/const CACHE_VERSION = '${NEW_VERSION}';/" "$SW_FILE"
rm -f "${SW_FILE}.tmp"

# Проверить что замена прошла успешно
if grep -q "const CACHE_VERSION = '${NEW_VERSION}';" "$SW_FILE"; then
    echo -e "${GREEN}[SUCCESS]${NC} Service Worker version updated to: $NEW_VERSION"
    rm -f "${SW_FILE}.bak"
else
    echo -e "${RED}[ERROR]${NC} Failed to update version, restoring backup..."
    mv "${SW_FILE}.bak" "$SW_FILE"
    exit 1
fi

# Показать diff
echo -e "${YELLOW}[INFO]${NC} Changes:"
grep "const CACHE_VERSION" "$SW_FILE"

echo -e "${GREEN}[SUCCESS]${NC} Done! Remember to commit the updated sw.js"

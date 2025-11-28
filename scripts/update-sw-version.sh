#!/bin/bash
# Helper script для автоматического обновления Service Worker CACHE_VERSION
# Использует timestamp в формате cache busting (YYYYMMDD_HHMM)

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

# Получить timestamp (формат cache busting: YYYYMMDD_HHMM)
TIMESTAMP=$(date +"%Y%m%d_%H%M")

# Новая версия: v{timestamp}
NEW_VERSION="v${TIMESTAMP}"

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

#!/usr/bin/env bash

################################################################################
# Pre-compress Assets with Gzip
#
# Compresses all minified JS/CSS files with gzip -9 for nginx gzip_static.
#
# This script is called by:
# - npm run precompress (manually)
# - npm run build (during deployment)
#
# Usage: ./precompress-assets.sh
#
# Author: Family Budget Team
# Version: 1.0.0
# Date: 2025-12-26
################################################################################

set -euo pipefail

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Paths
readonly STATIC_DIR="frontend/web/static"
readonly WEBAPP_DIR="frontend/webapp/static"
readonly SHARED_DIR="frontend/shared/static"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}🗜️  Pre-compressing Assets with Gzip${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Counter
total_compressed=0

# Compress all minified JS files
echo -e "${BLUE}[INFO]${NC} Compressing JavaScript files..."
while IFS= read -r file; do
    gzip -9 -k -f "$file"
    total_compressed=$((total_compressed + 1))
    echo -e "  ✓ ${file}.gz"
done < <(find "$STATIC_DIR/js" "$WEBAPP_DIR/js" "$SHARED_DIR/js" -name "*.min.js" -type f 2>/dev/null || true)

# Compress all minified CSS files
echo ""
echo -e "${BLUE}[INFO]${NC} Compressing CSS files..."
while IFS= read -r file; do
    gzip -9 -k -f "$file"
    total_compressed=$((total_compressed + 1))
    echo -e "  ✓ ${file}.gz"
done < <(find "$STATIC_DIR/css" "$WEBAPP_DIR/css" "$SHARED_DIR/css" -name "*.min.css" -type f 2>/dev/null || true)

# Compress service worker
if [[ -f "sw.min.js" ]]; then
    gzip -9 -k -f "sw.min.js"
    total_compressed=$((total_compressed + 1))
    echo ""
    echo -e "${BLUE}[INFO]${NC} Compressing Service Worker..."
    echo -e "  ✓ sw.min.js.gz"
fi

# Compress manifest
if [[ -f "${STATIC_DIR}/manifest.json" ]]; then
    gzip -9 -k -f "${STATIC_DIR}/manifest.json"
    total_compressed=$((total_compressed + 1))
    echo ""
    echo -e "${BLUE}[INFO]${NC} Compressing PWA manifest..."
    echo -e "  ✓ ${STATIC_DIR}/manifest.json.gz"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Pre-compression complete!${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}[SUCCESS]${NC} Compressed ${total_compressed} files"
echo ""
echo -e "${BLUE}[INFO]${NC} Next step: Configure nginx with 'gzip_static on;' to serve .gz files"
echo -e "${BLUE}[INFO]${NC} Expected delivery size reduction: 60-70% vs minified files"
echo ""

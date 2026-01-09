#!/bin/bash
# Minify individual JS files (not handled by Vite bundles)
# Run after npm run build to create .min.js files for legacy script tags

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}[INFO]${NC} Minifying individual JS files..."

# Find terser in .npm-isolated
TERSER="$PROJECT_ROOT/.npm-isolated/node_modules/.bin/terser"

if [[ ! -f "$TERSER" ]]; then
    echo -e "${YELLOW}[WARNING]${NC} terser not found in .npm-isolated, trying global..."
    TERSER="terser"
fi

# Minify files in frontend/shared/static/js
cd "$PROJECT_ROOT/frontend/shared/static/js"

for file in *.js; do
    # Skip .bundle.js and .min.js files
    if [[ "$file" =~ \.bundle\.js$ ]] || [[ "$file" =~ \.min\.js$ ]]; then
        continue
    fi

    base=$(basename "$file" .js)
    minfile="${base}.min.js"

    echo -e "  ${GREEN}✓${NC} Minifying: $base.js → $base.min.js"

    # Minify with source map
    "$TERSER" "$file" -c -m --source-map "url=$base.min.js.map" -o "$minfile" 2>/dev/null || {
        echo -e "${YELLOW}[WARNING]${NC} Failed to minify $file"
        continue
    }

    # Create gzipped version
    gzip -9 -k -f "$minfile" 2>/dev/null || true
done

echo -e "${GREEN}[SUCCESS]${NC} Individual JS files minified successfully"

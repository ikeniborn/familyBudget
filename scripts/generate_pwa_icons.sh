#!/bin/bash
#
# PWA Icons Generator
# Генерирует все необходимые PWA иконки из SVG файла
#
# Требования:
# - ImageMagick (convert, identify)
#
# Использование:
#   ./scripts/generate_pwa_icons.sh [path/to/icon.svg]
#
# По умолчанию использует tmp/budget-icon-v3.svg

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Директории
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ICONS_DIR="$PROJECT_DIR/frontend/web/static/icons"
DEFAULT_SVG="$PROJECT_DIR/tmp/budget-icon-v3.svg"

# Входной SVG файл
INPUT_SVG="${1:-$DEFAULT_SVG}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           PWA Icons Generator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверка ImageMagick
if ! command -v convert &> /dev/null; then
    echo -e "${RED}✗ Error: ImageMagick not found${NC}"
    echo "Install: sudo apt-get install imagemagick"
    exit 1
fi

# Проверка входного файла
if [[ ! -f "$INPUT_SVG" ]]; then
    echo -e "${RED}✗ Error: SVG file not found: $INPUT_SVG${NC}"
    echo "Usage: $0 [path/to/icon.svg]"
    exit 1
fi

echo -e "${GREEN}✓ Source SVG:${NC} $INPUT_SVG"
echo -e "${GREEN}✓ Output directory:${NC} $ICONS_DIR"
echo ""

# Создать директорию если не существует
mkdir -p "$ICONS_DIR"

# Функция для генерации PNG с высоким качеством
generate_png() {
    local size=$1
    local output=$2
    local density=${3:-300}  # Default density 300 для качественной растеризации

    echo -n "  Generating $(basename "$output") (${size}x${size})... "

    convert -density "$density" "$INPUT_SVG" \
        -resize "${size}x${size}" \
        -background none \
        "$output"

    if [[ -f "$output" ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Функция для генерации maskable иконки с safe zone
generate_maskable() {
    local size=$1
    local output=$2
    local padding_percent=${3:-20}  # 20% padding для safe zone (80% контент)

    echo -n "  Generating maskable $(basename "$output") (${size}x${size} with ${padding_percent}% safe zone)... "

    # Рассчитать размер контента (80% от финального размера)
    local content_size=$((size * (100 - padding_percent * 2) / 100))
    local padding=$((size - content_size))
    local half_padding=$((padding / 2))

    # Генерировать контент меньшего размера, затем добавить padding
    convert -density 300 "$INPUT_SVG" \
        -resize "${content_size}x${content_size}" \
        -background none \
        -gravity center \
        -extent "${size}x${size}" \
        "$output"

    if [[ -f "$output" ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

# Функция для генерации favicon.ico
generate_favicon() {
    local output=$1

    echo -n "  Generating favicon.ico (16x16, 32x32, 48x48)... "

    # Создать временные PNG файлы
    local tmp_dir=$(mktemp -d)

    convert -density 300 "$INPUT_SVG" -resize 16x16 -background none "$tmp_dir/favicon-16.png"
    convert -density 300 "$INPUT_SVG" -resize 32x32 -background none "$tmp_dir/favicon-32.png"
    convert -density 300 "$INPUT_SVG" -resize 48x48 -background none "$tmp_dir/favicon-48.png"

    # Конвертировать в ICO (multi-size)
    convert "$tmp_dir/favicon-16.png" \
            "$tmp_dir/favicon-32.png" \
            "$tmp_dir/favicon-48.png" \
            "$output"

    # Удалить временные файлы
    rm -rf "$tmp_dir"

    if [[ -f "$output" ]]; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        return 1
    fi
}

echo "Generating PWA icons..."
echo ""

# 1. icon-192.png (PWA manifest)
generate_png 192 "$ICONS_DIR/icon-192.png"

# 2. icon-512.png (PWA manifest)
generate_png 512 "$ICONS_DIR/icon-512.png"

# 3. icon-maskable-512.png (PWA manifest, maskable purpose)
generate_maskable 512 "$ICONS_DIR/icon-maskable-512.png" 20

# 4. apple-touch-icon.png (iOS)
generate_png 180 "$ICONS_DIR/apple-touch-icon.png"

# 5. favicon.ico (browser tab)
generate_favicon "$ICONS_DIR/favicon.ico"

# 6. icon.svg (копировать источник)
echo -n "  Copying icon.svg... "
cp "$INPUT_SVG" "$ICONS_DIR/icon.svg"
echo -e "${GREEN}✓${NC}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Проверить размеры сгенерированных файлов
echo "Verifying generated icons:"
echo ""

for file in "$ICONS_DIR/icon-192.png" \
            "$ICONS_DIR/icon-512.png" \
            "$ICONS_DIR/icon-maskable-512.png" \
            "$ICONS_DIR/apple-touch-icon.png" \
            "$ICONS_DIR/favicon.ico" \
            "$ICONS_DIR/icon.svg"; do
    if [[ -f "$file" ]]; then
        if [[ "$file" == *.png ]]; then
            size=$(identify -format "%wx%h" "$file")
            filesize=$(du -h "$file" | cut -f1)
            echo -e "  ${GREEN}✓${NC} $(basename "$file"): ${size}, ${filesize}"
        elif [[ "$file" == *.ico ]]; then
            filesize=$(du -h "$file" | cut -f1)
            echo -e "  ${GREEN}✓${NC} $(basename "$file"): ${filesize}"
        else
            filesize=$(du -h "$file" | cut -f1)
            echo -e "  ${GREEN}✓${NC} $(basename "$file"): ${filesize}"
        fi
    else
        echo -e "  ${RED}✗${NC} $(basename "$file"): NOT FOUND"
    fi
done

echo ""
echo -e "${GREEN}✓ All icons generated successfully!${NC}"
echo ""
echo "Next steps:"
echo "  1. Update manifest.json theme_color to #6366F1"
echo "  2. Update sw.js CACHE_VERSION"
echo "  3. Deploy changes"
echo ""

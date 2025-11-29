#!/usr/bin/env bash

################################################################################
# Build BudgetShared Bundle
#
# Combines individual modules (DateFormatter, CalendarWidget, ChoicesCategoryTree)
# into a single budgetShared.js file.
#
# This script is called by:
# - npm run bundle (manually)
# - npm run build (during deployment via deploy.sh)
#
# Usage: ./build-bundle.sh
#
# Author: Family Budget Team
# Version: 1.0.0
# Date: 2025-11-29
################################################################################

set -euo pipefail

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly RED='\033[0;31m'
readonly NC='\033[0m'

# Paths
readonly SHARED_DIR="frontend/shared/static/js"
readonly OUTPUT_FILE="${SHARED_DIR}/budgetShared.js"

# Source files (in order of bundling)
readonly DATE_FORMATTER="${SHARED_DIR}/dateFormatter.js"
readonly CALENDAR_WIDGET="${SHARED_DIR}/calendar-widget.js"
readonly CHOICES_TREE="${SHARED_DIR}/choicesCategoryTree.js"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📦 Building BudgetShared.js Bundle${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Validate source files exist
for file in "$DATE_FORMATTER" "$CALENDAR_WIDGET" "$CHOICES_TREE"; do
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}✗ ERROR: Source file not found: $file${NC}"
        exit 1
    fi
done

echo -e "${BLUE}[INFO]${NC} Source modules:"
echo -e "  • dateFormatter.js"
echo -e "  • calendar-widget.js"
echo -e "  • choicesCategoryTree.js"
echo ""

# Create bundle header
cat > "$OUTPUT_FILE" << 'EOF'
/**
 * BudgetShared - Unified bundle for Family Budget shared modules
 *
 * Includes:
 * - DateFormatter: Date formatting utilities (DD.MM.YYYY ↔ YYYY-MM-DD)
 * - CalendarWidget: DaisyUI calendar picker (single/range mode)
 * - ChoicesCategoryTree: Category selector with hierarchy support
 *
 * Usage:
 * ```javascript
 * // Date formatting
 * const displayDate = BudgetShared.DateFormatter.formatForDisplay('2025-11-02');
 *
 * // Calendar widget
 * const calendar = new BudgetShared.CalendarWidget({
 *   inputElement: document.getElementById('date-input'),
 *   mode: 'single'
 * });
 *
 * // Category tree
 * const categoryTree = new BudgetShared.ChoicesCategoryTree('#article_id', {
 *   type: 'expense'
 * });
 * ```
 *
 * @version 1.0.0
 * @size ~56KB (unminified), ~25KB (minified), ~7KB (gzipped)
 */

(function(window) {
    'use strict';

EOF

# Add DateFormatter module
echo "    //=============================================================================" >> "$OUTPUT_FILE"
echo "    // MODULE 1: DateFormatter" >> "$OUTPUT_FILE"
echo "    // Date formatting utilities for converting between DD.MM.YYYY and YYYY-MM-DD" >> "$OUTPUT_FILE"
echo "    //=============================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract DateFormatter class from dateFormatter.js (skip comments and IIF wrapper)
sed -n '/^class DateFormatter {/,/^}$/p' "${SHARED_DIR}/dateFormatter.js" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add CalendarWidget module
echo "    //=============================================================================" >> "$OUTPUT_FILE"
echo "    // MODULE 2: CalendarWidget" >> "$OUTPUT_FILE"
echo "    // DaisyUI calendar picker with single/range mode support" >> "$OUTPUT_FILE"
echo "    //=============================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract CalendarWidget class from calendar-widget.js
sed -n '/^class CalendarWidget {/,/^}$/p' "${SHARED_DIR}/calendar-widget.js" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add ChoicesCategoryTree module
echo "    //=============================================================================" >> "$OUTPUT_FILE"
echo "    // MODULE 3: ChoicesCategoryTree" >> "$OUTPUT_FILE"
echo "    // Category selector with hierarchical tree support (using Choices.js)" >> "$OUTPUT_FILE"
echo "    //=============================================================================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Extract ChoicesCategoryTree class from choicesCategoryTree.js
sed -n '/^class ChoicesCategoryTree {/,/^}$/p' "${SHARED_DIR}/choicesCategoryTree.js" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Add bundle footer (exports)
cat >> "$OUTPUT_FILE" << 'EOF'
    //=============================================================================
    // Export BudgetShared namespace to window
    //=============================================================================

    window.BudgetShared = {
        DateFormatter,
        CalendarWidget,
        ChoicesCategoryTree
    };

    // Legacy global exports for backward compatibility
    window.DateFormatter = DateFormatter;
    window.CalendarWidget = CalendarWidget;
    window.ChoicesCategoryTree = ChoicesCategoryTree;

})(window);
EOF

# Calculate bundle size
if [[ -f "$OUTPUT_FILE" ]]; then
    bundle_size=$(stat -c%s "$OUTPUT_FILE" 2>/dev/null || stat -f%z "$OUTPUT_FILE" 2>/dev/null)
    bundle_size_kb=$((bundle_size / 1024))
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}✅ Bundle created successfully${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}[SUCCESS]${NC} Output: $OUTPUT_FILE"
    echo -e "${GREEN}[SUCCESS]${NC} Size: ${bundle_size_kb}KB (unminified)"
    echo ""
    echo -e "${BLUE}[INFO]${NC} Next step: Bundle will be minified by 'npm run minify:js'"
    echo ""
else
    echo -e "${RED}✗ ERROR: Failed to create bundle${NC}"
    exit 1
fi

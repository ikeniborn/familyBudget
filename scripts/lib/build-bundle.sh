#!/usr/bin/env bash

################################################################################
# Build BudgetShared Bundle
#
# Combines individual modules (DateFormatter, CalendarWidget, ChoicesCategoryTree)
# into a single budgetShared.js file.
#
# Usage: ./build-bundle.sh
################################################################################

set -euo pipefail

# Colors
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m'

# Paths
readonly SHARED_DIR="frontend/shared/static/js"
readonly OUTPUT_FILE="${SHARED_DIR}/budgetShared.js"

echo -e "${BLUE}Building budgetShared.js bundle...${NC}"

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

echo -e "${GREEN}✓ budgetShared.js created successfully${NC}"
echo -e "${BLUE}Now run: npm run minify:js${NC}"

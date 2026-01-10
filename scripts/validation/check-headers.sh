#!/bin/bash

# Header Standardization Review Script
# Checks all H1/H2/H3 headers against approved standards

# Colors
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
total_files=0
ok_files=0
warning_files=0
error_files=0
total_issues=0

# Standards
H1_PATTERN='text-xl sm:text-2xl font-bold'
H1_SUBTITLE_PATTERN='text-sm sm:text-base text-base-content/70'
H2_PATTERN='text-lg sm:text-xl font-bold'
H3_PATTERN='text-base sm:text-lg font-semibold'

echo "======================================"
echo "Header Standardization Review"
echo "======================================"
echo ""

# Phase 2 - Core Pages
echo -e "${BLUE}PHASE 2: Core Pages (8 files)${NC}"
echo "--------------------------------------"

FILES_PHASE2=(
    "frontend/web/templates/analytics.html"
    "frontend/web/templates/security_settings.html"
    "frontend/web/templates/index.html"
    "frontend/web/templates/facts.html"
    "frontend/web/templates/plan.html"
    "frontend/web/templates/notifications.html"
    "frontend/web/templates/pending_activation.html"
    "frontend/web/templates/lists.html"
)

check_file() {
    local file=$1
    local phase=$2
    local file_issues=0

    ((total_files++))

    echo ""
    echo "Checking: $file"

    if [ ! -f "$file" ]; then
        echo -e "  ${RED}❌ ERROR: File not found${NC}"
        ((error_files++))
        return
    fi

    # Extract all H1 headers
    h1_headers=$(grep -n '<h1' "$file" || true)
    h2_headers=$(grep -n '<h2' "$file" || true)
    h3_headers=$(grep -n '<h3' "$file" || true)

    # Check H1 headers
    if [ -n "$h1_headers" ]; then
        while IFS= read -r line; do
            line_num=$(echo "$line" | cut -d: -f1)
            content=$(echo "$line" | cut -d: -f2-)

            if ! echo "$content" | grep -q "$H1_PATTERN"; then
                echo -e "  ${RED}⚠️ Line $line_num: H1 missing standard classes${NC}"
                echo "     Found: $(echo "$content" | sed 's/^[[:space:]]*//')"
                echo "     Expected: class=\"$H1_PATTERN ...\""
                ((file_issues++))
                ((total_issues++))
            fi
        done <<< "$h1_headers"
    fi

    # Check H2 headers
    if [ -n "$h2_headers" ]; then
        while IFS= read -r line; do
            line_num=$(echo "$line" | cut -d: -f1)
            content=$(echo "$line" | cut -d: -f2-)

            if ! echo "$content" | grep -q "$H2_PATTERN"; then
                echo -e "  ${YELLOW}⚠️ Line $line_num: H2 missing standard classes${NC}"
                echo "     Found: $(echo "$content" | sed 's/^[[:space:]]*//')"
                echo "     Expected: class=\"$H2_PATTERN ...\""
                ((file_issues++))
                ((total_issues++))
            fi
        done <<< "$h2_headers"
    fi

    # Check H3 headers
    if [ -n "$h3_headers" ]; then
        while IFS= read -r line; do
            line_num=$(echo "$line" | cut -d: -f1)
            content=$(echo "$line" | cut -d: -f2-)

            if ! echo "$content" | grep -q "$H3_PATTERN"; then
                echo -e "  ${YELLOW}⚠️ Line $line_num: H3 missing standard classes${NC}"
                echo "     Found: $(echo "$content" | sed 's/^[[:space:]]*//')"
                echo "     Expected: class=\"$H3_PATTERN ...\""
                ((file_issues++))
                ((total_issues++))
            fi
        done <<< "$h3_headers"
    fi

    # Special checks
    case "$(basename "$file")" in
        "modal_edit_plan.html")
            if ! grep -q "✏️" "$file"; then
                echo -e "  ${RED}⚠️ Missing emoji ✏️ in modal title${NC}"
                ((file_issues++))
                ((total_issues++))
            fi
            ;;
        "modal_transfer.html")
            h4_count=$(grep -c '<h4' "$file" || true)
            if [ "$h4_count" -gt 0 ]; then
                echo -e "  ${GREEN}✓ H4 subsections present (should be untouched)${NC}"
            fi
            ;;
        "plan.html")
            collapse_headers=$(grep -n 'collapse-title' "$file" || true)
            if [ -n "$collapse_headers" ]; then
                while IFS= read -r line; do
                    if echo "$line" | grep -q 'mb-'; then
                        line_num=$(echo "$line" | cut -d: -f1)
                        echo -e "  ${RED}⚠️ Line $line_num: Collapse header should have mb-0${NC}"
                        ((file_issues++))
                        ((total_issues++))
                    fi
                done <<< "$collapse_headers"
            fi
            ;;
        "analytics.html")
            chart_titles=$(grep -n 'Chart Title' "$file" || true)
            if [ -n "$chart_titles" ]; then
                while IFS= read -r line; do
                    line_num=$(echo "$line" | cut -d: -f1)
                    content=$(echo "$line" | cut -d: -f2-)
                    if echo "$content" | grep -q 'text-base' && ! echo "$content" | grep -q 'text-lg sm:text-xl'; then
                        echo -e "  ${YELLOW}⚠️ Line $line_num: Chart title using text-base instead of H2 standard${NC}"
                        ((file_issues++))
                        ((total_issues++))
                    fi
                done <<< "$chart_titles"
            fi
            ;;
    esac

    # Summary for this file
    if [ $file_issues -eq 0 ]; then
        echo -e "  ${GREEN}✅ OK: All headers conform to standard${NC}"
        ((ok_files++))
    else
        echo -e "  ${RED}⚠️ Found $file_issues issue(s)${NC}"
        ((warning_files++))
    fi
}

# Check Phase 2 files
for file in "${FILES_PHASE2[@]}"; do
    check_file "$file" "Phase 2"
done

echo ""
echo -e "${BLUE}PHASE 3: Admin Pages (11 files)${NC}"
echo "--------------------------------------"

FILES_PHASE3=(
    "frontend/web/templates/admin_dashboard.html"
    "frontend/web/templates/admin_import.html"
    "frontend/web/templates/admin_monitoring.html"
    "frontend/web/templates/admin_articles.html"
    "frontend/web/templates/admin_users.html"
    "frontend/web/templates/admin_financial_centers.html"
    "frontend/web/templates/admin_cost_centers.html"
    "frontend/web/templates/admin_stores.html"
    "frontend/web/templates/admin_product_groups.html"
    "frontend/web/templates/admin_logs.html"
    "frontend/web/templates/admin_components_playground.html"
)

for file in "${FILES_PHASE3[@]}"; do
    check_file "$file" "Phase 3"
done

echo ""
echo -e "${BLUE}PHASE 4: Modal/Components (7 files)${NC}"
echo "--------------------------------------"

FILES_PHASE4=(
    "frontend/web/templates/components/modal_transaction.html"
    "frontend/web/templates/components/modal_edit_fact.html"
    "frontend/web/templates/components/modal_plan.html"
    "frontend/web/templates/components/modal_edit_plan.html"
    "frontend/web/templates/components/modal_confirm.html"
    "frontend/web/templates/components/modal_transfer.html"
    "frontend/web/templates/components/mobile_alert.html"
)

for file in "${FILES_PHASE4[@]}"; do
    check_file "$file" "Phase 4"
done

echo ""
echo -e "${BLUE}PHASE 5: Base Template (1 file)${NC}"
echo "--------------------------------------"

check_file "frontend/web/templates/base.html" "Phase 5"

# Final Summary
echo ""
echo "======================================"
echo "SUMMARY"
echo "======================================"
echo ""
echo "Total files checked: $total_files"
echo -e "${GREEN}✅ OK: $ok_files files${NC}"
echo -e "${YELLOW}⚠️ Warnings: $warning_files files${NC}"
echo -e "${RED}❌ Errors: $error_files files${NC}"
echo ""
echo "Total issues found: $total_issues"
echo ""

if [ $total_issues -eq 0 ]; then
    echo -e "${GREEN}🎉 All headers conform to the standard!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️ Standardization review complete. Please fix the issues above.${NC}"
    exit 1
fi

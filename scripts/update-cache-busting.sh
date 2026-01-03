#!/bin/bash
# Comprehensive cache busting script for deployment
# Updates version placeholders in Service Worker AND HTML templates
#
# IMPORTANT: Repository keeps PLACEHOLDER tokens, deployment replaces them
# This script is ONLY run in /opt/budget during deploy.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SW_FILE="sw.min.js"  # Process MINIFIED version (after npm run build)
SW_FILE_GZ="sw.min.js.gz"  # Gzip version to update
TEMPLATES_DIR="frontend/web/templates"

# Use CACHE_VERSION from environment (set by deploy.sh)
# Fallback: generate new version if not set (for manual runs)
if [[ -n "${CACHE_VERSION:-}" ]]; then
    NEW_VERSION="$CACHE_VERSION"
    echo -e "${YELLOW}[INFO]${NC} Using CACHE_VERSION from environment: ${BLUE}${NEW_VERSION}${NC}"
else
    TIMESTAMP=$(date +"%Y%m%d_%H%M")
    NEW_VERSION="v${TIMESTAMP}"
    echo -e "${YELLOW}[WARNING]${NC} CACHE_VERSION not set, generating new version: ${BLUE}${NEW_VERSION}${NC}"
    echo -e "${YELLOW}[WARNING]${NC} This may cause version mismatch with sw.min.js!"
fi

# Counters
total_files=0
updated_files=0
failed_files=0

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Cache Busting Version Update                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}[INFO]${NC} New version: ${BLUE}${NEW_VERSION}${NC}"
echo ""

# Function: Validate Service Worker version (v6.8.0+)
# NOTE: sw.min.js version is injected by minify.sh during npm run build
# This function only VALIDATES, does NOT modify sw.min.js
validate_service_worker() {
    echo -e "${YELLOW}[STEP 1/2]${NC} Validating Service Worker version..."

    if [ ! -f "$SW_FILE" ]; then
        echo -e "${RED}[ERROR]${NC} $SW_FILE not found!"
        return 1
    fi

    # Check if version matches expected NEW_VERSION
    if grep -qE "(const )?CACHE_VERSION[[:space:]]*=[[:space:]]*[\"']${NEW_VERSION}[\"'][;,]" "$SW_FILE"; then
        echo -e "  ${GREEN}✓${NC} Service Worker version correct: ${BLUE}${NEW_VERSION}${NC}"
        return 0
    else
        # Show what version is actually present
        local actual_version
        actual_version=$(grep -o 'CACHE_VERSION="[^"]*"' "$SW_FILE" | head -1 || echo "NOT FOUND")
        echo -e "  ${RED}✗${NC} Service Worker version mismatch!"
        echo -e "  ${YELLOW}Expected:${NC} ${BLUE}${NEW_VERSION}${NC}"
        echo -e "  ${YELLOW}Actual:${NC}   ${RED}${actual_version}${NC}"
        echo -e ""
        echo -e "  ${YELLOW}[INFO]${NC} This usually means:"
        echo -e "    - npm run build failed or was skipped"
        echo -e "    - minify.sh did not run successfully"
        echo -e "    - CACHE_VERSION env variable not passed to build"
        return 1
    fi
}

# Function: Update HTML templates
update_html_templates() {
    echo ""
    echo -e "${YELLOW}[STEP 2/2]${NC} Updating HTML templates..."

    if [ ! -d "$TEMPLATES_DIR" ]; then
        echo -e "${RED}[ERROR]${NC} Templates directory not found: $TEMPLATES_DIR"
        return 1
    fi

    # Find all HTML files with PLACEHOLDER
    local files_with_placeholder
    files_with_placeholder=$(find "$TEMPLATES_DIR" -name "*.html" -type f -exec grep -l "PLACEHOLDER" {} \; 2>/dev/null || true)

    if [ -z "$files_with_placeholder" ]; then
        echo -e "  ${GREEN}✓${NC} No PLACEHOLDER tokens found (already updated or not needed)"
        return 0
    fi

    # Count files
    total_files=$(echo "$files_with_placeholder" | wc -l)
    echo -e "  ${YELLOW}[INFO]${NC} Found ${BLUE}${total_files}${NC} files with PLACEHOLDER tokens"
    echo ""

    # Process each file
    while IFS= read -r file; do
        if [ -z "$file" ]; then
            continue
        fi

        local filename=$(basename "$file")

        # Backup
        cp "$file" "${file}.bak"

        # Replace all PLACEHOLDER tokens with new version
        # Supports patterns:
        # - ?v=PLACEHOLDER or &v=PLACEHOLDER
        # - ?version=PLACEHOLDER or &version=PLACEHOLDER
        # Using two separate patterns for clarity and reliability
        sed -i.tmp \
          -e "s/\([?&]\)v=PLACEHOLDER/\1v=${NEW_VERSION}/g" \
          -e "s/\([?&]\)version=PLACEHOLDER/\1version=${NEW_VERSION}/g" \
          "$file"
        rm -f "${file}.tmp"

        # Verify replacement (no PLACEHOLDER should remain)
        if grep -q "PLACEHOLDER" "$file" 2>/dev/null; then
            echo -e "  ${RED}✗${NC} ${filename} - FAILED (PLACEHOLDER still present)"
            mv "${file}.bak" "$file"
            ((failed_files++))
        else
            echo -e "  ${GREEN}✓${NC} ${filename} - updated"
            rm -f "${file}.bak"
            ((updated_files++))
        fi
    done <<< "$files_with_placeholder"

    echo ""

    # Summary
    if [ $failed_files -eq 0 ]; then
        echo -e "  ${GREEN}[SUCCESS]${NC} All ${updated_files} files updated successfully"
        return 0
    else
        echo -e "  ${RED}[WARNING]${NC} ${failed_files} files failed, ${updated_files} succeeded"
        return 1
    fi
}

# Function: Final validation
validate_no_placeholders() {
    echo ""
    echo -e "${YELLOW}[VALIDATION]${NC} Checking for remaining PLACEHOLDER tokens..."

    local placeholder_count=0

    # Check Service Worker for unreplaced PLACEHOLDER in CACHE_VERSION assignment
    # CRITICAL: Check for actual PLACEHOLDER token, not CACHE_VERSION_PLACEHOLDER
    # sw.js uses: const CACHE_VERSION = 'PLACEHOLDER'
    if [ -f "$SW_FILE" ]; then
        if grep -q "CACHE_VERSION.*['\"]PLACEHOLDER['\"]" "$SW_FILE" 2>/dev/null; then
            echo -e "  ${RED}✗${NC} Service Worker still contains PLACEHOLDER in CACHE_VERSION"
            # Show actual line for debugging
            local placeholder_line=$(grep -o "CACHE_VERSION.*['\"]PLACEHOLDER['\"]" "$SW_FILE" | head -1)
            echo -e "  ${YELLOW}Found:${NC} ${placeholder_line}"
            ((placeholder_count++))
        fi
    fi

    # Check HTML templates
    if [ -d "$TEMPLATES_DIR" ]; then
        local html_placeholders
        html_placeholders=$(grep -r "PLACEHOLDER" "$TEMPLATES_DIR"/*.html 2>/dev/null | wc -l)

        if [ "$html_placeholders" -gt 0 ]; then
            echo -e "  ${RED}✗${NC} Found ${html_placeholders} PLACEHOLDER tokens in HTML templates"
            echo ""
            echo -e "  ${YELLOW}Files with PLACEHOLDER:${NC}"
            grep -l "PLACEHOLDER" "$TEMPLATES_DIR"/*.html 2>/dev/null | sed 's|.*/|    - |'
            ((placeholder_count += html_placeholders))
        fi
    fi

    echo ""

    if [ $placeholder_count -eq 0 ]; then
        echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║  ✓ VALIDATION PASSED - All placeholders replaced      ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
        echo ""
        return 0
    else
        echo -e "${RED}╔════════════════════════════════════════════════════════╗${NC}"
        echo -e "${RED}║  ✗ VALIDATION FAILED - ${placeholder_count} placeholders remain          ║${NC}"
        echo -e "${RED}╚════════════════════════════════════════════════════════╝${NC}"
        echo ""
        return 1
    fi
}

# Main execution
main() {
    # Step 1: Validate Service Worker (v6.8.0+)
    # NOTE: sw.min.js is already updated by minify.sh during npm run build
    # We only validate that the version is correct
    if ! validate_service_worker; then
        echo -e "${RED}[CRITICAL]${NC} Service Worker validation failed"
        echo -e "${YELLOW}[INFO]${NC} This is likely caused by minify.sh not running correctly"
        exit 1
    fi

    # Step 2: Update HTML templates
    if ! update_html_templates; then
        echo -e "${YELLOW}[WARNING]${NC} Some HTML templates failed to update"
    fi

    # Step 3: Final validation
    if ! validate_no_placeholders; then
        echo -e "${YELLOW}[WARNING]${NC} Validation found remaining PLACEHOLDER tokens"
        echo -e "${YELLOW}[INFO]${NC} This may indicate:"
        echo -e "  - File permissions issues (chmod needed)"
        echo -e "  - sed/perl not installed"
        echo -e "  - New template files not handled by script"
        echo ""
        exit 1
    fi

    echo -e "${GREEN}[SUCCESS]${NC} Cache busting complete!"
    echo -e "${YELLOW}[INFO]${NC} Version: ${BLUE}${NEW_VERSION}${NC}"
    echo ""
}

# Run main function
main "$@"

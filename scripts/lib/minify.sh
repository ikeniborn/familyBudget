#!/usr/bin/env bash

################################################################################
# Minification Script for Family Budget Project
#
# Description:
#   Автоматическая минификация JS и CSS файлов для production deployment.
#   Использует Terser для JS и cssnano для CSS минификации.
#   Source maps отключены для production (security и performance).
#
# Usage:
#   ./minify.sh js       # Минифицировать только JS
#   ./minify.sh css      # Минифицировать только CSS
#   ./minify.sh all      # Минифицировать все (по умолчанию)
#   ./minify.sh validate # Проверить синтаксис минифицированных файлов
#
# Dependencies:
#   - terser (npm install terser)
#   - cssnano-cli (npm install cssnano-cli)
#   - node (>=18.0.0)
#
# Author: Family Budget Team
# Version: 1.0.0
# Date: 2025-11-05
################################################################################

set -uo pipefail  # Removed -e flag to allow graceful error handling

# Prefer isolated npm environment if exists
# This ensures terser/postcss binaries are found in .npm-isolated/node_modules/.bin
if [[ -d ".npm-isolated/node_modules/.bin" ]]; then
    export PATH="$PWD/.npm-isolated/node_modules/.bin:$PATH"
fi

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Directories to minify
readonly FRONTEND_DIR="frontend"
readonly WEB_JS_DIR="${FRONTEND_DIR}/web/static/js"
readonly WEB_CSS_DIR="${FRONTEND_DIR}/web/static/css"
readonly WEB_WORKERS_DIR="${WEB_JS_DIR}/workers"  # NEW: Web Workers directory
readonly WEBAPP_JS_DIR="${FRONTEND_DIR}/webapp/static/js"
readonly WEBAPP_CSS_DIR="${FRONTEND_DIR}/webapp/static/css"
readonly SHARED_JS_DIR="${FRONTEND_DIR}/shared/static/js"
readonly SHARED_CSS_DIR="${FRONTEND_DIR}/shared/static/css"

# Counters
MINIFIED_JS_COUNT=0
MINIFIED_CSS_COUNT=0
ERRORS_COUNT=0

################################################################################
# Utility Functions
################################################################################

print_message() {
    local level="$1"
    shift
    local message="$*"

    case "$level" in
        info)
            echo -e "${BLUE}[INFO]${NC} $message"
            ;;
        success)
            echo -e "${GREEN}[SUCCESS]${NC} $message"
            ;;
        warning)
            echo -e "${YELLOW}[WARNING]${NC} $message"
            ;;
        error)
            echo -e "${RED}[ERROR]${NC} $message"
            ;;
    esac
}

check_prerequisites() {
    local mode="$1"

    print_message info "Checking prerequisites for mode: $mode..."

    # Check if node is installed
    if ! command -v node &> /dev/null; then
        print_message error "Node.js is not installed. Please install Node.js >= 18.0.0"
        return 1
    fi

    # Check if terser is available (only for js/all modes)
    if [[ "$mode" == "js" || "$mode" == "all" ]]; then
        if ! command -v terser &> /dev/null; then
            print_message error "Terser is not installed or not in PATH"
            print_message error "Expected location: .npm-isolated/node_modules/.bin/terser"
            return 1
        fi
    fi

    # Check if postcss is available (only for css/all modes)
    if [[ "$mode" == "css" || "$mode" == "all" ]]; then
        if ! command -v postcss &> /dev/null; then
            print_message error "postcss-cli is not installed or not in PATH"
            print_message error "Expected location: .npm-isolated/node_modules/.bin/postcss"
            print_message error "Current PATH: $PATH"
            return 1
        fi
    fi

    print_message success "All prerequisites satisfied for mode: $mode"
    return 0
}

################################################################################
# JavaScript Minification
################################################################################

minify_js_file() {
    local input_file="$1"
    local output_file="${input_file%.js}.min.js"

    print_message info "Minifying: $input_file"

    # Try to minify with error capture and 60s timeout
    # ARCHITECTURE IMPROVEMENT (2025-11-08):
    # - Added timeout to prevent zombie processes from hanging builds
    # - 60 seconds should be sufficient for any JS file in this project
    # OPTIMIZATION (2025-12-26):
    # - Use .terserrc.json for advanced minification (3-8% better compression)
    # - 3-pass compression, toplevel mangling, unsafe optimizations
    local terser_output
    terser_output=$(timeout 60s terser "$input_file" \
        --config-file .terserrc.json \
        --output "$output_file" 2>&1)
    local terser_exit=$?

    # Handle timeout (exit code 124)
    if [[ $terser_exit -eq 124 ]]; then
        print_message error "Timeout: $input_file (exceeded 60 seconds)"
        ((ERRORS_COUNT++))
        return 1
    fi

    if [[ $terser_exit -eq 0 ]] && [[ -f "$output_file" ]]; then
        # Success - calculate size reduction
        local original_size=$(stat -c%s "$input_file" 2>/dev/null || stat -f%z "$input_file" 2>/dev/null)
        local minified_size=$(stat -c%s "$output_file" 2>/dev/null || stat -f%z "$output_file" 2>/dev/null)

        if [[ $original_size -gt 0 ]]; then
            local reduction=$((100 - (minified_size * 100 / original_size)))
            print_message success "✓ $output_file (${reduction}% smaller)"
        else
            print_message success "✓ $output_file"
        fi

        ((MINIFIED_JS_COUNT++))
        return 0
    else
        # Failed - show error details
        print_message error "Failed to minify: $input_file"
        if [[ -n "$terser_output" ]]; then
            echo "$terser_output" | head -3 >&2
        fi

        # Cleanup partial files
        rm -f "$output_file"
        ((ERRORS_COUNT++))
        return 1
    fi
}

minify_js_directory() {
    local dir="$1"

    if [[ ! -d "$dir" ]]; then
        print_message warning "Directory not found: $dir (skipping)"
        return 0
    fi

    print_message info "Processing JS directory: $dir"

    # Count files first for debugging
    local file_count=$(find "$dir" -type f -name "*.js" ! -name "*.min.js" ! -path "*/vendor/*" | wc -l)
    print_message info "Found $file_count JS files to minify in $dir"

    # Find all .js files (excluding .min.js and vendor/)
    while IFS= read -r -d '' file; do
        # Skip already minified files
        if [[ "$file" =~ \.min\.js$ ]]; then
            continue
        fi

        # Skip vendor directory
        if [[ "$file" =~ /vendor/ ]]; then
            continue
        fi

        minify_js_file "$file"
    done < <(find "$dir" -type f -name "*.js" ! -name "*.min.js" -print0)

    print_message info "Finished processing $dir"
}

minify_service_worker() {
    # Minify Service Worker (sw.js) and create gzip pre-compressed version
    # This is handled separately because:
    # 1. sw.js is in project root (not in frontend/)
    # 2. We need gzip pre-compressed version for nginx gzip_static

    local sw_source="sw.js"
    local sw_minified="sw.min.js"
    local sw_gzip="${sw_minified}.gz"

    if [[ ! -f "$sw_source" ]]; then
        print_message warning "Service Worker not found: $sw_source (skipping)"
        return 0
    fi

    print_message info "→ Processing Service Worker..."

    # CRITICAL: Get CACHE_VERSION BEFORE minification
    # terser optimizes conditions and hardcodes fallback value if PLACEHOLDER not replaced first
    # Use CACHE_VERSION from environment if set (passed by deploy.sh)
    # Otherwise try reading from .cache-version file (written by deploy.sh)
    # Otherwise generate new version (for local builds)
    local cache_version="${CACHE_VERSION:-}"

    # DEBUG: Log environment variable state
    print_message info "DEBUG: CACHE_VERSION env var = '${CACHE_VERSION:-<not set>}'"

    if [[ -z "$cache_version" ]]; then
        # Try reading from .cache-version file (deploy.sh writes this)
        if [[ -f ".cache-version" ]]; then
            # Check if file is fresh (modified within last 5 minutes)
            # This prevents using stale version if file was not updated due to permission issues
            local file_age_seconds=0
            if [[ "$OSTYPE" == "darwin"* ]]; then
                # macOS
                file_age_seconds=$(( $(date +%s) - $(stat -f %m ".cache-version") ))
            else
                # Linux
                file_age_seconds=$(( $(date +%s) - $(stat -c %Y ".cache-version") ))
            fi

            if [[ $file_age_seconds -lt 300 ]]; then
                # File is fresh (< 5 minutes old) - safe to use
                cache_version=$(cat ".cache-version" | tr -d '\n\r')
                print_message info "CACHE_VERSION read from .cache-version file: $cache_version (deployment, ${file_age_seconds}s old)"
            else
                # File is stale (> 5 minutes old) - regenerate instead
                print_message warning ".cache-version file is stale (${file_age_seconds}s old) - generating new version"
                cache_version=$(date -u +"%Y%m%d_%H%M" | sed 's/^/v/')
                print_message warning "Generated fresh CACHE_VERSION: $cache_version"
            fi
        else
            # Fallback: generate locally
            cache_version=$(date -u +"%Y%m%d_%H%M" | sed 's/^/v/')
            print_message warning "CACHE_VERSION not found in env or file - generating locally: $cache_version"
            print_message warning "This should NOT happen during deployment (only local builds)"
        fi
    else
        print_message info "Using CACHE_VERSION from environment: $cache_version (deployment)"
    fi

    # CRITICAL: Prepare sw.js with CACHE_VERSION BEFORE minification
    # Copy sw.js → sw.prepared.js with PLACEHOLDER replaced
    # This prevents terser from hardcoding fallback version
    local sw_prepared="sw.prepared.js"
    cp "$sw_source" "$sw_prepared"

    print_message info "Replacing PLACEHOLDER with $cache_version in $sw_prepared"

    # Replace PLACEHOLDER with actual cache version in sw.prepared.js
    # Strategy: Replace CACHE_VERSION = 'PLACEHOLDER' with actual version
    # This MUST happen BEFORE terser minification to prevent optimization issues
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS sed requires empty string for in-place edit
        sed -i '' \
            -e "s/const CACHE_VERSION[[:space:]]*=[[:space:]]*['\"]PLACEHOLDER['\"]/const CACHE_VERSION = '${cache_version}'/g" \
            "$sw_prepared"
    else
        # Linux sed
        sed -i \
            -e "s/const CACHE_VERSION[[:space:]]*=[[:space:]]*['\"]PLACEHOLDER['\"]/const CACHE_VERSION = '${cache_version}'/g" \
            "$sw_prepared"
    fi

    # CRITICAL: Verify PLACEHOLDER was replaced in sw.prepared.js
    if grep -q "PLACEHOLDER" "$sw_prepared"; then
        print_message error "CRITICAL: $sw_prepared still contains PLACEHOLDER after sed replacement!"
        print_message error "This means the sed pattern did not match all occurrences."
        print_message error ""
        print_message error "Debug info:"
        print_message error "  CACHE_VERSION from env: ${CACHE_VERSION:-<not set>}"
        print_message error "  cache_version variable: $cache_version"
        print_message error ""
        print_message error "All PLACEHOLDER occurrences in $sw_prepared:"
        grep -n "PLACEHOLDER" "$sw_prepared" | head -20 || true
        print_message error ""
        print_message error "DEPLOYMENT BLOCKED - Service Worker would fail"
        rm -f "$sw_prepared"
        return 1
    else
        print_message success "✓ PLACEHOLDER replaced with $cache_version in $sw_prepared"
    fi

    # Minify sw.prepared.js (with CACHE_VERSION already injected) → sw.min.js
    print_message info "Minifying: $sw_prepared → $sw_minified"
    local terser_output
    terser_output=$(timeout 60s terser "$sw_prepared" \
        --config-file .terserrc.json \
        --output "$sw_minified" 2>&1)
    local terser_exit=$?

    # Clean up temporary file
    rm -f "$sw_prepared"

    if [[ $terser_exit -eq 0 ]] && [[ -f "$sw_minified" ]]; then
        print_message success "✓ terser minification complete"

        local original_size=$(stat -c%s "$sw_source" 2>/dev/null || stat -f%z "$sw_source" 2>/dev/null)
        local minified_size=$(stat -c%s "$sw_minified" 2>/dev/null || stat -f%z "$sw_minified" 2>/dev/null)
        local reduction=$((100 - (minified_size * 100 / original_size)))
        print_message success "✓ $sw_minified (${reduction}% smaller: ${original_size}B → ${minified_size}B)"
        ((MINIFIED_JS_COUNT++))

        # Create gzip pre-compressed version for nginx gzip_static
        if command -v gzip &> /dev/null; then
            gzip -9 -k -f "$sw_minified"
            if [[ -f "$sw_gzip" ]]; then
                local gzip_size=$(stat -c%s "$sw_gzip" 2>/dev/null || stat -f%z "$sw_gzip" 2>/dev/null)
                local gzip_reduction=$((100 - (gzip_size * 100 / original_size)))
                print_message success "✓ $sw_gzip (${gzip_reduction}% smaller: ${original_size}B → ${gzip_size}B)"
            fi
        else
            print_message warning "gzip not found - skipping pre-compressed version"
        fi
    else
        print_message error "Failed to minify Service Worker: $sw_source"
        if [[ -n "$terser_output" ]]; then
            echo "$terser_output" | head -3 >&2
        fi
        ((ERRORS_COUNT++))
        return 1
    fi
}

minify_all_js() {
    echo "┌────────────────────────────────────────────────────────────────────────────┐"
    print_message info "│ 📦 JavaScript Minification"
    echo "└────────────────────────────────────────────────────────────────────────────┘"
    echo

    print_message info "→ Processing web/ directory..."
    minify_js_directory "$WEB_JS_DIR"
    print_message info "✓ Completed web/ directory: $MINIFIED_JS_COUNT files so far"
    echo

    print_message info "→ Processing webapp/ directory..."
    minify_js_directory "$WEBAPP_JS_DIR"
    print_message info "✓ Completed webapp/ directory: $MINIFIED_JS_COUNT files so far"
    echo

    print_message info "→ Processing shared/ directory..."
    minify_js_directory "$SHARED_JS_DIR"
    print_message info "✓ Completed shared/ directory: $MINIFIED_JS_COUNT files so far"
    echo

    # Minify Web Workers (NEW: added for Phase 1)
    if [[ -d "$WEB_WORKERS_DIR" ]]; then
        print_message info "→ Processing workers/ directory..."
        minify_js_directory "$WEB_WORKERS_DIR"
        print_message info "✓ Completed workers/ directory: $MINIFIED_JS_COUNT files so far"
        echo
    fi

    # Minify Service Worker (root level)
    minify_service_worker
    echo

    print_message success "✅ JavaScript minification complete: $MINIFIED_JS_COUNT files"
}

################################################################################
# CSS Minification
################################################################################

minify_css_file() {
    local input_file="$1"
    local output_file="${input_file%.css}.min.css"

    print_message info "Minifying: $input_file"

    # Use postcss-cli with cssnano plugin (configured in postcss.config.js) with 60s timeout
    # ARCHITECTURE IMPROVEMENT (2025-11-08):
    # - Added timeout to prevent zombie processes from hanging builds
    # - 60 seconds should be sufficient for any CSS file in this project
    local postcss_output
    if postcss_output=$(timeout 60s postcss "$input_file" -o "$output_file" --no-map 2>&1); then
        local original_size=$(stat -c%s "$input_file" 2>/dev/null || stat -f%z "$input_file" 2>/dev/null)
        local minified_size=$(stat -c%s "$output_file" 2>/dev/null || stat -f%z "$output_file" 2>/dev/null)
        local reduction=$((100 - (minified_size * 100 / original_size)))

        print_message success "✓ $output_file (${reduction}% smaller)"
        ((MINIFIED_CSS_COUNT++))
        return 0
    else
        local postcss_exit=$?

        # Handle timeout (exit code 124)
        if [[ $postcss_exit -eq 124 ]]; then
            print_message error "Timeout: $input_file (exceeded 60 seconds)"
        else
            print_message error "Failed to minify: $input_file"
            # Show actual error from postcss/cssnano
            if [[ -n "$postcss_output" ]]; then
                echo "$postcss_output" | head -5 | while IFS= read -r line; do
                    print_message error "  $line"
                done
            fi
        fi

        ((ERRORS_COUNT++))
        return 1
    fi
}

minify_css_directory() {
    local dir="$1"

    if [[ ! -d "$dir" ]]; then
        print_message warning "Directory not found: $dir (skipping)"
        return 0
    fi

    print_message info "Processing CSS directory: $dir"

    # Find all .css files (excluding .min.css and vendor/)
    while IFS= read -r -d '' file; do
        # Skip already minified files
        if [[ "$file" =~ \.min\.css$ ]]; then
            continue
        fi

        # Skip vendor directory
        if [[ "$file" =~ /vendor/ ]]; then
            continue
        fi

        minify_css_file "$file"
    done < <(find "$dir" -type f -name "*.css" ! -name "*.min.css" -print0)
}

minify_all_css() {
    echo "┌────────────────────────────────────────────────────────────────────────────┐"
    print_message info "│ 🎨 CSS Minification"
    echo "└────────────────────────────────────────────────────────────────────────────┘"
    echo

    print_message info "→ Processing web/static/css/ directory..."
    minify_css_directory "$WEB_CSS_DIR"
    echo

    print_message info "→ Processing webapp/static/css/ directory..."
    minify_css_directory "$WEBAPP_CSS_DIR"
    echo

    print_message info "→ Processing shared/static/css/ directory..."
    minify_css_directory "$SHARED_CSS_DIR"
    echo

    print_message success "✅ CSS minification complete: $MINIFIED_CSS_COUNT files"
}

################################################################################
# Validation
################################################################################

validate_minified_files() {
    print_message info "=== Validating Minified Files ==="

    local validation_errors=0

    # Validate all .min.js files
    while IFS= read -r -d '' file; do
        if ! terser --parse "$file" &> /dev/null; then
            print_message error "Invalid syntax: $file"
            ((validation_errors++))
        fi
    done < <(find "$WEB_JS_DIR" "$WEBAPP_JS_DIR" "$SHARED_JS_DIR" -type f -name "*.min.js" ! -path "*/vendor/*" -print0 2>/dev/null)

    if [[ $validation_errors -eq 0 ]]; then
        print_message success "All minified files are valid"
        return 0
    else
        print_message error "Found $validation_errors invalid minified files"
        return 1
    fi
}

################################################################################
# Main Function
################################################################################

main() {
    local mode="${1:-all}"

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message info "🔧 Minification Script v1.0.0"
    print_message info "Mode: $mode"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo

    # Check prerequisites
    if ! check_prerequisites "$mode"; then
        exit 1
    fi

    echo

    case "$mode" in
        js)
            minify_all_js
            ;;
        css)
            minify_all_css
            ;;
        all)
            minify_all_js
            echo
            minify_all_css
            ;;
        validate)
            validate_minified_files
            exit $?
            ;;
        *)
            print_message error "Invalid mode: $mode"
            print_message info "Usage: $0 {js|css|all|validate}"
            exit 1
            ;;
    esac

    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message info "📊 Minification Summary"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message info "JavaScript files minified: $MINIFIED_JS_COUNT"
    print_message info "CSS files minified: $MINIFIED_CSS_COUNT"

    if [[ $ERRORS_COUNT -gt 0 ]]; then
        print_message warning "⚠️  Errors encountered: $ERRORS_COUNT (continuing anyway)"
        print_message info "Deployment will continue with unminified versions of failed files"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 0  # Don't fail deployment for minification errors
    else
        print_message success "✅ Minification completed successfully!"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        exit 0
    fi
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

#!/bin/bash

################################################################################
# NPM Environment Validation Script
################################################################################
#
# Purpose: Validates npm isolated environment before deployment
# Usage: bash scripts/lib/check_npm_env.sh [deployment_directory]
# Exit Codes:
#   0 - All checks passed
#   1 - One or more checks failed
#
################################################################################

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored message
print_message() {
    local type="$1"
    local message="$2"

    case "$type" in
        success)
            echo -e "${GREEN}✓${NC} $message"
            ;;
        error)
            echo -e "${RED}✗${NC} $message"
            ;;
        warning)
            echo -e "${YELLOW}⚠${NC} $message"
            ;;
        info)
            echo -e "ℹ $message"
            ;;
    esac
}

# Main validation function
check_npm_environment() {
    local deployment_dir="${1:-.}"
    local errors=0

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message info "NPM Environment Validation"
    print_message info "Directory: $deployment_dir"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo

    # Check 1: .npm-isolated directory exists
    if [[ ! -d "$deployment_dir/.npm-isolated/node_modules" ]]; then
        print_message error ".npm-isolated/node_modules NOT FOUND"
        print_message error "Location: $deployment_dir/.npm-isolated/node_modules"
        ((errors++))
    else
        print_message success ".npm-isolated/node_modules exists"
    fi

    # Check 2: Critical packages installed
    local critical_packages=("terser" "cssnano" "postcss" "postcss-cli" "tailwindcss" "daisyui")

    for pkg in "${critical_packages[@]}"; do
        if [[ ! -d "$deployment_dir/.npm-isolated/node_modules/$pkg" ]]; then
            print_message error "Missing package: $pkg"
            ((errors++))
        else
            print_message success "Package installed: $pkg"
        fi
    done

    # Check 3: Tailwind CSS version validation
    local tw_package_json="$deployment_dir/.npm-isolated/node_modules/tailwindcss/package.json"
    local project_package_json="$deployment_dir/package.json"

    if [[ -f "$tw_package_json" && -f "$project_package_json" ]]; then
        # Check if jq is available
        if command -v jq &> /dev/null; then
            local tw_version=$(jq -r '.version' "$tw_package_json" 2>/dev/null)
            local expected_tw=$(jq -r '.devDependencies.tailwindcss' "$project_package_json" 2>/dev/null)

            if [[ "$tw_version" != "$expected_tw" ]]; then
                print_message error "Tailwind CSS version mismatch: $tw_version (expected: $expected_tw)"
                ((errors++))
            else
                print_message success "Tailwind CSS version: $tw_version"
            fi
        else
            print_message warning "jq not found - skipping version validation"
        fi
    else
        print_message warning "Cannot validate Tailwind CSS version (package.json not found)"
    fi

    # Check 4: Executable files in .bin/
    local bin_dir="$deployment_dir/.npm-isolated/node_modules/.bin"
    local executables=("terser" "postcss" "tailwindcss")

    for exe in "${executables[@]}"; do
        if [[ ! -x "$bin_dir/$exe" ]]; then
            print_message error "Executable not found or not executable: $exe"
            print_message error "Expected location: $bin_dir/$exe"
            ((errors++))
        else
            print_message success "Executable found: $exe"
        fi
    done

    # Check 5: .npmrc configuration
    if [[ -f "$deployment_dir/.npm-isolated/.npmrc" ]]; then
        if grep -q "production=false" "$deployment_dir/.npm-isolated/.npmrc"; then
            print_message success ".npmrc configured correctly (production=false)"
        else
            print_message warning ".npmrc missing 'production=false' setting"
        fi
    else
        print_message warning ".npmrc not found in .npm-isolated/"
    fi

    # Check 6: Critical nested dependencies (browserslist → node-releases)
    # Issue: Symlinked node_modules breaks nested require() paths
    # This file is loaded by browserslist (used by Tailwind CSS PostCSS pipeline)
    local node_releases_file="$deployment_dir/.npm-isolated/node_modules/node-releases/data/processed/envs.json"
    if [[ ! -f "$node_releases_file" ]]; then
        print_message error "Critical dependency file missing: node-releases/data/processed/envs.json"
        print_message error "This indicates corrupted npm installation or missing transitive dependency"
        print_message error "Expected location: $node_releases_file"
        ((errors++))
    else
        print_message success "Critical nested dependencies verified (node-releases)"
    fi

    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [[ $errors -gt 0 ]]; then
        print_message error "VALIDATION FAILED: $errors errors found"
        echo
        print_message info "Fix by running:"
        print_message info "  cd ~/familyBudget"
        print_message info "  sudo ./install.sh"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 1
    else
        print_message success "All checks passed - npm environment is ready"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 0
    fi
}

# Run validation if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_npm_environment "$@"
fi

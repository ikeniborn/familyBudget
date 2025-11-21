#!/bin/bash
#
# Family Budget - npm Environment Diagnostic Script
#
# This script diagnoses why tailwindcss 4.1.17 is installed instead of 3.4.15
#
# Usage: sudo bash scripts/diagnose_npm_issue.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "════════════════════════════════════════════════════════════════"
echo "  npm Environment Diagnostic - Family Budget"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Track issues found
ISSUES_FOUND=0

# Determine repository directory (works with sudo)
if [[ -n "$SUDO_USER" ]]; then
    REPO_DIR="/home/$SUDO_USER/familyBudget"
else
    REPO_DIR="$HOME/familyBudget"
fi

if [[ ! -d "$REPO_DIR/.git" ]]; then
    echo -e "${RED}ERROR:${NC} Repository not found at $REPO_DIR"
    echo "Expected location: /home/USERNAME/familyBudget"
    exit 1
fi

# Check 1: Verify commit 8aafae99 is applied
echo -e "${BLUE}[1/7]${NC} Checking if fix commit is applied..."
cd "$REPO_DIR"
LATEST_COMMIT=$(git log -1 --oneline deploy.sh | cut -d' ' -f1)
if [[ "$LATEST_COMMIT" == "8aafae99" ]] || git log --oneline deploy.sh | head -5 | grep -q "8aafae99"; then
    echo -e "${GREEN}✓${NC} Commit 8aafae99 (cp -f fix) is present"
else
    echo -e "${RED}✗${NC} Commit 8aafae99 NOT found in deploy.sh history"
    echo "   Latest commit: $LATEST_COMMIT"
    echo "   ${YELLOW}ACTION NEEDED: git pull origin dev${NC}"
    ((ISSUES_FOUND++))
fi
echo ""

# Check 2: Verify jq is installed
echo -e "${BLUE}[2/7]${NC} Checking jq installation..."
if command -v jq &> /dev/null; then
    JQ_VERSION=$(jq --version)
    echo -e "${GREEN}✓${NC} jq is installed ($JQ_VERSION)"
else
    echo -e "${RED}✗${NC} jq is NOT installed"
    echo "   ${YELLOW}ACTION NEEDED: sudo apt install -y jq${NC}"
    ((ISSUES_FOUND++))
fi
echo ""

# Check 3: Check tailwindcss version in .npm-isolated
echo -e "${BLUE}[3/7]${NC} Checking tailwindcss version in .npm-isolated..."
if [[ -f "/opt/budget/.npm-isolated/node_modules/tailwindcss/package.json" ]]; then
    if command -v jq &> /dev/null; then
        ACTUAL_VERSION=$(sudo jq -r '.version' /opt/budget/.npm-isolated/node_modules/tailwindcss/package.json)
        EXPECTED_VERSION=$(jq -r '.devDependencies.tailwindcss' /opt/budget/package.json | tr -d '^~')

        if [[ "$ACTUAL_VERSION" == "$EXPECTED_VERSION" ]]; then
            echo -e "${GREEN}✓${NC} tailwindcss version is correct: $ACTUAL_VERSION"
        else
            echo -e "${RED}✗${NC} tailwindcss version MISMATCH"
            echo "   Actual:   $ACTUAL_VERSION"
            echo "   Expected: $EXPECTED_VERSION"
            echo "   ${YELLOW}ACTION NEEDED: Reinstall packages${NC}"
            ((ISSUES_FOUND++))
        fi
    else
        echo -e "${YELLOW}⚠${NC} Cannot check version (jq not installed)"
    fi
else
    echo -e "${RED}✗${NC} tailwindcss not found in .npm-isolated/node_modules"
    echo "   ${YELLOW}ACTION NEEDED: Reinstall packages${NC}"
    ((ISSUES_FOUND++))
fi
echo ""

# Check 4: Compare lockfiles
echo -e "${BLUE}[4/7]${NC} Comparing package-lock.json files..."
if [[ -f "/opt/budget/package-lock.json" ]] && [[ -f "/opt/budget/.npm-isolated/package-lock.json" ]]; then
    if sudo cmp -s "/opt/budget/package-lock.json" "/opt/budget/.npm-isolated/package-lock.json"; then
        echo -e "${GREEN}✓${NC} Lockfiles are identical"
    else
        echo -e "${YELLOW}⚠${NC} Lockfiles are DIFFERENT"
        echo "   Repository: /opt/budget/package-lock.json"
        echo "   Isolated:   /opt/budget/.npm-isolated/package-lock.json"
        echo "   ${YELLOW}This may be OK if packages were recently updated${NC}"

        # Check modification times
        REPO_MTIME=$(stat -c '%Y' /opt/budget/package-lock.json)
        ISO_MTIME=$(sudo stat -c '%Y' /opt/budget/.npm-isolated/package-lock.json)

        if [[ $ISO_MTIME -lt $REPO_MTIME ]]; then
            echo -e "   ${RED}✗${NC} Isolated lockfile is OLDER than repository lockfile"
            echo "   ${YELLOW}ACTION NEEDED: Reinstall packages${NC}"
            ((ISSUES_FOUND++))
        fi
    fi
else
    echo -e "${RED}✗${NC} One or both lockfiles are missing"
    ((ISSUES_FOUND++))
fi
echo ""

# Check 5: Check npm cache size
echo -e "${BLUE}[5/7]${NC} Checking npm cache..."
if [[ -d "/root/.npm/_cache" ]]; then
    CACHE_SIZE=$(sudo du -sh /root/.npm/_cache 2>/dev/null | cut -f1)
    echo -e "${YELLOW}⚠${NC} npm cache exists: $CACHE_SIZE"
    echo "   Location: /root/.npm/_cache"
    echo "   ${YELLOW}Consider cleaning if issues persist: sudo npm cache clean --force${NC}"
else
    echo -e "${GREEN}✓${NC} npm cache is clean"
fi
echo ""

# Check 6: Test tailwindcss executable
echo -e "${BLUE}[6/7]${NC} Testing tailwindcss executable..."
if [[ -f "/opt/budget/.npm-isolated/node_modules/.bin/tailwindcss" ]]; then
    cd /opt/budget
    export PATH="/opt/budget/.npm-isolated/node_modules/.bin:$PATH"
    export NODE_PATH="/opt/budget/.npm-isolated/node_modules"

    if timeout 5s tailwindcss --help &> /dev/null; then
        echo -e "${GREEN}✓${NC} tailwindcss executable works"
    else
        echo -e "${RED}✗${NC} tailwindcss executable FAILS"
        echo "   ${YELLOW}ACTION NEEDED: Reinstall packages${NC}"
        ((ISSUES_FOUND++))
    fi
else
    echo -e "${RED}✗${NC} tailwindcss executable not found"
    ((ISSUES_FOUND++))
fi
echo ""

# Check 7: Read latest npm error log
echo -e "${BLUE}[7/7]${NC} Checking latest npm error log..."
LATEST_LOG=$(sudo ls -t /root/.npm/_logs/*-debug-*.log 2>/dev/null | head -1)
if [[ -n "$LATEST_LOG" ]]; then
    echo "   Latest log: $LATEST_LOG"
    echo ""
    echo "   ${BLUE}--- Last 20 lines ---${NC}"
    sudo tail -20 "$LATEST_LOG"
    echo ""

    # Check for specific error
    if sudo grep -q "could not determine executable to run" "$LATEST_LOG"; then
        echo -e "   ${RED}✗${NC} Error 'could not determine executable to run' found"
        echo "   ${YELLOW}This is tailwindcss 4.x breaking change issue${NC}"
    fi
else
    echo -e "${GREEN}✓${NC} No recent npm error logs"
fi
echo ""

# Summary
echo "════════════════════════════════════════════════════════════════"
if [[ $ISSUES_FOUND -eq 0 ]]; then
    echo -e "${GREEN}✓ DIAGNOSTIC PASSED${NC} - No issues found"
    echo ""
    echo "If you're still experiencing problems, try:"
    echo "  1. Clear npm cache: sudo npm cache clean --force"
    echo "  2. Redeploy: cd ~/familyBudget && sudo ./deploy.sh --profile full"
else
    echo -e "${RED}✗ FOUND $ISSUES_FOUND ISSUE(S)${NC}"
    echo ""
    echo "RECOMMENDED FIX:"
    echo "  Run: sudo bash scripts/fix_npm_issue.sh"
    echo ""
    echo "Or manually:"
    echo "  1. Update repository: cd ~/familyBudget && git pull origin dev"
    echo "  2. Install jq (if missing): sudo apt install -y jq"
    echo "  3. Clear cache: sudo rm -rf /root/.npm && cd /opt/budget/.npm-isolated && sudo npm cache clean --force"
    echo "  4. Reinstall: sudo rm -rf /opt/budget/.npm-isolated/{node_modules,package-lock.json}"
    echo "  5. Deploy: cd ~/familyBudget && sudo ./deploy.sh --profile full"
fi
echo "════════════════════════════════════════════════════════════════"

exit $ISSUES_FOUND

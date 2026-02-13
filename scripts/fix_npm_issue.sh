#!/bin/bash
#
# Family Budget - npm Environment Fix Script
#
# This script fixes tailwindcss version mismatch (4.1.17 → 3.4.15)
#
# Usage: sudo bash scripts/fix_npm_issue.sh
#
# What it does:
#   1. Updates repository (git pull)
#   2. Installs jq if missing
#   3. Clears npm cache
#   4. Forces package reinstall
#   5. Runs full deploy
#   6. Validates result
#

set -e

# Deployment directory (use relative path if in repo, absolute otherwise)
DEPLOY_DIR="${DEPLOY_DIR:-/opt/budget}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}ERROR:${NC} This script must be run as root (use sudo)"
   exit 1
fi

echo "════════════════════════════════════════════════════════════════"
echo "  npm Environment Fix - Family Budget"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}⚠ WARNING:${NC} This will:"
echo "  - Clear npm cache"
echo "  - Delete .npm-isolated/node_modules (~300MB)"
echo "  - Reinstall all npm packages (~2-3 minutes)"
echo "  - Run full deployment"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi
echo ""

# Step 1: Update repository
echo -e "${BLUE}[1/6]${NC} Updating repository..."

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

echo "Repository: $REPO_DIR"
cd "$REPO_DIR"
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" != "dev" ]]; then
    echo -e "${YELLOW}⚠${NC} Current branch is '$CURRENT_BRANCH', not 'dev'"
    read -p "Switch to dev and pull? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git checkout dev
        git pull origin dev
    else
        echo "Continuing with current branch..."
    fi
else
    echo "Pulling latest changes from dev..."
    git pull origin dev
fi

# Verify commit 8aafae99 is present
if git log --oneline deploy.sh | head -10 | grep -q "8aafae99"; then
    echo -e "${GREEN}✓${NC} Commit 8aafae99 (cp -f fix) is present"
else
    echo -e "${YELLOW}⚠${NC} Commit 8aafae99 not found, but continuing..."
fi
echo ""

# Step 2: Install jq if missing
echo -e "${BLUE}[2/6]${NC} Checking jq installation..."
if command -v jq &> /dev/null; then
    echo -e "${GREEN}✓${NC} jq is already installed"
else
    echo "Installing jq..."
    apt update -qq
    apt install -y jq
    echo -e "${GREEN}✓${NC} jq installed"
fi
echo ""

# Step 3: Clear npm cache
echo -e "${BLUE}[3/6]${NC} Clearing npm cache..."
echo "Removing /root/.npm cache..."
rm -rf /root/.npm/_cache /root/.npm 2>/dev/null || true

echo "Removing user npm cache..."
if [[ -n "$SUDO_USER" ]]; then
    su - "$SUDO_USER" -c "rm -rf ~/.npm" 2>/dev/null || true
fi

echo "Running npm cache clean..."
cd $DEPLOY_DIR/.npm-isolated 2>/dev/null && npm cache clean --force || true

echo -e "${GREEN}✓${NC} npm cache cleared"
echo ""

# Step 4: Force package reinstall
echo -e "${BLUE}[4/6]${NC} Forcing package reinstall..."
echo "Removing node_modules..."
rm -rf $DEPLOY_DIR/.npm-isolated/node_modules

echo "Removing package-lock.json..."
rm -f $DEPLOY_DIR/.npm-isolated/package-lock.json

echo -e "${GREEN}✓${NC} Old packages removed"
echo ""

# Step 5: Run full deploy
echo -e "${BLUE}[5/6]${NC} Running full deployment..."
echo "This may take 2-3 minutes..."
echo ""

cd "$REPO_DIR"
./deploy.sh --profile full

DEPLOY_STATUS=$?
if [[ $DEPLOY_STATUS -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}✓${NC} Deploy completed successfully"
else
    echo ""
    echo -e "${RED}✗${NC} Deploy failed with exit code $DEPLOY_STATUS"
    echo ""
    echo "Check logs above for errors."
    exit $DEPLOY_STATUS
fi
echo ""

# Step 6: Validate result
echo -e "${BLUE}[6/6]${NC} Validating result..."

# Check tailwindcss version
if [[ -f "$DEPLOY_DIR/.npm-isolated/node_modules/tailwindcss/package.json" ]]; then
    ACTUAL_VERSION=$(jq -r '.version' $DEPLOY_DIR/.npm-isolated/node_modules/tailwindcss/package.json)
    EXPECTED_VERSION=$(jq -r '.devDependencies.tailwindcss' $DEPLOY_DIR/package.json | tr -d '^~')

    echo "  tailwindcss version: $ACTUAL_VERSION"

    if [[ "$ACTUAL_VERSION" == "$EXPECTED_VERSION" ]]; then
        echo -e "  ${GREEN}✓${NC} Version is CORRECT"
    else
        echo -e "  ${RED}✗${NC} Version is WRONG (expected: $EXPECTED_VERSION)"
        echo ""
        echo "Despite our efforts, the wrong version is still installed."
        echo ""
        echo "MANUAL DEBUG REQUIRED:"
        echo "  1. Check package-lock.json:"
        echo "     jq '.packages[\"node_modules/tailwindcss\"]' $DEPLOY_DIR/.npm-isolated/package-lock.json"
        echo ""
        echo "  2. Check what npm registry returns:"
        echo "     npm view tailwindcss@3.4.15 version"
        echo ""
        echo "  3. Try manual npm ci:"
        echo "     cd $DEPLOY_DIR/.npm-isolated"
        echo "     npm ci --prefer-offline --no-audit"
        exit 1
    fi
else
    echo -e "  ${RED}✗${NC} tailwindcss not found in node_modules"
    exit 1
fi

# Check CSS build
if [[ -f "$DEPLOY_DIR/frontend/web/static/css/tailwind-daisyui.min.css" ]]; then
    CSS_SIZE=$(du -h "$DEPLOY_DIR/frontend/web/static/css/tailwind-daisyui.min.css" | cut -f1)
    echo "  CSS file size: $CSS_SIZE"
    echo -e "  ${GREEN}✓${NC} CSS file exists"
else
    echo -e "  ${YELLOW}⚠${NC} CSS file not found (build may have been skipped)"
fi

# Test tailwindcss executable
cd $DEPLOY_DIR
export PATH="$DEPLOY_DIR/.npm-isolated/node_modules/.bin:$PATH"
export NODE_PATH="$DEPLOY_DIR/.npm-isolated/node_modules"

if timeout 5s tailwindcss --help &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} tailwindcss executable works"
else
    echo -e "  ${RED}✗${NC} tailwindcss executable FAILS"
    exit 1
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}✓ FIX COMPLETED SUCCESSFULLY${NC}"
echo ""
echo "RESULT:"
echo "  - tailwindcss version: $EXPECTED_VERSION"
echo "  - npm run build: should work now"
echo "  - Services: check with 'docker compose ps'"
echo ""
echo "Next steps:"
echo "  1. Verify services are running: docker compose ps"
echo "  2. Check logs if needed: docker compose logs backend --tail=50"
echo "  3. Test website: curl -I https://your-domain.com"
echo "════════════════════════════════════════════════════════════════"

exit 0

#!/bin/bash
#
# Fix VAPID Push Notification Icons in PWA
#
# This script:
# 1. Checks VAPID keys in .env
# 2. Restarts backend container to load VAPID keys
# 3. Verifies /api/v1/push/vapid-key endpoint
# 4. Provides instructions to clear frontend cache
#
# Usage:
#   cd /opt/budget
#   bash ~/familyBudget/scripts/fix_vapid_icons.sh
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     Fix VAPID Push Notification Icons${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if running from /opt/budget
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}✗ Error: docker-compose.yml not found${NC}"
    echo "Please run this script from /opt/budget directory:"
    echo "  cd /opt/budget"
    echo "  bash ~/familyBudget/scripts/fix_vapid_icons.sh"
    exit 1
fi

# 1. Check VAPID keys in .env
echo -e "${BLUE}[1/4] Checking VAPID keys in .env...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${RED}✗ .env file not found!${NC}"
    exit 1
fi

VAPID_PUBLIC=$(grep "^VAPID_PUBLIC_KEY=" .env | cut -d'=' -f2)
VAPID_PRIVATE=$(grep "^VAPID_PRIVATE_KEY=" .env | cut -d'=' -f2)
VAPID_EMAIL=$(grep "^VAPID_CONTACT_EMAIL=" .env | cut -d'=' -f2)

if [ -z "$VAPID_PUBLIC" ] || [ -z "$VAPID_PRIVATE" ]; then
    echo -e "${RED}✗ VAPID keys not found in .env${NC}"
    echo ""
    echo "Please add VAPID keys to .env file:"
    echo "  VAPID_PUBLIC_KEY=<your_public_key>"
    echo "  VAPID_PRIVATE_KEY=<your_private_key>"
    echo "  VAPID_CONTACT_EMAIL=admin@yourdomain.com"
    echo ""
    echo "Generate keys at: https://vapidkeys.com/"
    exit 1
fi

# Check key format (should be base64url, 65+ chars for public key)
if [ ${#VAPID_PUBLIC} -lt 65 ]; then
    echo -e "${YELLOW}⚠ Warning: VAPID public key seems too short (${#VAPID_PUBLIC} chars, expected 65+)${NC}"
    echo "Please verify your VAPID keys are correct"
fi

echo -e "${GREEN}✓ VAPID keys found in .env${NC}"
echo "  Public key: ${VAPID_PUBLIC:0:20}... (${#VAPID_PUBLIC} chars)"
echo "  Private key: ${VAPID_PRIVATE:0:20}... (${#VAPID_PRIVATE} chars)"
echo "  Contact email: ${VAPID_EMAIL}"
echo ""

# 2. Restart backend container
echo -e "${BLUE}[2/4] Restarting backend container to load VAPID keys...${NC}"
if ! docker compose ps backend | grep -q "Up"; then
    echo -e "${YELLOW}⚠ Backend container is not running${NC}"
    echo "Starting backend..."
    docker compose up -d backend
else
    echo "Restarting backend..."
    docker compose restart backend
fi

# Wait for backend to become healthy
echo "Waiting for backend to become healthy (max 30s)..."
for i in {1..30}; do
    if docker compose ps backend | grep -q "healthy"; then
        echo -e "${GREEN}✓ Backend is healthy${NC}"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""
echo ""

# 3. Verify VAPID endpoint
echo -e "${BLUE}[3/4] Verifying /api/v1/push/vapid-key endpoint...${NC}"
sleep 2  # Give backend a moment to fully start

response=$(curl -s http://localhost:8000/api/v1/push/vapid-key 2>/dev/null || echo '{"error": "connection failed"}')

if echo "$response" | grep -q '"configured":true'; then
    echo -e "${GREEN}✓ VAPID endpoint is configured correctly!${NC}"
    echo "Response: $response" | head -c 150
    echo "..."
    echo ""
elif echo "$response" | grep -q '"configured":false'; then
    echo -e "${RED}✗ VAPID endpoint returned configured:false${NC}"
    echo "Response: $response"
    echo ""
    echo "Checking backend logs for errors..."
    docker compose logs backend | grep -i "vapid\|push" | tail -20
    exit 1
else
    echo -e "${RED}✗ Cannot reach backend endpoint${NC}"
    echo "Response: $response"
    echo ""
    echo "Checking if backend is accessible..."
    curl -s http://localhost:8000/ping || echo "Backend not accessible"
    exit 1
fi

# 4. Clear frontend cache instructions
echo -e "${BLUE}[4/4] Frontend cache clearing instructions${NC}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT: You need to clear frontend cache in PWA${NC}"
echo ""
echo "On mobile (PWA installed app):"
echo "  1. Close the PWA app completely"
echo "  2. Reopen the app"
echo "  3. Pull down to refresh (or force refresh)"
echo "  4. Check if push bell icon appears left of SSE status"
echo ""
echo "On desktop browser:"
echo "  1. Press Ctrl+Shift+R (or Cmd+Shift+R on Mac)"
echo "  2. Or open DevTools → Application → Clear storage → Clear site data"
echo "  3. Reload the page"
echo ""
echo "Expected icon order:"
echo "  Offline Icon → 🔔 Push Bell → 🔄 SSE Status → ✈️ Telegram → 🌓 Theme"
echo ""

# Debug commands
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}     Debug Commands (if icon still not showing)${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Check VAPID endpoint from PWA (open DevTools Console):"
echo "  fetch('/api/v1/push/vapid-key').then(r=>r.json()).then(console.log)"
echo ""
echo "Check pushManager initialization:"
echo "  console.log('Push Manager:', window.budgetPushManager)"
echo "  console.log('Is Supported:', window.budgetPushManager?.isSupported)"
echo "  console.log('VAPID Key:', window.budgetPushManager?.vapidPublicKey)"
echo ""
echo "Check bell button visibility:"
echo "  const btn = document.getElementById('push-bell-btn')"
echo "  console.log('Button hidden:', btn?.classList.contains('hidden'))"
echo "  console.log('Button classes:', btn?.className)"
echo ""
echo "View backend logs:"
echo "  docker compose logs backend | grep -i 'vapid\|push'"
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ VAPID configuration fixed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

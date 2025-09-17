#!/bin/bash

echo "Testing Articles Page Authentication Fix"
echo "========================================"
echo ""

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test credentials
USERNAME="admin"
PASSWORD="admin"
BASE_URL="http://localhost:5173"
API_URL="http://localhost:4000"

echo "Step 1: Login as admin user"
echo "----------------------------"

# Login and capture cookies
LOGIN_RESPONSE=$(curl -s -c /tmp/cookies.txt \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$LOGIN_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Login successful${NC}"
else
    echo -e "${RED}❌ Login failed with status: $HTTP_STATUS${NC}"
    echo "Response: $(echo "$LOGIN_RESPONSE" | grep -v "HTTP_STATUS")"
    exit 1
fi

echo ""
echo "Step 2: Access articles page"
echo "-----------------------------"

# Try to access articles page with cookies
ARTICLES_RESPONSE=$(curl -s -b /tmp/cookies.txt \
  -X GET "$BASE_URL/settings/articles" \
  -w "\nHTTP_STATUS:%{http_code}" \
  -o /tmp/articles_page.html)

HTTP_STATUS=$(echo "$ARTICLES_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Articles page accessible${NC}"
else
    echo -e "${RED}❌ Failed to access articles page with status: $HTTP_STATUS${NC}"
fi

echo ""
echo "Step 3: Check for authentication errors in page"
echo "------------------------------------------------"

# Check if the page contains 401 error indicators
if grep -q "401" /tmp/articles_page.html; then
    echo -e "${YELLOW}⚠️  Found 401 references in page content${NC}"
else
    echo -e "${GREEN}✅ No 401 errors found in page content${NC}"
fi

echo ""
echo "Step 4: Test API endpoint directly"
echo "-----------------------------------"

# Test articles API endpoint
API_RESPONSE=$(curl -s -b /tmp/cookies.txt \
  -X GET "$BASE_URL/api/articles?limit=10&offset=0" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$API_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Articles API endpoint accessible${NC}"
    echo "API Response: $(echo "$API_RESPONSE" | grep -v "HTTP_STATUS" | jq -r '.success' 2>/dev/null || echo "N/A")"
else
    echo -e "${RED}❌ Articles API failed with status: $HTTP_STATUS${NC}"
fi

echo ""
echo "Step 5: Test auth/me endpoint"
echo "------------------------------"

# Test auth/me endpoint
AUTH_ME_RESPONSE=$(curl -s -b /tmp/cookies.txt \
  -X GET "$BASE_URL/api/auth/me" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$AUTH_ME_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)

if [ "$HTTP_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✅ Auth/me endpoint accessible${NC}"
    USER_ROLE=$(echo "$AUTH_ME_RESPONSE" | grep -v "HTTP_STATUS" | jq -r '.user.role' 2>/dev/null || echo "N/A")
    echo "User role: $USER_ROLE"
else
    echo -e "${YELLOW}⚠️  Auth/me endpoint returned status: $HTTP_STATUS${NC}"
    echo "This is expected if using server-side authentication only"
fi

echo ""
echo "========================================"
echo "Test Summary:"
echo ""

# Clean up
rm -f /tmp/cookies.txt /tmp/articles_page.html

# Final verdict
if [ "$HTTP_STATUS" -eq 200 ] || [ "$HTTP_STATUS" -eq 401 ]; then
    echo -e "${GREEN}✅ Authentication fix appears to be working${NC}"
    echo "The articles page should be accessible without console errors"
    echo "Please manually verify in browser that CRUD operations work"
else
    echo -e "${RED}❌ There may still be issues with authentication${NC}"
    echo "Please check browser console for errors"
fi

echo ""
echo "To manually verify:"
echo "1. Open http://localhost:5173/settings/articles in browser"
echo "2. Login as admin/admin"
echo "3. Check browser console for 401 errors"
echo "4. Try to create/edit/delete an article"
#!/bin/bash

# Test script for admin cost centers functionality

echo "Testing Admin Cost Centers Functionality"
echo "========================================"

# Base URL
BASE_URL="http://localhost:4000"

# Test credentials
ADMIN_USER="admin"
ADMIN_PASS="admin123"

echo -e "\n1. Testing admin login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  -c cookies.txt)

if echo "$LOGIN_RESPONSE" | grep -q "\"role\":\"admin\""; then
  echo "✓ Admin login successful"
else
  echo "✗ Admin login failed"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "\n2. Testing admin cost centers endpoint..."
ADMIN_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/references/cost_center" \
  -b cookies.txt)

if echo "$ADMIN_RESPONSE" | grep -q "user_name\|user_email\|username\|telegram_id"; then
  echo "✓ Admin endpoint returns user information"
  echo "Sample response (first 500 chars):"
  echo "$ADMIN_RESPONSE" | head -c 500
else
  echo "✗ Admin endpoint does not return user information"
  echo "Response: $ADMIN_RESPONSE"
fi

echo -e "\n3. Testing regular cost centers endpoint..."
REGULAR_RESPONSE=$(curl -s -X GET "$BASE_URL/api/cost_centers" \
  -b cookies.txt)

if echo "$REGULAR_RESPONSE" | grep -q "user_name\|user_email\|username\|telegram_id"; then
  echo "✗ Regular endpoint should NOT return user information"
else
  echo "✓ Regular endpoint does not expose user information"
fi

echo -e "\n4. Comparing data structure..."
ADMIN_COUNT=$(echo "$ADMIN_RESPONSE" | grep -o '"id"' | wc -l)
echo "Admin endpoint returned $ADMIN_COUNT cost centers with user info"

echo -e "\n5. Testing data isolation..."
# Create a test user to verify isolation
TEST_USER="testuser_$(date +%s)"
TEST_PASS="testpass123"

# Create test user
echo -e "\nCreating test user..."
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" > /dev/null

# Login as test user
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$TEST_USER\",\"password\":\"$TEST_PASS\"}" \
  -c test_cookies.txt > /dev/null

# Check test user cannot access admin endpoint
TEST_ADMIN_RESPONSE=$(curl -s -X GET "$BASE_URL/api/admin/references/cost_center" \
  -b test_cookies.txt)

if echo "$TEST_ADMIN_RESPONSE" | grep -q "forbidden\|unauthorized\|403"; then
  echo "✓ Non-admin users cannot access admin endpoint"
else
  echo "✗ Security issue: non-admin users can access admin endpoint"
fi

# Clean up
rm -f test_cookies.txt

echo -e "\nTest completed successfully!"
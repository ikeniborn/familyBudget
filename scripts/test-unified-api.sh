#!/bin/bash

# Test script for Unified Prisma API

echo "Testing Unified Prisma API endpoints..."

# Base URL for the API
BASE_URL="http://localhost:4000/api"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local expected_status=${4:-200}
    local headers=${5:-""}
    
    echo -e "${YELLOW}Testing: $method $endpoint${NC}"
    
    if [ -n "$data" ]; then
        if [ -n "$headers" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "$headers" \
                -d "$data")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    else
        if [ -n "$headers" ]; then
            response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
                -H "$headers")
        else
            response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
        fi
    fi
    
    # Split response body and status code
    body=$(echo "$response" | head -n -1)
    status=$(echo "$response" | tail -n 1)
    
    if [ "$status" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ Success: HTTP $status${NC}"
        echo "Response: $body"
    else
        echo -e "${RED}✗ Failed: HTTP $status (expected $expected_status)${NC}"
        echo "Response: $body"
    fi
    echo "---"
}

# Wait for API to be ready
echo "Waiting for API to be ready..."
sleep 5

# Test health endpoint
test_endpoint "GET" "/health"

# Test reference data endpoints
echo -e "\n${YELLOW}=== Testing Reference Data Endpoints ===${NC}"

test_endpoint "GET" "/reference/periods"
test_endpoint "GET" "/reference/financial_centers"
test_endpoint "GET" "/reference/cost_centers"
test_endpoint "GET" "/reference/nomenclatures"
test_endpoint "GET" "/reference/row_types"

# Test users endpoints
echo -e "\n${YELLOW}=== Testing Users Endpoints ===${NC}"

test_endpoint "GET" "/users"

# Test products endpoints
echo -e "\n${YELLOW}=== Testing Products Endpoints ===${NC}"

test_endpoint "GET" "/products"
test_endpoint "GET" "/products/categories"

# Test creating a product
test_endpoint "POST" "/products" '{
  "name": "Test Product",
  "category": "Test Category",
  "unit": "шт",
  "description": "Test product for API validation"
}' 201

# Test registry endpoints (requires user authentication)
echo -e "\n${YELLOW}=== Testing Registry Endpoints (with user context) ===${NC}"

# These tests will fail without proper authentication, which is expected
test_endpoint "GET" "/registry/last" "" 401
test_endpoint "GET" "/registry/last" "" 200 "X-User-Id: 1"

echo -e "\n${GREEN}Unified API testing completed!${NC}"
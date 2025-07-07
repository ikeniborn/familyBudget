#!/bin/bash

# Script to compare Python FastAPI vs Node.js Prisma API performance and functionality

echo "API Performance Comparison Tool"
echo "================================"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PYTHON_API_URL="http://localhost:8888"
NODE_API_URL="http://localhost:4000/api"
USER_ID="1"
TEST_ITERATIONS=5

# Test function with timing
test_api_performance() {
    local api_name=$1
    local base_url=$2
    local endpoint=$3
    local method=${4:-GET}
    local data=${5:-""}
    local headers=${6:-""}
    
    echo -e "${YELLOW}Testing $api_name: $method $endpoint${NC}"
    
    local total_time=0
    local success_count=0
    
    for i in $(seq 1 $TEST_ITERATIONS); do
        local start_time=$(date +%s%N)
        
        if [ -n "$data" ]; then
            if [ -n "$headers" ]; then
                response=$(curl -s -w "%{http_code}" -X $method "$base_url$endpoint" \
                    -H "Content-Type: application/json" \
                    -H "$headers" \
                    -d "$data" 2>/dev/null)
            else
                response=$(curl -s -w "%{http_code}" -X $method "$base_url$endpoint" \
                    -H "Content-Type: application/json" \
                    -d "$data" 2>/dev/null)
            fi
        else
            if [ -n "$headers" ]; then
                response=$(curl -s -w "%{http_code}" -X $method "$base_url$endpoint" \
                    -H "$headers" 2>/dev/null)
            else
                response=$(curl -s -w "%{http_code}" -X $method "$base_url$endpoint" 2>/dev/null)
            fi
        fi
        
        local end_time=$(date +%s%N)
        local duration=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
        
        # Extract HTTP status code (last 3 characters)
        local status=${response: -3}
        
        if [ "$status" = "200" ] || [ "$status" = "201" ]; then
            success_count=$((success_count + 1))
            total_time=$((total_time + duration))
        fi
        
        echo "  Iteration $i: ${duration}ms (HTTP $status)"
    done
    
    if [ $success_count -gt 0 ]; then
        local avg_time=$((total_time / success_count))
        echo -e "${GREEN}  Average: ${avg_time}ms (${success_count}/${TEST_ITERATIONS} successful)${NC}"
        return $avg_time
    else
        echo -e "${RED}  Failed: No successful requests${NC}"
        return 9999
    fi
}

# Function to compare two APIs
compare_endpoints() {
    local endpoint=$1
    local method=${2:-GET}
    local data=${3:-""}
    local headers=${4:-""}
    
    echo -e "\n${BLUE}=== Comparing: $method $endpoint ===${NC}"
    
    # Test Python API
    test_api_performance "Python API" "$PYTHON_API_URL" "$endpoint" "$method" "$data" "$headers"
    local python_time=$?
    
    # Test Node.js API (with unified flag)
    test_api_performance "Node.js API" "$NODE_API_URL" "$endpoint" "$method" "$data" "$headers"
    local node_time=$?
    
    # Calculate improvement
    if [ $python_time -ne 9999 ] && [ $node_time -ne 9999 ]; then
        local improvement=$((python_time - node_time))
        local percentage=$((improvement * 100 / python_time))
        
        if [ $improvement -gt 0 ]; then
            echo -e "${GREEN}  Node.js is ${improvement}ms (${percentage}%) faster${NC}"
        elif [ $improvement -lt 0 ]; then
            local degradation=$((-improvement))
            local deg_percentage=$((degradation * 100 / python_time))
            echo -e "${RED}  Node.js is ${degradation}ms (${deg_percentage}%) slower${NC}"
        else
            echo -e "${YELLOW}  Performance is equal${NC}"
        fi
    fi
}

# Function to test functionality
test_functionality() {
    local endpoint=$1
    local description=$2
    
    echo -e "\n${BLUE}=== Testing Functionality: $description ===${NC}"
    
    # Test Python API
    echo "Python API:"
    python_response=$(curl -s "$PYTHON_API_URL$endpoint" -H "X-User-Id: $USER_ID" 2>/dev/null)
    python_count=$(echo "$python_response" | jq '. | length' 2>/dev/null || echo "Error")
    echo "  Response count: $python_count"
    
    # Test Node.js API
    echo "Node.js API:"
    node_response=$(curl -s "$NODE_API_URL$endpoint" -H "X-User-Id: $USER_ID" 2>/dev/null)
    node_count=$(echo "$node_response" | jq '. | length' 2>/dev/null || echo "Error")
    echo "  Response count: $node_count"
    
    # Compare results
    if [ "$python_count" = "$node_count" ] && [ "$python_count" != "Error" ]; then
        echo -e "${GREEN}  ✓ Functionality matches${NC}"
    else
        echo -e "${RED}  ✗ Functionality differs${NC}"
    fi
}

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 3

# Test if Python API is running
echo "Checking Python API availability..."
if ! curl -s "$PYTHON_API_URL/health" >/dev/null 2>&1; then
    echo -e "${RED}Python API is not available at $PYTHON_API_URL${NC}"
    echo "Please start the Python API first"
    exit 1
fi

# Test if Node.js API is running
echo "Checking Node.js API availability..."
if ! curl -s "$NODE_API_URL/health" >/dev/null 2>&1; then
    echo -e "${RED}Node.js API is not available at $NODE_API_URL${NC}"
    echo "Please start the Node.js API with USE_UNIFIED_API=true"
    exit 1
fi

echo -e "${GREEN}Both APIs are available. Starting comparison...${NC}"

# Performance Tests
echo -e "\n${YELLOW}PERFORMANCE COMPARISON${NC}"
echo "======================"

# Reference data endpoints
compare_endpoints "/periods"
compare_endpoints "/financial_centers"
compare_endpoints "/cost_centers"
compare_endpoints "/nomenclatures"
compare_endpoints "/row_types"

# User-specific endpoints (require authentication)
compare_endpoints "/registry/last" "GET" "" "X-User-Id: $USER_ID"
compare_endpoints "/users" "GET"

# Functionality Tests
echo -e "\n${YELLOW}FUNCTIONALITY COMPARISON${NC}"
echo "========================"

test_functionality "/periods" "Periods data"
test_functionality "/financial_centers" "Financial Centers data"
test_functionality "/cost_centers" "Cost Centers data"
test_functionality "/nomenclatures" "Nomenclatures data"
test_functionality "/row_types" "Row Types data"

# Data integrity test
echo -e "\n${BLUE}=== Data Integrity Test ===${NC}"

# Test creating a record in both APIs and comparing
test_data='{
  "operationDate": "2025-01-07T12:00:00Z",
  "periodId": 1,
  "financialCenterId": 1,
  "costCenterId": 1,
  "nomenclatureId": 1,
  "rowTypeId": 1,
  "costSum": 100.50,
  "comment": "Test record for comparison"
}'

echo "Testing record creation..."

# Python API
python_create=$(curl -s -w "%{http_code}" -X POST "$PYTHON_API_URL/registry" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $USER_ID" \
    -d "$test_data" 2>/dev/null)
python_status=${python_create: -3}
echo "Python API creation: HTTP $python_status"

# Node.js API  
node_create=$(curl -s -w "%{http_code}" -X POST "$NODE_API_URL/registry" \
    -H "Content-Type: application/json" \
    -H "X-User-Id: $USER_ID" \
    -d "$test_data" 2>/dev/null)
node_status=${node_create: -3}
echo "Node.js API creation: HTTP $node_status"

if [ "$python_status" = "201" ] && [ "$node_status" = "201" ]; then
    echo -e "${GREEN}✓ Both APIs can create records${NC}"
else
    echo -e "${RED}✗ Record creation differs between APIs${NC}"
fi

echo -e "\n${GREEN}Comparison complete!${NC}"
echo "To enable Node.js API in production, set USE_UNIFIED_API=true"
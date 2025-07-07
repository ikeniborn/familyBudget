#!/bin/bash

# Test script for Reports API migration from Python to Node.js

echo "Testing Reports API Migration"
echo "============================="

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

# Test function
test_report_endpoint() {
    local api_name=$1
    local base_url=$2
    local endpoint=$3
    local description=$4
    
    echo -e "${YELLOW}Testing $api_name: $endpoint${NC}"
    echo "Description: $description"
    
    local start_time=$(date +%s%N)
    
    response=$(curl -s -w "\n%{http_code}" "$base_url$endpoint" \
        -H "X-User-Id: $USER_ID" 2>/dev/null)
    
    local end_time=$(date +%s%N)
    local duration=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
    
    # Split response body and status code
    body=$(echo "$response" | head -n -1)
    status=$(echo "$response" | tail -n 1)
    
    if [ "$status" = "200" ]; then
        # Try to parse JSON and count records
        record_count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "N/A")
        echo -e "${GREEN}✓ Success: HTTP $status, ${duration}ms, Records: $record_count${NC}"
        
        # Show sample data structure
        if [ "$record_count" != "N/A" ] && [ "$record_count" != "0" ]; then
            echo "Sample record structure:"
            echo "$body" | jq '.[0] // . | keys' 2>/dev/null | head -3
        fi
    else
        echo -e "${RED}✗ Failed: HTTP $status${NC}"
        echo "Response: $body" | head -3
    fi
    echo "---"
}

# Function to test complex queries
test_complex_query() {
    local api_name=$1
    local base_url=$2
    local endpoint=$3
    local description=$4
    
    echo -e "${BLUE}=== Complex Query Test: $description ===${NC}"
    
    # Test with filters
    filtered_endpoint="$endpoint?periodIds=1,2&financialCenterIds=1&startDate=2024-01-01&endDate=2024-12-31"
    
    echo "Testing filtered query: $filtered_endpoint"
    
    response=$(curl -s -w "\n%{http_code}" "$base_url$filtered_endpoint" \
        -H "X-User-Id: $USER_ID" 2>/dev/null)
    
    body=$(echo "$response" | head -n -1)
    status=$(echo "$response" | tail -n 1)
    
    if [ "$status" = "200" ]; then
        record_count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "N/A")
        echo -e "${GREEN}✓ Filtered query successful: Records: $record_count${NC}"
    else
        echo -e "${RED}✗ Filtered query failed: HTTP $status${NC}"
    fi
    echo "---"
}

# Function to test POST endpoints (custom reports)
test_custom_report() {
    local api_name=$1
    local base_url=$2
    local description=$3
    
    echo -e "${BLUE}=== Custom Report Test: $description ===${NC}"
    
    local test_data='{
      "reportType": "budget-vs-actual",
      "filters": {
        "periodIds": [1, 2],
        "financialCenterIds": [1],
        "startDate": "2024-01-01T00:00:00Z",
        "endDate": "2024-12-31T23:59:59Z"
      },
      "options": {
        "limit": 10
      }
    }'
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$base_url/reports/custom" \
        -H "Content-Type: application/json" \
        -H "X-User-Id: $USER_ID" \
        -d "$test_data" 2>/dev/null)
    
    body=$(echo "$response" | head -n -1)
    status=$(echo "$response" | tail -n 1)
    
    if [ "$status" = "200" ]; then
        record_count=$(echo "$body" | jq '. | length' 2>/dev/null || echo "N/A")
        echo -e "${GREEN}✓ Custom report successful: Records: $record_count${NC}"
        
        # Show sample data structure
        if [ "$record_count" != "N/A" ] && [ "$record_count" != "0" ]; then
            echo "Sample custom report data:"
            echo "$body" | jq '.[0]' 2>/dev/null | head -5
        fi
    else
        echo -e "${RED}✗ Custom report failed: HTTP $status${NC}"
        echo "Response: $body"
    fi
    echo "---"
}

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 3

# Check if APIs are available
echo "Checking API availability..."

if curl -s "$PYTHON_API_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}Python API is available${NC}"
    PYTHON_AVAILABLE=true
else
    echo -e "${YELLOW}Python API is not available - testing Node.js only${NC}"
    PYTHON_AVAILABLE=false
fi

if curl -s "$NODE_API_URL/health" >/dev/null 2>&1; then
    echo -e "${GREEN}Node.js API is available${NC}"
    NODE_AVAILABLE=true
else
    echo -e "${RED}Node.js API is not available${NC}"
    NODE_AVAILABLE=false
    exit 1
fi

# Test report endpoints
echo -e "\n${YELLOW}TESTING BASIC REPORT ENDPOINTS${NC}"
echo "==============================="

if [ "$PYTHON_AVAILABLE" = true ]; then
    echo -e "\n${BLUE}Python API Tests:${NC}"
    test_report_endpoint "Python API" "$PYTHON_API_URL" "/registry/last?row_type_id=1&limit=5" "Last 5 budget entries"
    test_report_endpoint "Python API" "$PYTHON_API_URL" "/registry/last?row_type_id=2&limit=5" "Last 5 actual entries"
fi

echo -e "\n${BLUE}Node.js API Tests:${NC}"
test_report_endpoint "Node.js API" "$NODE_API_URL" "/registry/last?row_type_id=1&limit=5" "Last 5 budget entries"
test_report_endpoint "Node.js API" "$NODE_API_URL" "/registry/last?row_type_id=2&limit=5" "Last 5 actual entries"

# Test new report endpoints (Node.js only)
echo -e "\n${YELLOW}TESTING NEW REPORT ENDPOINTS (Node.js only)${NC}"
echo "============================================"

test_report_endpoint "Node.js API" "$NODE_API_URL" "/reports/budget-vs-actual" "Budget vs Actual comparison"
test_report_endpoint "Node.js API" "$NODE_API_URL" "/reports/period-summary" "Period summary report"
test_report_endpoint "Node.js API" "$NODE_API_URL" "/reports/financial-center-breakdown" "Financial center breakdown"
test_report_endpoint "Node.js API" "$NODE_API_URL" "/reports/monthly-trend" "Monthly trend analysis"
test_report_endpoint "Node.js API" "$NODE_API_URL" "/reports/transactions?limit=10" "Detailed transactions (paginated)"

# Test complex queries
echo -e "\n${YELLOW}TESTING COMPLEX QUERIES${NC}"
echo "========================"

test_complex_query "Node.js API" "$NODE_API_URL" "/reports/budget-vs-actual" "Budget vs Actual with filters"
test_complex_query "Node.js API" "$NODE_API_URL" "/reports/transactions" "Transactions with filters"

# Test custom reports
echo -e "\n${YELLOW}TESTING CUSTOM REPORTS${NC}"
echo "======================"

test_custom_report "Node.js API" "$NODE_API_URL" "Custom budget vs actual report"

# Performance comparison if both APIs available
if [ "$PYTHON_AVAILABLE" = true ]; then
    echo -e "\n${YELLOW}PERFORMANCE COMPARISON${NC}"
    echo "======================"
    
    echo "Comparing equivalent endpoints..."
    
    # Time Python API
    echo "Testing Python API performance..."
    python_start=$(date +%s%N)
    python_response=$(curl -s "$PYTHON_API_URL/registry/last?limit=20" -H "X-User-Id: $USER_ID" 2>/dev/null)
    python_end=$(date +%s%N)
    python_time=$((($python_end - $python_start) / 1000000))
    
    # Time Node.js API
    echo "Testing Node.js API performance..."
    node_start=$(date +%s%N)
    node_response=$(curl -s "$NODE_API_URL/registry/last?limit=20" -H "X-User-Id: $USER_ID" 2>/dev/null)
    node_end=$(date +%s%N)
    node_time=$((($node_end - $node_start) / 1000000))
    
    echo "Results:"
    echo "  Python API: ${python_time}ms"
    echo "  Node.js API: ${node_time}ms"
    
    if [ $node_time -lt $python_time ]; then
        improvement=$((python_time - node_time))
        percentage=$((improvement * 100 / python_time))
        echo -e "${GREEN}  Node.js is ${improvement}ms (${percentage}%) faster${NC}"
    else
        degradation=$((node_time - python_time))
        percentage=$((degradation * 100 / python_time))
        echo -e "${RED}  Node.js is ${degradation}ms (${percentage}%) slower${NC}"
    fi
fi

# Data integrity test
echo -e "\n${YELLOW}DATA INTEGRITY TEST${NC}"
echo "==================="

echo "Comparing data consistency between APIs..."

if [ "$PYTHON_AVAILABLE" = true ]; then
    # Get data from both APIs
    python_data=$(curl -s "$PYTHON_API_URL/periods" -H "X-User-Id: $USER_ID" 2>/dev/null)
    node_data=$(curl -s "$NODE_API_URL/reference/periods" -H "X-User-Id: $USER_ID" 2>/dev/null)
    
    python_count=$(echo "$python_data" | jq '. | length' 2>/dev/null || echo "0")
    node_count=$(echo "$node_data" | jq '. | length' 2>/dev/null || echo "0")
    
    echo "Reference data comparison:"
    echo "  Python API periods: $python_count"
    echo "  Node.js API periods: $node_count"
    
    if [ "$python_count" = "$node_count" ]; then
        echo -e "${GREEN}  ✓ Data counts match${NC}"
    else
        echo -e "${RED}  ✗ Data counts differ${NC}"
    fi
else
    echo "Python API not available - skipping data comparison"
fi

echo -e "\n${GREEN}Reports API testing completed!${NC}"
echo ""
echo "Summary:"
echo "- Basic report endpoints: Tested"
echo "- Advanced report features: Tested (Node.js only)"
echo "- Complex queries with filters: Tested"
echo "- Custom report generation: Tested"
if [ "$PYTHON_AVAILABLE" = true ]; then
    echo "- Performance comparison: Completed"
    echo "- Data integrity check: Completed"
else
    echo "- Performance comparison: Skipped (Python API not available)"
    echo "- Data integrity check: Skipped (Python API not available)"
fi
echo ""
echo "To enable Node.js reports in production:"
echo "1. Set USE_UNIFIED_API=true in frontend-api"
echo "2. Update frontend to use new report endpoints"
echo "3. Monitor performance and data accuracy"
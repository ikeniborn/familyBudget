#!/bin/bash

# Performance testing script for Prisma API with caching

echo "Prisma API Performance Testing with Caching"
echo "==========================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NODE_API_URL="http://localhost:4000/api"
USER_ID="1"
ITERATIONS=10

# Function to test endpoint performance with multiple iterations
test_performance() {
    local endpoint=$1
    local description=$2
    local headers=${3:-""}
    
    echo -e "${YELLOW}Testing: $description${NC}"
    echo "Endpoint: $endpoint"
    
    local times=()
    local success_count=0
    
    for i in $(seq 1 $ITERATIONS); do
        local start_time=$(date +%s%N)
        
        if [ -n "$headers" ]; then
            response=$(curl -s -w "%{http_code}" "$NODE_API_URL$endpoint" \
                -H "$headers" 2>/dev/null)
        else
            response=$(curl -s -w "%{http_code}" "$NODE_API_URL$endpoint" 2>/dev/null)
        fi
        
        local end_time=$(date +%s%N)
        local duration=$((($end_time - $start_time) / 1000000)) # Convert to milliseconds
        
        local status=${response: -3}
        
        if [ "$status" = "200" ]; then
            times+=($duration)
            success_count=$((success_count + 1))
        fi
        
        # Show progress for longer tests
        if [ $((i % 5)) -eq 0 ]; then
            echo "  Completed $i/$ITERATIONS iterations..."
        fi
    done
    
    if [ $success_count -gt 0 ]; then
        # Calculate statistics
        local total=0
        local min=${times[0]}
        local max=${times[0]}
        
        for time in "${times[@]}"; do
            total=$((total + time))
            if [ $time -lt $min ]; then min=$time; fi
            if [ $time -gt $max ]; then max=$time; fi
        done
        
        local avg=$((total / success_count))
        
        echo -e "${GREEN}Results (${success_count}/${ITERATIONS} successful):${NC}"
        echo "  Average: ${avg}ms"
        echo "  Min: ${min}ms"
        echo "  Max: ${max}ms"
        
        # Check for cache effectiveness (first request vs subsequent)
        if [ ${#times[@]} -ge 2 ]; then
            local first_time=${times[0]}
            local second_time=${times[1]}
            
            if [ $second_time -lt $first_time ]; then
                local improvement=$((first_time - second_time))
                local percentage=$((improvement * 100 / first_time))
                echo -e "${GREEN}  Cache improvement: ${improvement}ms (${percentage}%) faster on second request${NC}"
            fi
        fi
    else
        echo -e "${RED}All requests failed${NC}"
    fi
    echo "---"
}

# Function to test cache behavior
test_cache_behavior() {
    local endpoint=$1
    local description=$2
    
    echo -e "${BLUE}=== Cache Behavior Test: $description ===${NC}"
    
    # Clear cache first (if there's an endpoint for it)
    # First request (cache miss)
    echo "First request (cache miss expected):"
    start_time=$(date +%s%N)
    response1=$(curl -s "$NODE_API_URL$endpoint" -H "X-User-Id: $USER_ID" 2>/dev/null)
    end_time=$(date +%s%N)
    first_duration=$((($end_time - $start_time) / 1000000))
    echo "  Duration: ${first_duration}ms"
    
    # Second request (cache hit expected)
    echo "Second request (cache hit expected):"
    start_time=$(date +%s%N)
    response2=$(curl -s "$NODE_API_URL$endpoint" -H "X-User-Id: $USER_ID" 2>/dev/null)
    end_time=$(date +%s%N)
    second_duration=$((($end_time - $start_time) / 1000000))
    echo "  Duration: ${second_duration}ms"
    
    # Calculate improvement
    if [ $second_duration -lt $first_duration ]; then
        improvement=$((first_duration - second_duration))
        percentage=$((improvement * 100 / first_duration))
        echo -e "${GREEN}  Cache effectiveness: ${improvement}ms (${percentage}%) improvement${NC}"
    else
        echo -e "${YELLOW}  No cache improvement detected${NC}"
    fi
    
    # Verify data consistency
    if [ "$response1" = "$response2" ]; then
        echo -e "${GREEN}  ✓ Data consistency maintained${NC}"
    else
        echo -e "${RED}  ✗ Data inconsistency detected${NC}"
    fi
    
    echo "---"
}

# Function to test concurrent requests
test_concurrent_performance() {
    local endpoint=$1
    local description=$2
    local concurrent_count=${3:-5}
    
    echo -e "${BLUE}=== Concurrent Performance Test: $description ===${NC}"
    echo "Testing $concurrent_count concurrent requests..."
    
    # Create temporary files for results
    local temp_dir=$(mktemp -d)
    
    # Start concurrent requests
    local pids=()
    local start_time=$(date +%s%N)
    
    for i in $(seq 1 $concurrent_count); do
        (
            local req_start=$(date +%s%N)
            curl -s "$NODE_API_URL$endpoint" -H "X-User-Id: $USER_ID" > "$temp_dir/response_$i.json" 2>/dev/null
            local req_end=$(date +%s%N)
            local req_duration=$((($req_end - $req_start) / 1000000))
            echo "$req_duration" > "$temp_dir/time_$i.txt"
        ) &
        pids+=($!)
    done
    
    # Wait for all requests to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    local end_time=$(date +%s%N)
    local total_duration=$((($end_time - $start_time) / 1000000))
    
    # Collect results
    local times=()
    local response_sizes=()
    
    for i in $(seq 1 $concurrent_count); do
        if [ -f "$temp_dir/time_$i.txt" ]; then
            times+=($(cat "$temp_dir/time_$i.txt"))
        fi
        if [ -f "$temp_dir/response_$i.json" ]; then
            response_sizes+=($(wc -c < "$temp_dir/response_$i.json"))
        fi
    done
    
    # Calculate statistics
    if [ ${#times[@]} -gt 0 ]; then
        local total_req_time=0
        local min_time=${times[0]}
        local max_time=${times[0]}
        
        for time in "${times[@]}"; do
            total_req_time=$((total_req_time + time))
            if [ $time -lt $min_time ]; then min_time=$time; fi
            if [ $time -gt $max_time ]; then max_time=$time; fi
        done
        
        local avg_time=$((total_req_time / ${#times[@]}))
        
        echo "Results:"
        echo "  Total time: ${total_duration}ms"
        echo "  Successful requests: ${#times[@]}/$concurrent_count"
        echo "  Average request time: ${avg_time}ms"
        echo "  Min request time: ${min_time}ms"
        echo "  Max request time: ${max_time}ms"
        echo "  Requests per second: $((concurrent_count * 1000 / total_duration))"
    else
        echo -e "${RED}No successful requests${NC}"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    echo "---"
}

# Wait for API to be ready
echo "Waiting for API to be ready..."
sleep 3

# Check if Node.js API is available
if ! curl -s "$NODE_API_URL/health" >/dev/null 2>&1; then
    echo -e "${RED}Node.js API is not available at $NODE_API_URL${NC}"
    echo "Please start the Node.js API with USE_UNIFIED_API=true"
    exit 1
fi

echo -e "${GREEN}Node.js API is available. Starting performance tests...${NC}"

# Test reference data endpoints (should be heavily cached)
echo -e "\n${YELLOW}REFERENCE DATA PERFORMANCE (Heavy Caching Expected)${NC}"
echo "=================================================="

test_performance "/reference/periods" "Periods (cached reference data)"
test_performance "/reference/financial_centers" "Financial Centers (cached reference data)"
test_performance "/reference/cost_centers" "Cost Centers (cached reference data)"
test_performance "/reference/nomenclatures" "Nomenclatures (cached reference data)"
test_performance "/reference/row_types" "Row Types (cached reference data)"

# Test user-specific endpoints (moderate caching)
echo -e "\n${YELLOW}USER-SPECIFIC DATA PERFORMANCE (Moderate Caching)${NC}"
echo "=============================================="

test_performance "/registry/last?limit=5" "Last 5 registry entries" "X-User-Id: $USER_ID"
test_performance "/registry/last?row_type_id=1&limit=10" "Last 10 budget entries" "X-User-Id: $USER_ID"
test_performance "/registry/last?row_type_id=2&limit=10" "Last 10 actual entries" "X-User-Id: $USER_ID"
test_performance "/products?limit=20" "Products list with pagination"

# Test complex report endpoints (should show significant caching benefits)
echo -e "\n${YELLOW}REPORT ENDPOINTS PERFORMANCE (Complex Queries)${NC}"
echo "============================================"

test_performance "/reports/budget-vs-actual" "Budget vs Actual Report" "X-User-Id: $USER_ID"
test_performance "/reports/period-summary" "Period Summary Report" "X-User-Id: $USER_ID"
test_performance "/reports/financial-center-breakdown" "Financial Center Breakdown" "X-User-Id: $USER_ID"
test_performance "/reports/monthly-trend" "Monthly Trend Analysis" "X-User-Id: $USER_ID"

# Test cache behavior specifically
echo -e "\n${YELLOW}CACHE BEHAVIOR TESTING${NC}"
echo "======================"

test_cache_behavior "/reference/periods" "Reference data caching"
test_cache_behavior "/registry/last?limit=5" "User-specific data caching"
test_cache_behavior "/reports/budget-vs-actual" "Complex report caching"

# Test concurrent performance
echo -e "\n${YELLOW}CONCURRENT PERFORMANCE TESTING${NC}"
echo "==============================="

test_concurrent_performance "/reference/periods" "Reference data under load" 10
test_concurrent_performance "/registry/last?limit=5" "User data under load" 8
test_concurrent_performance "/reports/budget-vs-actual" "Complex reports under load" 5

# Test memory usage (basic check)
echo -e "\n${YELLOW}BASIC RESOURCE USAGE CHECK${NC}"
echo "=========================="

echo "Checking basic resource usage patterns..."

# Make multiple requests to build up cache
echo "Building cache with multiple requests..."
for i in $(seq 1 20); do
    curl -s "$NODE_API_URL/reference/periods" >/dev/null 2>&1
    curl -s "$NODE_API_URL/registry/last?limit=5" -H "X-User-Id: $USER_ID" >/dev/null 2>&1
done

echo "Cache should now be populated for subsequent requests."

# Test with populated cache
echo "Testing with populated cache:"
test_performance "/reference/periods" "Periods (with populated cache)" "" 5
test_performance "/registry/last?limit=5" "Registry (with populated cache)" "X-User-Id: $USER_ID" 5

echo -e "\n${GREEN}Performance testing completed!${NC}"
echo ""
echo "Summary of findings:"
echo "- Reference data should show significant cache improvements (2+ hour TTL)"
echo "- User-specific data should show moderate cache improvements (5-10 minute TTL)"
echo "- Complex reports should benefit most from caching"
echo "- Concurrent requests should maintain good performance with cache"
echo ""
echo "Recommendations:"
echo "1. Monitor cache hit ratios in production"
echo "2. Adjust TTL values based on data update frequency"
echo "3. Consider Redis for distributed caching if scaling horizontally"
echo "4. Implement cache warming for critical data"
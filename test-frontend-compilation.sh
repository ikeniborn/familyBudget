#!/bin/bash
"""
Frontend compilation and type safety test script.
Tests TypeScript compilation, linting, and type checking for admin functionality.
"""

echo "🎨 Testing Frontend Compilation and Type Safety"
echo "=============================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

log_test() {
    local test_name="$1"
    local status="$2" 
    local message="$3"
    
    if [ "$status" = "PASS" ]; then
        echo -e "${GREEN}✅ [$test_name] $message${NC}"
        ((TESTS_PASSED++))
    elif [ "$status" = "FAIL" ]; then
        echo -e "${RED}❌ [$test_name] $message${NC}"
        ((TESTS_FAILED++))
    else
        echo -e "${YELLOW}⏭️ [$test_name] $message${NC}"
    fi
}

# Check if frontend container is running
echo -e "${BLUE}Checking frontend container status...${NC}"
if ! docker ps | grep -q "budget-frontend.*Up"; then
    log_test "CONTAINER_CHECK" "FAIL" "Frontend container is not running"
    echo "Please start the development environment with: ./scripts/dev.sh -d"
    exit 1
fi

log_test "CONTAINER_CHECK" "PASS" "Frontend container is running"

# Test TypeScript compilation
echo -e "${BLUE}Running TypeScript type checking...${NC}"
if docker exec budget-frontend npm run check > /tmp/ts_check.log 2>&1; then
    log_test "TYPESCRIPT_CHECK" "PASS" "TypeScript compilation successful"
else
    log_test "TYPESCRIPT_CHECK" "FAIL" "TypeScript compilation failed"
    echo -e "${RED}TypeScript errors:${NC}"
    cat /tmp/ts_check.log
fi

# Test ESLint
echo -e "${BLUE}Running ESLint...${NC}"
if docker exec budget-frontend npm run lint > /tmp/lint_check.log 2>&1; then
    log_test "ESLINT_CHECK" "PASS" "ESLint passed"
else
    log_test "ESLINT_CHECK" "FAIL" "ESLint failed" 
    echo -e "${RED}ESLint errors:${NC}"
    cat /tmp/lint_check.log
fi

# Test if frontend can build
echo -e "${BLUE}Testing frontend build...${NC}"
if docker exec budget-frontend npm run build > /tmp/build_check.log 2>&1; then
    log_test "BUILD_CHECK" "PASS" "Frontend build successful"
else
    log_test "BUILD_CHECK" "FAIL" "Frontend build failed"
    echo -e "${RED}Build errors:${NC}"
    tail -20 /tmp/build_check.log
fi

# Test specific admin type checking
echo -e "${BLUE}Checking admin types and interfaces...${NC}"

# Check if admin types are properly defined
ADMIN_TYPES=("AdminFinancialCenter" "AdminCostCenter" "AdminNomenclature")
for type_name in "${ADMIN_TYPES[@]}"; do
    if docker exec budget-frontend grep -r "$type_name" src/lib/types/ > /dev/null 2>&1; then
        log_test "ADMIN_TYPES" "PASS" "$type_name interface is defined"
    else
        log_test "ADMIN_TYPES" "FAIL" "$type_name interface not found"
    fi
done

# Check service methods
echo -e "${BLUE}Checking service methods...${NC}"
SERVICE_METHODS=("getAllWithUsers" "exportToCsv")
SERVICES=("financialCenters.service.ts" "costCenters.service.ts" "nomenclatures.service.ts")

for service in "${SERVICES[@]}"; do
    for method in "${SERVICE_METHODS[@]}"; do
        if docker exec budget-frontend grep -r "$method" "src/lib/services/$service" > /dev/null 2>&1; then
            log_test "SERVICE_METHODS" "PASS" "$method found in $service"
        else
            log_test "SERVICE_METHODS" "FAIL" "$method not found in $service"
        fi
    done
done

# Check component admin functionality
echo -e "${BLUE}Checking component admin functionality...${NC}"
COMPONENTS=("FinancialCenterManager.svelte" "CostCenterManager.svelte" "NomenclatureManager.svelte")

for component in "${COMPONENTS[@]}"; do
    if docker exec budget-frontend grep -r "isAdmin" "src/lib/components/reference/$component" > /dev/null 2>&1; then
        log_test "COMPONENT_ADMIN" "PASS" "$component has admin functionality"
    else
        log_test "COMPONENT_ADMIN" "FAIL" "$component missing admin functionality"
    fi
    
    if docker exec budget-frontend grep -r "getAllWithUsers" "src/lib/components/reference/$component" > /dev/null 2>&1; then
        log_test "COMPONENT_ADMIN_API" "PASS" "$component calls admin API methods"
    else
        log_test "COMPONENT_ADMIN_API" "FAIL" "$component doesn't call admin API methods"
    fi
done

# Check CSV export functionality
echo -e "${BLUE}Checking CSV export admin support...${NC}"
for component in "${COMPONENTS[@]}"; do
    if docker exec budget-frontend grep -r "exportToCsv.*isAdmin" "src/lib/components/reference/$component" > /dev/null 2>&1; then
        log_test "CSV_ADMIN_EXPORT" "PASS" "$component supports admin CSV export"
    else
        log_test "CSV_ADMIN_EXPORT" "FAIL" "$component doesn't support admin CSV export"
    fi
done

# Generate summary
echo
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}           TEST SUMMARY${NC}"
echo -e "${BLUE}========================================${NC}"
TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
SUCCESS_RATE=$(( TESTS_PASSED * 100 / TOTAL_TESTS ))

echo -e "Total Tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo -e "Success Rate: ${SUCCESS_RATE}%"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All frontend tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some frontend tests failed${NC}"
    exit 1
fi
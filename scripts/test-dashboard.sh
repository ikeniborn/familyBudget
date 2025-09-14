#!/bin/bash

# Dashboard Test Suite Runner
# Runs comprehensive tests for dashboard functionality including:
# - Frontend unit tests (service)
# - Frontend component tests
# - Backend integration tests
# - End-to-end tests (optional)

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RUN_E2E=${1:-"false"}  # Pass "true" as first argument to run E2E tests
COVERAGE=${2:-"false"} # Pass "true" as second argument for coverage reports

echo -e "${BLUE}🧪 Starting Dashboard Test Suite${NC}"
echo "=================================================="

# Check if containers are running
echo -e "${YELLOW}Checking container status...${NC}"
if ! docker ps | grep -q budget-frontend; then
    echo -e "${RED}❌ Frontend container not running. Please start with ./scripts/dev.sh${NC}"
    exit 1
fi

if ! docker ps | grep -q budget-backend; then
    echo -e "${RED}❌ Backend container not running. Please start with ./scripts/dev.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Containers are running${NC}"

# Function to run test with error handling
run_test() {
    local test_name="$1"
    local test_command="$2"

    echo ""
    echo -e "${BLUE}Running $test_name...${NC}"
    echo "----------------------------------------"

    if eval "$test_command"; then
        echo -e "${GREEN}✅ $test_name passed${NC}"
        return 0
    else
        echo -e "${RED}❌ $test_name failed${NC}"
        return 1
    fi
}

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Frontend Unit Tests - Dashboard Service
if run_test "Dashboard Service Unit Tests" \
    "docker exec budget-frontend npm run test dashboard.service.test.ts"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
    FAILED_TESTS+=("Dashboard Service Unit Tests")
fi

# Frontend Component Tests - Dashboard Page
if run_test "Dashboard Component Tests" \
    "docker exec budget-frontend npm run test dashboard.component.test.ts"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
    FAILED_TESTS+=("Dashboard Component Tests")
fi

# Backend Integration Tests
if run_test "Dashboard API Integration Tests" \
    "docker exec budget-backend python -m pytest tests/backend/test_dashboard_api.py -v"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
    FAILED_TESTS+=("Dashboard API Integration Tests")
fi

# Type Checking
if run_test "TypeScript Type Checking" \
    "docker exec budget-frontend npm run check"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
    FAILED_TESTS+=("TypeScript Type Checking")
fi

# Linting
if run_test "Code Linting" \
    "docker exec budget-frontend npm run lint && docker exec budget-backend black --check app/ && docker exec budget-backend mypy app/"; then
    ((TESTS_PASSED++))
else
    ((TESTS_FAILED++))
    FAILED_TESTS+=("Code Linting")
fi

# Coverage Reports (optional)
if [ "$COVERAGE" = "true" ]; then
    echo ""
    echo -e "${BLUE}📊 Generating Coverage Reports...${NC}"
    echo "----------------------------------------"

    # Frontend coverage
    echo -e "${YELLOW}Frontend test coverage:${NC}"
    docker exec budget-frontend npm run test:coverage dashboard || echo -e "${YELLOW}Frontend coverage report failed${NC}"

    # Backend coverage
    echo -e "${YELLOW}Backend test coverage:${NC}"
    docker exec budget-backend python -m pytest tests/backend/test_dashboard_api.py --cov=app.api.v1.endpoints.reports --cov-report=term-missing || echo -e "${YELLOW}Backend coverage report failed${NC}"
fi

# End-to-End Tests (optional, slower)
if [ "$RUN_E2E" = "true" ]; then
    echo ""
    echo -e "${YELLOW}⚠️  Running E2E tests (this may take longer)...${NC}"

    # Check if application is running and accessible
    if curl -s -f -o /dev/null "http://localhost:5173" && curl -s -f -o /dev/null "http://localhost:4000/health"; then
        if run_test "Dashboard End-to-End Tests" \
            "docker exec budget-frontend npx playwright test dashboard.e2e.test.ts"; then
            ((TESTS_PASSED++))
        else
            ((TESTS_FAILED++))
            FAILED_TESTS+=("Dashboard End-to-End Tests")
        fi
    else
        echo -e "${YELLOW}⚠️  Skipping E2E tests - application not accessible${NC}"
        echo "   Make sure both frontend (5173) and backend (4000) are running"
    fi
fi

# Summary
echo ""
echo "=================================================="
echo -e "${BLUE}📋 Test Summary${NC}"
echo "=================================================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! ($TESTS_PASSED/$((TESTS_PASSED + TESTS_FAILED)))${NC}"
    echo ""
    echo -e "${GREEN}✅ Dashboard functionality is ready for deployment${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed: $TESTS_FAILED/$((TESTS_PASSED + TESTS_FAILED))${NC}"
    echo ""
    echo -e "${RED}Failed tests:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "${RED}  - $test${NC}"
    done
    echo ""
    echo -e "${YELLOW}Please fix the failing tests before proceeding${NC}"
    exit 1
fi
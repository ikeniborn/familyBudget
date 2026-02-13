#!/bin/bash
# Helper script for running tests locally
# Usage: ./run-tests.sh [backend|frontend|e2e|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to run backend tests
run_backend_tests() {
    print_header "Backend Tests (pytest)"

    # Check if test database is running
    if ! docker ps | grep -q familybudget-postgres-test; then
        print_warning "Test database not running. Starting..."
        docker-compose -f docker-compose-test.yml up -d

        echo "Waiting for PostgreSQL to be ready..."
        until docker exec familybudget-postgres-test pg_isready -U familybudget 2>/dev/null; do
            echo -n "."
            sleep 1
        done
        echo ""
        print_success "PostgreSQL is ready"
    fi

    # Check if migrations applied
    print_warning "Applying migrations (if needed)..."
    DATABASE_URL="postgresql://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
        backend/.venv/bin/alembic -c backend/db/migrations/alembic.ini upgrade head

    # Run tests
    print_warning "Running backend tests..."
    set -a && source backend/.env.test && set +a
    PYTHONPATH="$SCRIPT_DIR" backend/.venv/bin/pytest backend/tests/ -v --tb=short

    print_success "Backend tests completed"
}

# Function to run frontend tests
run_frontend_tests() {
    print_header "Frontend Tests (TypeScript type check)"

    npm run type-check

    print_success "Frontend tests completed"
}

# Function to run E2E tests
run_e2e_tests() {
    print_header "E2E Tests (Playwright)"

    # Check if .env.test exists
    if [ ! -f ".env.test" ]; then
        print_error ".env.test not found!"
        echo "Create it with:"
        echo "  TEST_USER_EMAIL=e2e-test@example.com"
        echo "  TEST_USER_PASSWORD=YourPassword123!"
        echo "  BASE_URL=https://fbd.ikeniborn.ru"
        exit 1
    fi

    # Check if Playwright browsers installed
    if [ ! -d "$HOME/.cache/ms-playwright" ]; then
        print_warning "Playwright browsers not installed. Installing..."
        npx playwright install
    fi

    # Run E2E tests
    npm run test:e2e

    print_success "E2E tests completed"
}

# Main execution
case "${1:-all}" in
    backend)
        run_backend_tests
        ;;
    frontend)
        run_frontend_tests
        ;;
    e2e)
        run_e2e_tests
        ;;
    all)
        run_backend_tests
        echo ""
        run_frontend_tests
        echo ""
        run_e2e_tests
        echo ""
        print_header "All Tests Summary"
        print_success "All test suites completed successfully!"
        ;;
    *)
        echo "Usage: $0 [backend|frontend|e2e|all]"
        echo ""
        echo "Options:"
        echo "  backend   - Run backend pytest tests"
        echo "  frontend  - Run frontend TypeScript type checking"
        echo "  e2e       - Run Playwright E2E tests"
        echo "  all       - Run all test suites (default)"
        exit 1
        ;;
esac

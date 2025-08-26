#!/bin/bash

# Test runner script for Family Budget application
# Usage: ./scripts/test.sh [backend|frontend|integration|all]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_error() {
    echo -e "${RED}Error: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}Warning: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Run backend tests
run_backend_tests() {
    print_header "Running Backend Tests (FastAPI)"
    
    # Check if backend container exists
    if ! docker ps -a | grep -q budget-backend; then
        print_warning "Backend container not found. Starting services..."
        ./scripts/dev.sh -d
        sleep 5
    fi
    
    # Run linting
    echo "Running linting..."
    docker exec budget-backend black --check app/ tests/ || true
    docker exec budget-backend flake8 app/ tests/ --max-line-length=100 || true
    docker exec budget-backend mypy app/ --ignore-missing-imports || true
    
    # Run tests with coverage
    echo "Running tests with coverage..."
    docker exec budget-backend python -m pytest tests/ -v --cov=app --cov-report=term --cov-report=html
    
    print_success "Backend tests completed!"
}

# Run frontend tests
run_frontend_tests() {
    print_header "Running Frontend Tests (SvelteKit)"
    
    # Check if frontend container exists
    if ! docker ps -a | grep -q budget-frontend; then
        print_warning "Frontend container not found. Starting services..."
        ./scripts/dev.sh -d
        sleep 5
    fi
    
    # Run linting
    echo "Running linting..."
    docker exec budget-frontend npm run lint || true
    
    # Run type checking
    echo "Running type checking..."
    docker exec budget-frontend npm run check
    
    # Run tests with coverage
    echo "Running tests with coverage..."
    docker exec budget-frontend npm run test:coverage
    
    print_success "Frontend tests completed!"
}

# Run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"
    
    # Ensure services are running
    if ! docker ps | grep -q budget-backend; then
        print_warning "Starting services for integration tests..."
        ./scripts/dev.sh -d
        sleep 10
    fi
    
    # Run integration tests
    echo "Running integration test suite..."
    docker exec budget-backend python -m pytest tests/test_integration.py -v
    
    print_success "Integration tests completed!"
}

# Run all tests
run_all_tests() {
    print_header "Running All Tests"
    
    run_backend_tests
    echo ""
    run_frontend_tests
    echo ""
    run_integration_tests
    
    print_header "Test Summary"
    print_success "All tests completed successfully!"
    
    echo ""
    echo "Coverage reports available at:"
    echo "  - Backend: backend-fastapi/htmlcov/index.html"
    echo "  - Frontend: frontend-svelte/coverage/index.html"
}

# Generate coverage report
generate_coverage_report() {
    print_header "Generating Coverage Reports"
    
    # Backend coverage
    if [ -f "backend-fastapi/htmlcov/index.html" ]; then
        echo "Backend coverage report: backend-fastapi/htmlcov/index.html"
    else
        print_warning "Backend coverage report not found. Run backend tests first."
    fi
    
    # Frontend coverage
    if [ -f "frontend-svelte/coverage/index.html" ]; then
        echo "Frontend coverage report: frontend-svelte/coverage/index.html"
    else
        print_warning "Frontend coverage report not found. Run frontend tests first."
    fi
    
    # Try to open coverage reports in browser
    if command -v xdg-open > /dev/null; then
        xdg-open backend-fastapi/htmlcov/index.html 2>/dev/null || true
        xdg-open frontend-svelte/coverage/index.html 2>/dev/null || true
    elif command -v open > /dev/null; then
        open backend-fastapi/htmlcov/index.html 2>/dev/null || true
        open frontend-svelte/coverage/index.html 2>/dev/null || true
    fi
}

# Quick test (only unit tests, no integration)
run_quick_tests() {
    print_header "Running Quick Tests (Unit Tests Only)"
    
    # Backend unit tests
    echo "Running backend unit tests..."
    docker exec budget-backend python -m pytest tests/ -v \
        --ignore=tests/test_integration.py \
        -x  # Stop on first failure
    
    # Frontend unit tests
    echo "Running frontend unit tests..."
    docker exec budget-frontend npm run test
    
    print_success "Quick tests completed!"
}

# Watch mode for development
run_watch_tests() {
    print_header "Starting Test Watch Mode"
    
    # Start backend test watch in background
    echo "Starting backend test watch..."
    docker exec -d budget-backend python -m pytest tests/ \
        --ignore=tests/test_integration.py \
        --watch
    
    # Start frontend test watch
    echo "Starting frontend test watch..."
    docker exec budget-frontend npm run test:ui
}

# Main script
main() {
    check_docker
    
    case "${1:-all}" in
        backend)
            run_backend_tests
            ;;
        frontend)
            run_frontend_tests
            ;;
        integration)
            run_integration_tests
            ;;
        all)
            run_all_tests
            ;;
        coverage)
            generate_coverage_report
            ;;
        quick)
            run_quick_tests
            ;;
        watch)
            run_watch_tests
            ;;
        *)
            echo "Usage: $0 [backend|frontend|integration|all|coverage|quick|watch]"
            echo ""
            echo "Options:"
            echo "  backend      - Run backend tests only"
            echo "  frontend     - Run frontend tests only"
            echo "  integration  - Run integration tests only"
            echo "  all          - Run all tests (default)"
            echo "  coverage     - Generate and open coverage reports"
            echo "  quick        - Run unit tests only (no integration)"
            echo "  watch        - Start tests in watch mode"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
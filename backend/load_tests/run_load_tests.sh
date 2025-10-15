#!/bin/bash

# ============================================================================
# Load Testing Runner Script
# EPIC-005: TASK-016, TASK-017, TASK-018
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
HOST="${LOAD_TEST_HOST:-http://localhost:8000}"
USERS="${LOAD_TEST_USERS:-50}"
SPAWN_RATE="${LOAD_TEST_SPAWN_RATE:-10}"
DURATION="${LOAD_TEST_DURATION:-300}"

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Print section header
print_header() {
    echo ""
    print_message "$BLUE" "========================================================================"
    print_message "$BLUE" "$@"
    print_message "$BLUE" "========================================================================"
    echo ""
}

# Check if Locust is installed
check_dependencies() {
    print_header "CHECKING DEPENDENCIES"

    if ! command -v locust &> /dev/null; then
        print_message "$RED" "✗ Locust is not installed"
        print_message "$YELLOW" "Install with: pip install -r requirements_loadtest.txt"
        exit 1
    fi

    print_message "$GREEN" "✓ Locust is installed: $(locust --version)"

    if ! python3 -c "import asyncpg" 2>/dev/null; then
        print_message "$YELLOW" "⚠ asyncpg not installed (needed for database tests)"
        print_message "$YELLOW" "Install with: pip install asyncpg"
    else
        print_message "$GREEN" "✓ asyncpg is installed"
    fi

    echo ""
}

# Test 1: API Load Test (Read-Heavy)
test_api_read_heavy() {
    print_header "TEST 1: API LOAD TEST (READ-HEAVY)"
    print_message "$YELLOW" "Simulating read-heavy API usage"
    print_message "$YELLOW" "Users: $USERS | Spawn Rate: $SPAWN_RATE | Duration: ${DURATION}s"

    locust -f locustfile.py \
        ReadOnlyAPIUser \
        --host="$HOST" \
        --users="$USERS" \
        --spawn-rate="$SPAWN_RATE" \
        --run-time="${DURATION}s" \
        --headless \
        --csv=results/api_read_heavy \
        --html=results/api_read_heavy.html

    print_message "$GREEN" "✓ Test completed. Results saved to results/api_read_heavy.*"
}

# Test 2: API Load Test (Mixed)
test_api_mixed() {
    print_header "TEST 2: API LOAD TEST (MIXED READ/WRITE)"
    print_message "$YELLOW" "Simulating mixed API usage (reads + writes)"
    print_message "$YELLOW" "Users: $USERS | Spawn Rate: $SPAWN_RATE | Duration: ${DURATION}s"

    locust -f locustfile.py \
        APIUser \
        --host="$HOST" \
        --users="$USERS" \
        --spawn-rate="$SPAWN_RATE" \
        --run-time="${DURATION}s" \
        --headless \
        --csv=results/api_mixed \
        --html=results/api_mixed.html

    print_message "$GREEN" "✓ Test completed. Results saved to results/api_mixed.*"
}

# Test 3: API Load Test (Write-Heavy)
test_api_write_heavy() {
    print_header "TEST 3: API LOAD TEST (WRITE-HEAVY)"
    print_message "$YELLOW" "Simulating write-heavy API usage"
    print_message "$YELLOW" "Users: $USERS | Spawn Rate: $SPAWN_RATE | Duration: ${DURATION}s"

    locust -f locustfile.py \
        WriteHeavyAPIUser \
        --host="$HOST" \
        --users="$USERS" \
        --spawn-rate="$SPAWN_RATE" \
        --run-time="${DURATION}s" \
        --headless \
        --csv=results/api_write_heavy \
        --html=results/api_write_heavy.html

    print_message "$GREEN" "✓ Test completed. Results saved to results/api_write_heavy.*"
}

# Test 4: API Stress Test (High Load)
test_api_stress() {
    print_header "TEST 4: API STRESS TEST (HIGH LOAD)"
    print_message "$YELLOW" "Testing with 100 users @ 20/sec for 5 minutes"

    locust -f locustfile.py \
        APIUser \
        --host="$HOST" \
        --users=100 \
        --spawn-rate=20 \
        --run-time=300s \
        --headless \
        --csv=results/api_stress \
        --html=results/api_stress.html

    print_message "$GREEN" "✓ Stress test completed. Results saved to results/api_stress.*"
}

# Test 5: Database Load Test
test_database() {
    print_header "TEST 5: DATABASE LOAD TEST"
    print_message "$YELLOW" "Testing database with direct queries"
    print_message "$YELLOW" "Connections: 50 | QPS: 100 | Duration: ${DURATION}s"

    python3 database_loadtest.py \
        --connections=50 \
        --qps=100 \
        --duration="$DURATION" \
        --read-ratio=0.8 \
        --test-type=sustained

    print_message "$GREEN" "✓ Database test completed"
}

# Test 6: Database Burst Test
test_database_burst() {
    print_header "TEST 6: DATABASE BURST TEST"
    print_message "$YELLOW" "Testing database with burst load"
    print_message "$YELLOW" "Connections: 100 | Concurrent Queries: 5000"

    python3 database_loadtest.py \
        --connections=100 \
        --qps=100 \
        --duration=50 \
        --read-ratio=0.8 \
        --test-type=burst

    print_message "$GREEN" "✓ Database burst test completed"
}

# Test 7: Run Locust Web UI
test_interactive() {
    print_header "INTERACTIVE MODE: LOCUST WEB UI"
    print_message "$YELLOW" "Starting Locust web interface..."
    print_message "$YELLOW" "Open browser: http://localhost:8089"
    print_message "$YELLOW" "Host: $HOST"
    print_message "$YELLOW" "Press Ctrl+C to stop"

    locust -f locustfile.py --host="$HOST"
}

# Run all tests
test_all() {
    print_header "RUNNING ALL LOAD TESTS"

    # Create results directory
    mkdir -p results

    # Run tests sequentially
    test_api_read_heavy
    sleep 5

    test_api_mixed
    sleep 5

    test_api_write_heavy
    sleep 5

    test_api_stress
    sleep 5

    test_database
    sleep 5

    test_database_burst

    print_header "ALL TESTS COMPLETED"
    print_message "$GREEN" "Results saved in results/ directory"
    print_message "$YELLOW" "View HTML reports with: open results/*.html"
}

# Show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS] COMMAND

Load Testing Runner for Family Budget Application

COMMANDS:
    api-read         Run API load test (read-heavy)
    api-mixed        Run API load test (mixed read/write)
    api-write        Run API load test (write-heavy)
    api-stress       Run API stress test (high load)
    database         Run database load test
    database-burst   Run database burst test
    interactive      Start Locust web UI (interactive mode)
    all              Run all tests sequentially
    help             Show this help message

OPTIONS:
    --host HOST      API host (default: http://localhost:8000)
    --users N        Number of concurrent users (default: 50)
    --spawn-rate N   User spawn rate per second (default: 10)
    --duration N     Test duration in seconds (default: 300)

ENVIRONMENT VARIABLES:
    LOAD_TEST_HOST          API host
    LOAD_TEST_USERS         Number of users
    LOAD_TEST_SPAWN_RATE    Spawn rate
    LOAD_TEST_DURATION      Duration

EXAMPLES:
    # Run API mixed test with default settings
    $0 api-mixed

    # Run stress test with custom settings
    $0 --users 100 --spawn-rate 20 --duration 600 api-stress

    # Run all tests
    $0 all

    # Start interactive web UI
    $0 interactive

    # Use environment variables
    LOAD_TEST_USERS=100 LOAD_TEST_DURATION=600 $0 api-read

EOF
}

# Parse options
while [[ $# -gt 0 ]]; do
    case $1 in
        --host)
            HOST="$2"
            shift 2
            ;;
        --users)
            USERS="$2"
            shift 2
            ;;
        --spawn-rate)
            SPAWN_RATE="$2"
            shift 2
            ;;
        --duration)
            DURATION="$2"
            shift 2
            ;;
        api-read)
            check_dependencies
            test_api_read_heavy
            exit 0
            ;;
        api-mixed)
            check_dependencies
            test_api_mixed
            exit 0
            ;;
        api-write)
            check_dependencies
            test_api_write_heavy
            exit 0
            ;;
        api-stress)
            check_dependencies
            test_api_stress
            exit 0
            ;;
        database)
            check_dependencies
            test_database
            exit 0
            ;;
        database-burst)
            check_dependencies
            test_database_burst
            exit 0
            ;;
        interactive)
            check_dependencies
            test_interactive
            exit 0
            ;;
        all)
            check_dependencies
            test_all
            exit 0
            ;;
        help|--help|-h)
            show_usage
            exit 0
            ;;
        *)
            print_message "$RED" "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# If no command specified, show usage
show_usage

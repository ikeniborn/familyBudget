#!/bin/bash
# Health check script for E2E test environment
# Waits for all Docker Compose services to be ready before running tests
#
# Services checked:
# - PostgreSQL (pg_isready)
# - Redis (redis-cli ping)
# - Backend (HTTP /health endpoint)
# - Nginx (HTTP root endpoint)
#
# Exit codes:
# - 0: All services ready
# - 1: Timeout or service failure

set -euo pipefail

# Configuration
TIMEOUT=120  # Maximum wait time in seconds
INTERVAL=2   # Check interval in seconds
START_TIME=$(date +%s)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if timeout exceeded
check_timeout() {
    local current_time=$(date +%s)
    local elapsed=$((current_time - START_TIME))

    if [ $elapsed -ge $TIMEOUT ]; then
        log_error "Timeout exceeded (${TIMEOUT}s). Services failed to start."
        return 1
    fi

    return 0
}

# Wait for PostgreSQL
wait_for_postgres() {
    log_info "Waiting for PostgreSQL..."

    while ! docker exec e2e-familybudget-postgres pg_isready -U familybudget_test -d familybudget_test > /dev/null 2>&1; do
        if ! check_timeout; then
            log_error "PostgreSQL failed to start"
            return 1
        fi

        log_warn "PostgreSQL not ready, retrying in ${INTERVAL}s..."
        sleep $INTERVAL
    done

    log_info "✓ PostgreSQL is ready"
    return 0
}

# Wait for Redis
wait_for_redis() {
    log_info "Waiting for Redis..."

    while ! docker exec e2e-familybudget-redis redis-cli -a test_redis_password --no-auth-warning ping 2>/dev/null | grep -q "PONG"; do
        if ! check_timeout; then
            log_error "Redis failed to start"
            return 1
        fi

        log_warn "Redis not ready, retrying in ${INTERVAL}s..."
        sleep $INTERVAL
    done

    log_info "✓ Redis is ready"
    return 0
}

# Wait for Backend API
wait_for_backend() {
    log_info "Waiting for Backend API..."

    local retries=0
    local max_retries=$((TIMEOUT / INTERVAL))

    while [ $retries -lt $max_retries ]; do
        if curl -f -s http://localhost:8000/health > /dev/null 2>&1; then
            log_info "✓ Backend API is ready"
            return 0
        fi

        if ! check_timeout; then
            log_error "Backend API failed to start"
            return 1
        fi

        log_warn "Backend API not ready, retrying in ${INTERVAL}s... (attempt $((retries + 1))/${max_retries})"
        sleep $INTERVAL
        retries=$((retries + 1))
    done

    log_error "Backend API failed to start after ${max_retries} attempts"
    return 1
}

# Wait for Nginx
wait_for_nginx() {
    log_info "Waiting for Nginx..."

    local retries=0
    local max_retries=$((TIMEOUT / INTERVAL))

    while [ $retries -lt $max_retries ]; do
        if curl -f -s http://localhost/ > /dev/null 2>&1; then
            log_info "✓ Nginx is ready"
            return 0
        fi

        if ! check_timeout; then
            log_error "Nginx failed to start"
            return 1
        fi

        log_warn "Nginx not ready, retrying in ${INTERVAL}s... (attempt $((retries + 1))/${max_retries})"
        sleep $INTERVAL
        retries=$((retries + 1))
    done

    log_error "Nginx failed to start after ${max_retries} attempts"
    return 1
}

# Main function
main() {
    log_info "Starting health checks for E2E environment..."
    log_info "Timeout: ${TIMEOUT}s, Interval: ${INTERVAL}s"

    # Check services in dependency order
    if ! wait_for_postgres; then
        return 1
    fi

    if ! wait_for_redis; then
        return 1
    fi

    if ! wait_for_backend; then
        return 1
    fi

    if ! wait_for_nginx; then
        return 1
    fi

    local end_time=$(date +%s)
    local total_time=$((end_time - START_TIME))

    log_info "======================================"
    log_info "✓ All services are ready!"
    log_info "Total startup time: ${total_time}s"
    log_info "======================================"

    return 0
}

# Run main function
main
exit $?

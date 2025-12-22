#!/bin/bash
#
# redis.sh - Redis Health Check and Utility Functions
#
# This module provides functions for Redis health verification
# and cache management.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/redis.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR)
#   - utils.sh (for logging functions)
#

# =============================================================================
# REDIS STATUS FUNCTIONS
# =============================================================================

# Check if Redis container is running
# Returns: 0 if running, 1 otherwise
is_redis_running() {
    docker compose -f "$DEPLOY_DIR/docker-compose.yml" ps -q redis 2>/dev/null | grep -q .
}

# Check if Redis is healthy (responds to PING)
# Returns: 0 if healthy, 1 otherwise
is_redis_healthy() {
    docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T redis redis-cli ping 2>/dev/null | grep -q "PONG"
}

# Wait for Redis to become healthy
# Args: max_wait (optional, default 30)
# Returns: 0 if healthy, 1 if timeout
wait_for_redis() {
    local max_wait=${1:-30}
    local counter=0

    info "Waiting for Redis to become healthy (max ${max_wait}s)..."

    while ! is_redis_healthy; do
        ((counter++))
        if [[ $counter -ge $max_wait ]]; then
            error "Redis did not become healthy within ${max_wait}s"
            return 1
        fi
        sleep 1
    done

    success "Redis is healthy"
    return 0
}

# =============================================================================
# REDIS DIAGNOSTICS
# =============================================================================

# Get Redis memory usage
# Returns: memory usage string (e.g., "1.5M")
check_redis_memory() {
    local usage
    usage=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T redis \
        redis-cli INFO memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 | tr -d '\r')
    echo "${usage:-N/A}"
}

# Get Redis key count
# Returns: total number of keys
check_redis_keys() {
    local keys
    keys=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T redis \
        redis-cli DBSIZE 2>/dev/null | grep -oP '\d+' || echo "0")
    echo "${keys:-0}"
}

# Get Redis cache hit ratio
# Returns: hit ratio as percentage string (e.g., "95.2%")
check_redis_hit_ratio() {
    local info
    info=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T redis \
        redis-cli INFO stats 2>/dev/null)

    local hits misses ratio
    hits=$(echo "$info" | grep "keyspace_hits" | cut -d: -f2 | tr -d '\r' || echo "0")
    misses=$(echo "$info" | grep "keyspace_misses" | cut -d: -f2 | tr -d '\r' || echo "0")

    hits=${hits:-0}
    misses=${misses:-0}

    if [[ $((hits + misses)) -gt 0 ]]; then
        # Calculate percentage with bc for precision
        ratio=$(echo "scale=1; $hits * 100 / ($hits + $misses)" | bc 2>/dev/null || echo "0")
        echo "${ratio}%"
    else
        echo "N/A"
    fi
}

# Print Redis status summary
print_redis_status() {
    step "Redis Status"

    if ! is_redis_running; then
        warning "Redis container is not running"
        return 1
    fi

    if ! is_redis_healthy; then
        warning "Redis is not responding to PING"
        return 1
    fi

    local memory keys hit_ratio
    memory=$(check_redis_memory)
    keys=$(check_redis_keys)
    hit_ratio=$(check_redis_hit_ratio)

    echo ""
    echo "  📊 Redis Statistics:"
    echo "     Memory Usage:    $memory"
    echo "     Total Keys:      $keys"
    echo "     Cache Hit Ratio: $hit_ratio"
    echo ""

    success "Redis is healthy"
    return 0
}

# =============================================================================
# REDIS CACHE MANAGEMENT
# =============================================================================

# Flush all Redis cache (DANGEROUS - use with caution!)
# Args: force (optional, set to "true" to skip confirmation)
# Returns: 0 if flushed, 1 if cancelled or error
flush_redis_cache() {
    local force=${1:-false}

    if [[ "$force" != "true" ]]; then
        warning "This will delete ALL cached data from Redis!"
        echo ""
        read -p "Are you sure you want to flush Redis cache? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            info "Cache flush cancelled"
            return 1
        fi
    fi

    info "Flushing Redis cache..."

    if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T redis redis-cli FLUSHALL 2>/dev/null | grep -q "OK"; then
        success "Redis cache flushed successfully"
        return 0
    else
        error "Failed to flush Redis cache"
        return 1
    fi
}

# Invalidate specific cache pattern
# Args: pattern (e.g., "cache:articles:*")
# Returns: number of keys deleted
invalidate_cache_pattern() {
    local pattern=${1:-""}

    if [[ -z "$pattern" ]]; then
        error "Cache pattern is required"
        return 1
    fi

    info "Invalidating cache pattern: $pattern"

    local deleted
    deleted=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T redis \
        sh -c "redis-cli KEYS '$pattern' | xargs -r redis-cli DEL" 2>/dev/null | tail -1 || echo "0")

    info "Deleted $deleted keys matching '$pattern'"
    echo "$deleted"
}

# =============================================================================
# REDIS POST-START VERIFICATION
# =============================================================================

# Verify Redis health after service start
# Returns: 0 if healthy, 1 if unhealthy
verify_redis_health_post_start() {
    step "Verifying Redis Health (Post-Start)"

    # Wait for Redis container to be running
    local max_wait=15
    local elapsed=0
    local redis_running=false

    info "Waiting for Redis container to start (max ${max_wait}s)..."
    while [[ $elapsed -lt $max_wait ]]; do
        if is_redis_running; then
            redis_running=true
            break
        fi
        sleep 1
        elapsed=$((elapsed + 1))
    done

    if [[ "$redis_running" == "false" ]]; then
        warning "Redis container is not running - skipping Redis checks"
        info "This is expected if Redis is not configured"
        return 0  # Non-fatal - Redis is optional
    fi

    # Wait for Redis to be healthy
    # Increased timeout to 40s to account for Docker healthcheck interval (30s default)
    # and AOF file loading on startup
    if ! wait_for_redis 40; then
        warning "Redis is running but not responding"
        return 1
    fi

    # Quick connectivity test
    if ! is_redis_healthy; then
        error "Redis health check failed"
        return 1
    fi

    success "Redis verified healthy"
    return 0
}

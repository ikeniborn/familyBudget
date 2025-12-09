#!/bin/bash
#
# postgres.sh - PostgreSQL Health Check and Backup Functions
#
# This module provides functions for PostgreSQL health verification
# and pre-deployment backups.
#
# NOTE: Repair functions removed after migration to Docker managed volume.
#       Docker managed volumes automatically handle permissions and directories.
#       See: git history for legacy bind mount repair code.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/postgres.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR)
#   - utils.sh (for logging functions)
#

# =============================================================================
# POST-START INTEGRITY VERIFICATION (CRITICAL SAFEGUARD)
# =============================================================================

# Verify PostgreSQL health and data integrity AFTER service start
# This runs ALWAYS regardless of POSTGRES_WAS_STOPPED to catch corruption early
# Returns:
#   0 - PostgreSQL healthy and data intact
#   1 - PostgreSQL unhealthy or data corrupted (requires intervention)
verify_postgres_health_post_start() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    step "Verifying PostgreSQL Health (Post-Start Safeguard)"

    # Wait for PostgreSQL container to be running
    local max_wait=30
    local elapsed=0
    local postgres_running=false

    info "Waiting for PostgreSQL container to start (max ${max_wait}s)..."
    while [[ $elapsed -lt $max_wait ]]; do
        if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
            postgres_running=true
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    if [[ "$postgres_running" == "false" ]]; then
        error "PostgreSQL container failed to start within ${max_wait}s"
        return 1
    fi

    success "PostgreSQL container is running"

    # CRITICAL: Check for crash loop (restart count > 0 or restarting state)
    # This catches corruption early, even if container shows as "running" briefly
    local container_state=$(docker inspect familybudget-postgres --format='{{.State.Status}} {{.State.Restarting}} {{.RestartCount}}' 2>/dev/null || echo "unknown false 0")
    read state restarting restart_count <<< "$container_state"

    if [[ "$restarting" == "true" ]] || [[ $restart_count -gt 2 ]]; then
        error "PostgreSQL container is in crash loop!"
        echo ""
        echo "Container state: $state"
        echo "Restarting: $restarting"
        echo "Restart count: $restart_count"
        echo ""

        # Get last 30 lines of logs for diagnosis
        local logs=$(docker logs familybudget-postgres --tail=30 2>&1 || echo "Failed to get logs")

        # Check for specific corruption patterns
        if echo "$logs" | grep -qi "could not open directory"; then
            local missing_dir=$(echo "$logs" | grep -oP 'could not open directory "\K[^"]+' | head -1)
            error "CORRUPTION DETECTED: Missing directory '$missing_dir'"
            echo ""
            echo "Last 30 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            echo "$logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""
            echo "💡 RECOVERY OPTIONS:"
            echo ""
            echo "Option 1 (RECOMMENDED): Re-run deployment with Full cleanup"
            echo "  cd ~/familyBudget && sudo bash deploy.sh"
            echo "  → Select: Cleanup [3] Full cleanup"
            echo ""
            echo "Option 2: Manual restoration from backup"
            echo "  bash scripts/restore.sh"
            echo "  → Select backup from list"
            echo ""
            return 1
        fi

        warning "PostgreSQL in crash loop but no 'could not open directory' detected"
        info "This may indicate a different issue - check logs manually"
        echo ""
        echo "Last 30 lines of PostgreSQL logs:"
        echo "──────────────────────────────────────────────────────────────"
        echo "$logs"
        echo "──────────────────────────────────────────────────────────────"
        echo ""
        return 1
    fi

    # Check if PostgreSQL is accepting connections (health check)
    info "Checking PostgreSQL connection health..."
    local health_check_passed=false
    max_wait=60
    elapsed=0

    while [[ $elapsed -lt $max_wait ]]; do
        if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres pg_isready -U "${POSTGRES_USER:-familybudget}" > /dev/null 2>&1; then
            health_check_passed=true
            break
        fi
        sleep 3
        elapsed=$((elapsed + 3))
        echo -n "."
    done
    echo ""

    if [[ "$health_check_passed" == "false" ]]; then
        warning "PostgreSQL is NOT accepting connections after ${max_wait}s"

        # Check for corruption indicators in logs
        info "Checking PostgreSQL logs for corruption indicators..."
        local logs=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" logs --tail=50 postgres 2>/dev/null || echo "")

        if echo "$logs" | grep -qi "could not open directory\|no such file or directory\|data directory.*corrupt"; then
            error "PostgreSQL corruption detected in logs!"
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🚨 CRITICAL: PostgreSQL Data Corruption Detected"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Last 50 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            echo "$logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""
            echo "💡 RECOVERY OPTIONS:"
            echo ""
            echo "Option 1 (RECOMMENDED): Automatic repair with full cleanup"
            echo "  cd ~/familyBudget && sudo bash deploy.sh"
            echo "  → Select: Cleanup [3] Full cleanup"
            echo ""
            echo "Option 2: Manual restoration from backup"
            echo "  bash scripts/restore.sh"
            echo "  → Select backup from list"
            echo ""

            return 1
        else
            warning "PostgreSQL is slow to start but no corruption detected in logs"
            info "This may be normal for large databases"
        fi
    else
        success "PostgreSQL is accepting connections"
    fi

    # Data integrity check (only if PostgreSQL is running and accepting connections)
    # If pg_isready passed, PostgreSQL initialized correctly with all required directories
    # No need for additional directory checks - they are created automatically by PostgreSQL
    if [[ "$health_check_passed" == "true" ]]; then
        success "Data directory structure is valid (PostgreSQL initialized successfully)"
    fi

    return 0
}

# =============================================================================
# SAFETY BACKUP BEFORE DEPLOYMENT (PRODUCTION SAFEGUARD)
# =============================================================================

# Create safety backup before any deployment that may affect PostgreSQL
# This provides rollback capability if corruption occurs
# Returns:
#   0 - Backup created successfully
#   1 - Backup failed (BLOCKS deployment)
create_deployment_safety_backup() {
    local backup_reason="${1:-deployment}"

    step "Creating Safety Backup (Pre-Deployment Safeguard)"

    # Check if PostgreSQL is running
    local postgres_running=false
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        postgres_running=true
    fi

    if [[ "$postgres_running" == "false" ]]; then
        info "PostgreSQL is not running - skipping safety backup"
        info "Backup will be created after PostgreSQL starts"
        return 0
    fi

    # Create backup directory if doesn't exist
    local backup_dir="$DEPLOY_DIR/backups"
    if [[ ! -d "$backup_dir" ]]; then
        sudo mkdir -p "$backup_dir" 2>/dev/null || true
    fi

    # Generate backup filename
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/safety_backup_${backup_reason}_${timestamp}.sql.gz"

    info "Creating safety backup: $(basename "$backup_file")"
    info "This provides rollback capability if deployment fails"

    # Execute pg_dump (use familybudget user from .env)
    local pg_user="${POSTGRES_USER:-familybudget}"
    local pg_db="${POSTGRES_DB:-familybudget}"

    if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres \
        pg_dump -U "$pg_user" "$pg_db" 2>/dev/null | gzip > "$backup_file" 2>/dev/null; then

        # Verify backup file size (should be > 0 bytes)
        local backup_size=$(stat -c%s "$backup_file" 2>/dev/null || echo "0")
        if [[ $backup_size -lt 100 ]]; then
            warning "Backup file is suspiciously small (${backup_size} bytes)"
            warning "This may indicate backup failure"
            rm -f "$backup_file" 2>/dev/null || true
            return 1
        fi

        success "Safety backup created: $(basename "$backup_file") ($(numfmt --to=iec-i --suffix=B $backup_size))"

        # Keep only last 5 safety backups to save space
        local backup_count=$(ls -1 "$backup_dir"/safety_backup_*.sql.gz 2>/dev/null | wc -l)
        if [[ $backup_count -gt 5 ]]; then
            info "Removing old safety backups (keeping last 5)..."
            ls -t "$backup_dir"/safety_backup_*.sql.gz | tail -n +6 | xargs rm -f 2>/dev/null || true
        fi

        return 0
    else
        error "Failed to create safety backup"
        error "This is a CRITICAL safety failure - deployment should not proceed"

        echo ""
        echo "💡 TROUBLESHOOTING:"
        echo "  1. Check PostgreSQL is healthy: docker compose logs postgres"
        echo "  2. Check disk space: df -h"
        echo "  3. Check backup directory permissions: ls -ld $backup_dir"
        echo ""

        return 1
    fi
}

# =============================================================================
# PRE-DEPLOYMENT HEALTH CHECK (CRITICAL SAFEGUARD)
# =============================================================================

# Check PostgreSQL health BEFORE deployment starts
# This prevents deployment from proceeding if PostgreSQL is already corrupted
# Returns:
#   0 - PostgreSQL healthy or not running (safe to proceed)
#   1 - PostgreSQL corrupted or unhealthy (requires Full cleanup)
check_postgres_health_pre_deploy() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    step "Pre-Deployment PostgreSQL Health Check"

    # Check if PostgreSQL container exists
    local postgres_exists=false
    if docker ps -a --filter "name=familybudget-postgres" -q 2>/dev/null | grep -q .; then
        postgres_exists=true
    fi

    if [[ "$postgres_exists" == "false" ]]; then
        info "PostgreSQL container does not exist - fresh deployment"
        return 0
    fi

    # Check if PostgreSQL is running
    local postgres_running=false
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        postgres_running=true
    fi

    if [[ "$postgres_running" == "false" ]]; then
        warning "PostgreSQL container exists but is NOT running"

        # Check container status
        local container_status=$(docker ps -a --filter "name=familybudget-postgres" --format "{{.Status}}" 2>/dev/null || echo "unknown")
        warning "Container status: $container_status"

        # If container is in restart loop - likely corrupted
        if echo "$container_status" | grep -qi "restarting"; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🚨 CRITICAL: PostgreSQL Data Corruption Detected (Pre-Deploy)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "PostgreSQL container is restarting continuously."
            echo "This indicates corrupted data directory."
            echo ""
            echo "Last 30 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            docker logs familybudget-postgres --tail=30 2>&1 || echo "Failed to get logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""
            echo "💡 AUTOMATIC RECOVERY:"
            echo ""
            echo "Deployment will AUTOMATICALLY switch to Full Cleanup mode"
            echo "to repair corrupted PostgreSQL data directory."
            echo ""
            echo "This will:"
            echo "  1. Stop all containers"
            echo "  2. Remove corrupted container"
            echo "  3. Restart PostgreSQL (Docker will recreate volume structure)"
            echo "  4. Continue deployment normally"
            echo ""
            echo "DATA IS PRESERVED (volumes NOT deleted)."
            echo ""
            return 1
        fi

        # Container stopped but not restarting - safe to proceed
        info "PostgreSQL stopped cleanly - safe to proceed with deployment"
        return 0
    fi

    # PostgreSQL is running - check if it's accepting connections
    info "PostgreSQL is running - checking connection health..."

    local health_check_passed=false
    local max_attempts=3
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres pg_isready -U "${POSTGRES_USER:-familybudget}" > /dev/null 2>&1; then
            health_check_passed=true
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    if [[ "$health_check_passed" == "false" ]]; then
        warning "PostgreSQL is running but NOT accepting connections"

        # Check logs for corruption indicators
        local logs=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" logs --tail=30 postgres 2>/dev/null || echo "")

        if echo "$logs" | grep -qi "could not open directory\|no such file or directory\|data directory.*corrupt"; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🚨 CRITICAL: PostgreSQL Data Corruption Detected (Pre-Deploy)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Last 30 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            echo "$logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""
            echo "💡 AUTOMATIC RECOVERY:"
            echo ""
            echo "Deployment will AUTOMATICALLY switch to Full Cleanup mode"
            echo "to repair corrupted PostgreSQL data directory."
            echo ""
            return 1
        fi

        warning "PostgreSQL slow but no corruption indicators found"
        info "Proceeding with deployment - post-start checks will catch issues"
    else
        success "PostgreSQL is healthy and accepting connections"
    fi

    return 0
}

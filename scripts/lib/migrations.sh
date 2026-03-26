#!/bin/bash
#
# migrations.sh - Database Migrations
#
# Module for managing database migrations
#
# Dependencies: config.sh, utils.sh, migration_tracker.sh
#

# =============================================================================
# ALEMBIC MIGRATIONS (NEW - v5.0.0+)
# =============================================================================

# Run Alembic database migrations
# Uses Alembic for versioned migrations (replaces old schema/*.sql system)
# This is the PRIMARY migration method for all deployments
run_alembic_migrations() {
    step "Running Alembic migrations..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy, cannot run migrations"
        return 1
    fi

    # Verify PostgreSQL credentials match .env before running alembic
    info "Verifying PostgreSQL credentials..."
    local pg_user="${POSTGRES_USER:-familybudget}"
    local pg_db="${POSTGRES_DB:-familybudget}"
    if ! timeout 10 docker exec familybudget-postgres \
        psql -U "$pg_user" -d "$pg_db" -c "SELECT 1" > /dev/null 2>&1; then
        error "PostgreSQL credential mismatch — cannot connect as '${pg_user}' to '${pg_db}'"
        error "Likely cause: volume was created with a different POSTGRES_PASSWORD"
        error "Fix options:"
        error "  1. Reset with clean sync: ./deploy.sh --sync-mode clean"
        error "  2. Manually reset: docker exec familybudget-postgres psql -U postgres \
             -c "ALTER USER ${pg_user} PASSWORD 'NEW_PASS';""
        return 1
    fi
    success "PostgreSQL credentials verified"

    # Handle manual reapply flag (--reapply-migration <revision>)
    if [[ "$REAPPLY_MIGRATION" == "true" && -n "$REAPPLY_MIGRATION_FILE" ]]; then
        warning "Manual reapply requested for revision: $REAPPLY_MIGRATION_FILE"
        echo ""

        # Call manual_reapply_migration from migration_tracker.sh
        if manual_reapply_migration "$REAPPLY_MIGRATION_FILE"; then
            success "Manual reapply completed successfully"
            return 0
        else
            error "Manual reapply failed"
            return 1
        fi
    fi

    # ALWAYS check for changed migrations (detection)
    info "Checking for changed migrations..."
    echo ""

    # Call check_and_reapply_migrations from migration_tracker.sh
    # Will show WARNING if changes detected, and reapply only if AUTO_REAPPLY_MIGRATIONS=true
    if ! check_and_reapply_migrations "$DEPLOY_DIR/backend/db/migrations"; then
        warning "Changed migrations detected but not reapplied"
        info "Continuing with normal migration flow..."
    fi

    echo ""

    # Check current Alembic revision
    info "Checking current migration status..."
    local current_revision
    # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
    current_revision=$(compose_cmd exec -T backend python -m alembic -c backend/db/migrations/alembic.ini current 2>/dev/null | tail -1 | grep -oP '^[a-zA-Z0-9]{12}' || echo "none")

    if [[ "$current_revision" == "none" ]]; then
        # Distinguish truly empty DB from silent connection failure
        local table_count
        table_count=$(timeout 5 docker exec familybudget-postgres \
            psql -U "$pg_user" -d "$pg_db" -t -c \
            "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" \
            2>/dev/null | tr -d ' \n' || echo "error")
        if [[ "$table_count" == "error" ]]; then
            warning "Cannot query tables — treating as fresh database (migration will initialize)"
        elif [[ "$table_count" -gt 0 ]]; then
            warning "DB has $table_count tables but no alembic revision tracked — possible partial init"
        else
            info "No migrations applied yet - fresh database detected"
        fi
    else
        info "Current revision: $current_revision"
    fi

    # Check available head revision
    local head_revision
    # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
    head_revision=$(compose_cmd exec -T backend python -m alembic -c backend/db/migrations/alembic.ini heads 2>&1 | grep -oP '^[a-zA-Z0-9]{12}' || echo "unknown")

    if [[ "$head_revision" == "unknown" ]]; then
        warning "Cannot determine head revision"
    else
        info "Latest available revision: $head_revision"
    fi

    # Apply migrations
    info "Applying pending migrations (alembic upgrade head)..."

    # Pass ADMIN_TELEGRAM_ID to PostgreSQL session for admin creation
    if [[ -n "${ADMIN_TELEGRAM_ID:-}" ]]; then
        info "ADMIN_TELEGRAM_ID configured: ${ADMIN_TELEGRAM_ID}"
        info "First admin will be created automatically during migration"
    else
        warning "ADMIN_TELEGRAM_ID not set - admin user will not be created"
        warning "Set ADMIN_TELEGRAM_ID in .env to automatically create first admin"
    fi
    echo ""

    # Use PIPESTATUS to capture alembic exit code (tee always returns 0)
    # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
    # Pass ADMIN_TELEGRAM_ID via -e flag for docker exec
    compose_cmd exec -T -e ADMIN_TELEGRAM_ID="${ADMIN_TELEGRAM_ID:-}" backend python -m alembic -c backend/db/migrations/alembic.ini upgrade head 2>&1 | tee -a "$LOG_FILE"
    local alembic_exit_code=${PIPESTATUS[0]}

    if [[ $alembic_exit_code -eq 0 ]]; then
        echo ""
        success "Alembic migrations completed successfully"

        # Show new current revision
        local new_revision
        # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
        new_revision=$(compose_cmd exec -T backend python -m alembic -c backend/db/migrations/alembic.ini current 2>/dev/null | tail -1 | grep -oP '^[a-zA-Z0-9]{12}' || echo "unknown")
        if [[ "$new_revision" != "unknown" && "$new_revision" != "$current_revision" ]]; then
            info "Database updated: $current_revision → $new_revision"
        elif [[ "$new_revision" == "$current_revision" ]]; then
            info "Database already up to date (revision: $new_revision)"
        fi

        # Save migration checksums for change detection on next deployment
        echo ""
        info "Saving migration checksums for change tracking..."
        if save_migration_checksums "$DEPLOY_DIR/backend/db/migrations"; then
            info "Migration checksums saved to $MIGRATION_CHECKSUMS_FILE"
        else
            warning "Failed to save migration checksums (change detection may not work)"
        fi

        return 0
    else
        echo ""
        error "Alembic migrations failed. Check output above for details."
        error "Log file: $LOG_FILE"
        return 1
    fi
}

# =============================================================================
# DATABASE VERIFICATION
# =============================================================================

# Verify critical database schema tables exist
verify_database_schema() {
    step "Verifying database schema..."

    # Check Alembic migration status
    info "Checking Alembic migration status..."
    local current_revision
    # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
    current_revision=$(compose_cmd exec -T backend python -m alembic -c backend/db/migrations/alembic.ini current 2>/dev/null | tail -1 | grep -oP '^[a-zA-Z0-9]{12}' || echo "none")

    if [[ "$current_revision" == "none" ]]; then
        warning "No Alembic migrations applied - database may be empty"
    else
        success "Alembic revision: $current_revision"
    fi

    # Check if alembic_version table exists
    local alembic_table_exists=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'alembic_version');" 2>/dev/null | tr -d ' ')

    if [[ "$alembic_table_exists" == "t" ]]; then
        info "✓ Alembic version tracking enabled"
    else
        warning "⚠ alembic_version table not found - migrations not initialized"
    fi

    # Verify critical tables exist
    local critical_tables=(
        "t_d_user"
        "t_d_article"
        "t_d_article_hierarchy"
        "t_f_budget_fact"
        "t_f_refresh_token"
        "t_d_cost_center"
        "t_d_financial_center"
    )

    local missing_tables=()

    for table in "${critical_tables[@]}"; do
        if ! compose_cmd exec -T postgres psql -U familybudget familybudget -c "\d $table" >/dev/null 2>&1; then
            missing_tables+=("$table")
        fi
    done

    if [[ ${#missing_tables[@]} -eq 0 ]]; then
        success "All critical tables verified"
        return 0
    else
        error "Missing critical tables: ${missing_tables[*]}"
        warning "Some migrations may not have been applied correctly"
        info "Run migrations: ./deploy.sh --migrations-only"
        return 1
    fi
}


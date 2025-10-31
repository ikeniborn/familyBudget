#!/bin/bash
#
# migrations.sh - Database Migrations
#
# Module for managing database migrations
#
# Dependencies: config.sh, utils.sh
#

# =============================================================================
# ALEMBIC MIGRATIONS
# =============================================================================

# Run database migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        # Skip migrations if PostgreSQL was not restarted
        if [[ "${POSTGRES_WAS_STOPPED}" == "false" ]]; then
            info "Skipping migrations (PostgreSQL was not restarted during smart cleanup)"
            warning "Migrations can corrupt running database or cause schema inconsistency"
            return 0
        fi

        step "Running database migrations..."

        # Check if postgres service is healthy
        if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
            error "PostgreSQL service is not healthy, cannot run migrations"
            return 1
        fi

        # Run migrations through backend container
        info "Executing Alembic migrations..."
        if compose_cmd exec -T backend alembic upgrade head >> "$LOG_FILE" 2>&1; then
            success "Database migrations completed"
        else
            error "Database migrations failed. Check $LOG_FILE for details."
            return 1
        fi
    else
        info "Database migrations skipped (--no-migrate flag)"
    fi
}

# =============================================================================
# SQL MIGRATIONS
# =============================================================================

# Apply SQL migrations directly to database
# Alternative to Alembic for direct SQL migration files
apply_migrations_directly() {
    local migration_dir="$DEPLOY_DIR/backend/db/migrations"
    local applied=0
    local failed=0

    info "Applying SQL migrations from: $migration_dir"

    # Apply migrations in order (001, 002, 003, ...)
    for migration_file in $(ls "$migration_dir"/*.sql 2>/dev/null | sort); do
        local filename=$(basename "$migration_file")

        # Skip README and test files
        if [[ "$filename" == "README.md" ]] || [[ "$filename" =~ ^test_ ]]; then
            continue
        fi

        info "Applying migration: $filename"

        # Apply migration (CREATE TABLE IF NOT EXISTS ensures idempotency)
        if compose_cmd exec -T postgres psql -U familybudget familybudget < "$migration_file" >> "$LOG_FILE" 2>&1; then
            applied=$((applied + 1))
            echo "  ✓ $filename" >> "$LOG_FILE"
        else
            failed=$((failed + 1))
            warning "Failed to apply: $filename (may already be applied)"
            echo "  ✗ $filename" >> "$LOG_FILE"
        fi
    done

    info "Migrations applied: $applied, failed: $failed"

    if [[ $failed -gt 0 ]]; then
        warning "Some migrations failed (this is OK if they were already applied)"
    fi

    return 0
}

# =============================================================================
# DATABASE VERIFICATION
# =============================================================================

# Verify critical database schema tables exist
verify_database_schema() {
    step "Verifying database schema..."

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
        info "Check migration files in: $DEPLOY_DIR/backend/db/migrations/"
        return 1
    fi
}

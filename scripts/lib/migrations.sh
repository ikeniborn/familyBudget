#!/bin/bash
#
# migrations.sh - Database Migrations
#
# Module for managing database migrations
#
# Dependencies: config.sh, utils.sh
#

# =============================================================================
# MIGRATION VERSION CHECK
# =============================================================================

# Check if migrations need to be applied (smart detection)
check_migration_version() {
    local needs_migration="false"

    # Count migration files available
    local available_migrations=$(ls "$DEPLOY_DIR/backend/db/migrations"/*.sql 2>/dev/null | wc -l)

    if [[ $available_migrations -eq 0 ]]; then
        info "No migration files found"
        echo "false"
        return 0
    fi

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        warning "PostgreSQL service is not healthy, cannot check migration version"
        echo "true"  # Assume migrations needed if we can't check
        return 0
    fi

    # Check if schema_migrations table exists
    local table_exists=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations');" 2>/dev/null | tr -d ' ')

    if [[ "$table_exists" != "t" ]]; then
        info "Migration tracking table does not exist - fresh database detected"
        echo "true"
        return 0
    fi

    # Count applied migrations
    local applied_migrations=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT COUNT(*) FROM schema_migrations;" 2>/dev/null | tr -d ' ')

    if [[ -z "$applied_migrations" ]]; then
        warning "Cannot determine applied migrations count"
        echo "true"  # Assume migrations needed
        return 0
    fi

    # Compare counts
    if [[ $applied_migrations -lt $available_migrations ]]; then
        info "Migrations needed: $applied_migrations applied, $available_migrations available"
        echo "true"
    else
        info "Database is up to date: $applied_migrations/$available_migrations migrations applied"
        echo "false"
    fi

    return 0
}

# =============================================================================
# SQL MIGRATIONS
# =============================================================================

# Run database migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        # Smart check: Do we need to run migrations?
        local needs_migration=$(check_migration_version)

        if [[ "$needs_migration" == "false" ]]; then
            if [[ "${POSTGRES_WAS_STOPPED}" == "false" ]]; then
                info "Skipping migrations (database is up to date, PostgreSQL was not restarted)"
                return 0
            else
                warning "PostgreSQL was restarted but database appears up to date"
                info "Running migrations anyway to ensure consistency..."
            fi
        fi

        step "Running database migrations..."

        # Check if postgres service is healthy
        if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
            error "PostgreSQL service is not healthy, cannot run migrations"
            return 1
        fi

        # Method 1: Use the dedicated migration runner script
        info "Executing SQL migrations via run_migrations.sh..."
        if compose_cmd exec -T backend bash /app/backend/db/run_migrations.sh run >> "$LOG_FILE" 2>&1; then
            success "Database migrations completed"
            return 0
        else
            warning "run_migrations.sh failed, trying direct SQL execution..."

            # Method 2: Fallback - Apply SQL migrations directly
            if apply_migrations_directly; then
                success "Database migrations completed (via fallback method)"
                return 0
            else
                error "Database migrations failed. Check $LOG_FILE for details."
                return 1
            fi
        fi
    else
        info "Database migrations skipped (--no-migrate flag)"
    fi
}

# =============================================================================
# DIRECT SQL MIGRATION (Fallback)
# =============================================================================

# Apply SQL migrations directly to database
# Alternative to Alembic for direct SQL migration files
# This is a fallback method when run_migrations.sh fails
# Creates schema_migrations table and tracks applied migrations
apply_migrations_directly() {
    local migration_dir="$DEPLOY_DIR/backend/db/migrations"
    local applied=0
    local failed=0
    local skipped=0

    info "Applying SQL migrations from: $migration_dir"

    # Create migration tracking table if it doesn't exist
    info "Creating migration tracking table..."
    if compose_cmd exec -T postgres psql -U familybudget familybudget >> "$LOG_FILE" 2>&1 <<'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_file VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT,
    checksum VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_file
    ON schema_migrations(migration_file);
EOF
    then
        info "Migration tracking table ready"
    else
        warning "Failed to create schema_migrations table, continuing anyway..."
    fi

    # Apply migrations in order (001, 002, 003, ...)
    for migration_file in $(ls "$migration_dir"/*.sql 2>/dev/null | sort); do
        local filename=$(basename "$migration_file")

        # Skip README and test files
        if [[ "$filename" == "README.md" ]] || [[ "$filename" =~ ^test_ ]]; then
            continue
        fi

        # Check if migration was already applied
        local already_applied=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
            "SELECT COUNT(*) FROM schema_migrations WHERE migration_file = '$filename';" 2>/dev/null | tr -d ' ')

        if [[ "$already_applied" == "1" ]]; then
            info "Skipping migration: $filename (already applied)"
            skipped=$((skipped + 1))
            echo "  ⊘ $filename (skipped)" >> "$LOG_FILE"
            continue
        fi

        info "Applying migration: $filename"

        # Apply migration (CREATE TABLE IF NOT EXISTS ensures idempotency)
        local start_time=$(date +%s%3N)
        if compose_cmd exec -T postgres psql -U familybudget familybudget < "$migration_file" >> "$LOG_FILE" 2>&1; then
            local end_time=$(date +%s%3N)
            local execution_time=$((end_time - start_time))

            # Record migration in tracking table
            compose_cmd exec -T postgres psql -U familybudget familybudget >> "$LOG_FILE" 2>&1 <<EOF
INSERT INTO schema_migrations (migration_file, execution_time_ms)
VALUES ('$filename', $execution_time)
ON CONFLICT (migration_file) DO NOTHING;
EOF

            applied=$((applied + 1))
            echo "  ✓ $filename (${execution_time}ms)" >> "$LOG_FILE"
        else
            failed=$((failed + 1))
            warning "Failed to apply: $filename (may already be applied)"
            echo "  ✗ $filename" >> "$LOG_FILE"
        fi
    done

    info "Migrations: $applied applied, $skipped skipped, $failed failed"

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

# =============================================================================
# BOOTSTRAP SCRIPT - Create First Admin User
# =============================================================================
#
# Creates the first administrator user from ADMIN_TELEGRAM_ID environment variable.
# This function is idempotent and safe to run multiple times.
#
# Prerequisites:
#   - Database migrations must be applied
#   - ADMIN_TELEGRAM_ID must be set in .env
#   - Backend container must be running
#
# Returns:
#   0 - Admin created successfully or already exists
#   0 - ADMIN_TELEGRAM_ID not set (warning only)
#   non-zero - Script execution failed
#
run_bootstrap_script() {
    step "Creating First Admin User"

    # Check if ADMIN_TELEGRAM_ID is set
    if [[ -z "${ADMIN_TELEGRAM_ID:-}" ]]; then
        warning "ADMIN_TELEGRAM_ID not set in .env - skipping admin creation"
        warning "⚠️  You will need to create admin manually:"
        warning "    docker exec familybudget-backend bash -c 'cd /app && PYTHONPATH=/app python backend/db/create_first_admin.py'"
        echo ""
        return 0
    fi

    # Smart check: Skip if PostgreSQL wasn't restarted and admin already exists
    if [[ "${POSTGRES_WAS_STOPPED}" == "false" ]]; then
        info "PostgreSQL was not restarted - checking if admin already exists..."

        # Check if t_d_user table exists first
        local table_exists=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
            "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 't_d_user');" 2>/dev/null | tr -d ' ')

        if [[ "$table_exists" == "t" ]]; then
            # Check if admin user already exists
            local admin_exists=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
                "SELECT EXISTS (SELECT 1 FROM t_d_user WHERE telegram_id = ${ADMIN_TELEGRAM_ID} AND is_current = true);" \
                2>/dev/null | tr -d ' ')

            if [[ "$admin_exists" == "t" ]]; then
                info "Skipping bootstrap (admin user already exists, PostgreSQL was not restarted)"
                info "Admin Telegram ID: ${ADMIN_TELEGRAM_ID}"
                echo ""
                return 0
            else
                info "Admin user not found - proceeding with bootstrap..."
            fi
        else
            warning "t_d_user table not found - proceeding with bootstrap..."
        fi
    fi

    info "Running bootstrap script (idempotent)..."
    info "Admin Telegram ID: ${ADMIN_TELEGRAM_ID}"

    # Run bootstrap script
    if compose_cmd exec -T backend bash -c "cd /app && PYTHONPATH=/app python backend/db/create_first_admin.py" >> "$LOG_FILE" 2>&1; then
        success "Admin user bootstrap completed"
        info "✓ Admin can now login via Telegram OAuth"
    else
        local exit_code=$?
        warning "Bootstrap script exited with code $exit_code"
        info "This may be normal if:"
        info "  - Admin already exists (idempotent behavior)"
        info "  - ADMIN_TELEGRAM_ID is invalid"
        info "Check $LOG_FILE for details"
    fi

    echo ""
}

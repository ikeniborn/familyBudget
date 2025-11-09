#!/bin/bash
#
# migrations.sh - Database Migrations
#
# Module for managing database migrations
#
# Dependencies: config.sh, utils.sh
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

    # Check current Alembic revision
    info "Checking current migration status..."
    local current_revision
    current_revision=$(compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini current 2>/dev/null | head -1 | grep -oP '^[a-f0-9]{12}'" || echo "none")

    if [[ "$current_revision" == "none" ]]; then
        info "No migrations applied yet - fresh database detected"
    else
        info "Current revision: $current_revision"
    fi

    # Check available head revision
    local head_revision
    head_revision=$(compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini heads 2>&1" | grep -oP '^[a-f0-9]{12}' || echo "unknown")

    if [[ "$head_revision" == "unknown" ]]; then
        warning "Cannot determine head revision"
    else
        info "Latest available revision: $head_revision"
    fi

    # Apply migrations
    info "Applying pending migrations (alembic upgrade head)..."
    echo ""

    if compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini upgrade head" 2>&1 | tee -a "$LOG_FILE"; then
        echo ""
        success "Alembic migrations completed successfully"

        # Show new current revision
        local new_revision
        new_revision=$(compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini current 2>/dev/null | head -1 | grep -oP '^[a-f0-9]{12}'" || echo "unknown")
        if [[ "$new_revision" != "unknown" && "$new_revision" != "$current_revision" ]]; then
            info "Database updated: $current_revision → $new_revision"
        elif [[ "$new_revision" == "$current_revision" ]]; then
            info "Database already up to date (revision: $new_revision)"
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
# MIGRATION VERSION CHECK (LEGACY - for old schema/*.sql system)
# =============================================================================
# NOTE: This is DEPRECATED and kept only for backward compatibility
# Use run_alembic_migrations() instead for new deployments

# Check if migrations need to be applied (smart detection)
check_migration_version() {
    local needs_migration="false"

    # Count schema files available
    local available_migrations=$(ls "$DEPLOY_DIR/backend/db/schema"/*.sql 2>/dev/null | wc -l)

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
# DATABASE MIGRATIONS (Primary Entrypoint)
# =============================================================================

# Run database migrations (uses Alembic for v5.0.0+)
# This is the PRIMARY entrypoint called by deploy.sh
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        # Use Alembic migrations (v5.0.0+)
        # This is the PRIMARY migration method for all deployments
        if run_alembic_migrations; then
            return 0
        else
            error "Alembic migrations failed"
            return 1
        fi
    else
        info "Database migrations skipped (--no-migrate flag)"
        return 0
    fi
}

# =============================================================================
# LEGACY SQL MIGRATIONS (DEPRECATED - schema/*.sql system)
# =============================================================================
# NOTE: These functions are kept for backward compatibility only
# DO NOT USE for new deployments - use run_alembic_migrations() instead

# Run legacy SQL migrations (DEPRECATED)
run_migrations_legacy() {
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
    local migration_dir="$DEPLOY_DIR/backend/db/schema"
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
# MIGRATION REAPPLY (Force re-run specific migration)
# =============================================================================

# Reapply specific migration file
# Usage: reapply_migration "009_create_additional_indexes.sql"
reapply_migration() {
    local migration_file="$1"

    if [[ -z "$migration_file" ]]; then
        error "Migration file not specified"
        return 1
    fi

    step "Re-applying migration: $migration_file"

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy, cannot reapply migration"
        return 1
    fi

    # Use run_migrations.sh reapply command
    info "Executing migration reapply via run_migrations.sh..."
    if compose_cmd exec -T backend bash /app/backend/db/run_migrations.sh reapply "$migration_file" >> "$LOG_FILE" 2>&1; then
        success "Migration re-applied successfully: $migration_file"
        return 0
    else
        error "Migration reapply failed. Check $LOG_FILE for details."
        return 1
    fi
}

# Detect changed migrations (checksum mismatch)
# Returns: List of changed migration files (one per line)
detect_changed_migrations() {
    local migration_dir="$DEPLOY_DIR/backend/db/schema"
    local changed_migrations=()

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        return 1
    fi

    # Check if schema_migrations table exists
    local table_exists=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'schema_migrations');" 2>/dev/null | tr -d ' ')

    if [[ "$table_exists" != "t" ]]; then
        return 1
    fi

    # Check each applied migration for changes
    for migration_file in $(ls "$migration_dir"/*.sql 2>/dev/null | sort); do
        local filename=$(basename "$migration_file")

        # Skip if not applied yet
        local is_applied=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
            "SELECT COUNT(*) FROM schema_migrations WHERE migration_file = '$filename';" 2>/dev/null | tr -d ' ')

        if [[ "$is_applied" != "1" ]]; then
            continue
        fi

        # Calculate current checksum
        local current_checksum=$(sha256sum "$migration_file" | awk '{print $1}')

        # Get stored checksum
        local stored_checksum=$(compose_cmd exec -T postgres psql -U familybudget familybudget -t -c \
            "SELECT checksum FROM schema_migrations WHERE migration_file = '$filename';" 2>/dev/null | tr -d ' ')

        # Skip if no checksum stored (old migration)
        if [[ -z "$stored_checksum" ]]; then
            continue
        fi

        # Compare checksums
        if [[ "$current_checksum" != "$stored_checksum" ]]; then
            changed_migrations+=("$filename")
        fi
    done

    # Output changed migrations (one per line)
    if [[ ${#changed_migrations[@]} -gt 0 ]]; then
        printf '%s\n' "${changed_migrations[@]}"
        return 0
    else
        return 1
    fi
}

# Interactive handler for changed migrations
# Shows menu and prompts user to reapply each changed migration
handle_changed_migrations_interactive() {
    step "Checking for modified migrations..."

    local changed_migrations
    if ! changed_migrations=$(detect_changed_migrations); then
        info "No modified migrations detected"
        return 0
    fi

    # Convert to array
    local migrations_array=()
    while IFS= read -r line; do
        migrations_array+=("$line")
    done <<< "$changed_migrations"

    if [[ ${#migrations_array[@]} -eq 0 ]]; then
        info "No modified migrations detected"
        return 0
    fi

    echo ""
    warning "⚠️  Detected ${#migrations_array[@]} modified migration(s):"
    echo ""
    for migration in "${migrations_array[@]}"; do
        echo "  • $migration"
    done
    echo ""

    warning "These migrations were applied previously but the files have been modified."
    warning "This may indicate bug fixes, schema corrections, or index optimizations."
    echo ""
    echo "Options:"
    echo "  [1] Reapply all modified migrations (RECOMMENDED for bug fixes)"
    echo "  [2] Reapply selected migrations (choose which ones)"
    echo "  [3] Skip - continue without reapplying (NOT recommended)"
    echo ""

    # Flush output and read from terminal
    sync 2>/dev/null || true
    read -r -p "Select [1-3]: " choice < /dev/tty
    echo ""

    case "$choice" in
        1)
            info "Reapplying all modified migrations..."
            echo ""
            local failed=0
            for migration in "${migrations_array[@]}"; do
                if reapply_migration "$migration"; then
                    success "✓ $migration"
                else
                    error "✗ $migration"
                    failed=$((failed + 1))
                fi
                echo ""
            done

            if [[ $failed -eq 0 ]]; then
                success "All modified migrations reapplied successfully"
            else
                error "$failed migration(s) failed to reapply"
                return 1
            fi
            ;;

        2)
            info "Select migrations to reapply:"
            echo ""
            local idx=1
            for migration in "${migrations_array[@]}"; do
                echo "  [$idx] $migration"
                idx=$((idx + 1))
            done
            echo ""
            read -r -p "Enter migration numbers (space-separated, e.g. '1 3'): " selection < /dev/tty
            echo ""

            local failed=0
            for num in $selection; do
                if [[ $num =~ ^[0-9]+$ ]] && [[ $num -ge 1 ]] && [[ $num -le ${#migrations_array[@]} ]]; then
                    local migration="${migrations_array[$((num - 1))]}"
                    if reapply_migration "$migration"; then
                        success "✓ $migration"
                    else
                        error "✗ $migration"
                        failed=$((failed + 1))
                    fi
                    echo ""
                else
                    warning "Invalid selection: $num (skipped)"
                fi
            done

            if [[ $failed -eq 0 ]]; then
                success "Selected migrations reapplied successfully"
            else
                error "$failed migration(s) failed to reapply"
                return 1
            fi
            ;;

        3)
            warning "Skipping migration reapply"
            warning "⚠️  Database schema may be inconsistent with migration files!"
            warning "    Recommended action: Review changes and reapply manually if needed"
            echo ""
            ;;

        *)
            error "Invalid choice: $choice"
            warning "Defaulting to skip (option 3)"
            warning "⚠️  Database schema may be inconsistent with migration files!"
            echo ""
            ;;
    esac

    return 0
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
    current_revision=$(compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini current 2>/dev/null | head -1 | grep -oP '^[a-f0-9]{12}'" || echo "none")

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

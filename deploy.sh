#!/bin/bash
#
# Family Budget - Deployment Script
#
# This script deploys the Family Budget application using Docker Compose:
# - Validates prerequisites (Docker, .env file)
# - Syncs code from repository to deployment directory
# - Checks and repairs PostgreSQL data directory structure (auto-recovery)
# - Builds Docker images
# - Starts services
# - Waits for healthy status
# - Runs database migrations
# - Displays deployment status and URLs
#
# Usage:
#   ./deploy.sh [OPTIONS]
#
# Options:
#   -h, --help              Show this help message
#   -d, --detach            Run in detached mode (default)
#   -f, --foreground        Run in foreground (show logs)
#   -p, --profile PROFILE   Docker Compose profile (default: none, full: all services)
#   --no-migrate            Skip database migrations
#   --clean                 Clean deployment (remove volumes)
#
# Examples:
#   ./deploy.sh                    # Basic deployment (postgres + backend)
#   ./deploy.sh --profile full     # Full deployment (+ nginx + bot + certbot)
#   ./deploy.sh --clean            # Clean deployment (removes data!)
#
# Note: Docker images are automatically rebuilt when code changes (using --build flag).
#       Docker uses layer cache, so rebuilds are fast when nothing changed.
#
# Author: Family Budget Team
# Version: 1.1.0
# Date: 2025-10-28
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# Auto-detect script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Validate library modules exist
if [[ ! -d "$SCRIPT_DIR/scripts/lib" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "❌ ERROR: Library modules not found"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Expected location: $SCRIPT_DIR/scripts/lib/"
    echo "This directory does not exist or is not accessible."
    echo ""
    echo "This usually means deploy.sh is being run from the wrong directory."
    echo ""
    echo "✓ CORRECT usage:"
    echo "  cd ~/familyBudget          # Navigate to git repository"
    echo "  sudo ./deploy.sh           # Run deploy script"
    echo ""
    echo "✗ WRONG:"
    echo "  cd /opt/budget             # Production directory"
    echo "  sudo ./deploy.sh           # ❌ Modules not found!"
    echo ""
    echo "  sudo /opt/budget/deploy.sh  # ❌ Same problem"
    echo ""
    echo "Current directory: $(pwd)"
    echo "SCRIPT_DIR: $SCRIPT_DIR"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    exit 1
fi

# =============================================================================
# LOAD LIBRARY MODULES
# =============================================================================
# Phase 1: Simple modules (config, utils, validation, status)
# Phase 2: Service modules (postgres, services, migrations, firewall, backup_integration)
# Phase 3: Complex modules (sync, docker) - NEW
# See scripts/lib/README.md for documentation

# Phase 1 modules
source "$SCRIPT_DIR/scripts/lib/config.sh"      # Must be first (no dependencies)
source "$SCRIPT_DIR/scripts/lib/utils.sh"       # Depends on config.sh
source "$SCRIPT_DIR/scripts/lib/validation.sh"  # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/status.sh"      # Depends on config.sh, utils.sh

# Phase 2 modules
source "$SCRIPT_DIR/scripts/lib/postgres.sh"    # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/services.sh"    # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/migration_tracker.sh"  # Depends on config.sh, utils.sh (NEW - v5.1.0+)
source "$SCRIPT_DIR/scripts/lib/migrations.sh"  # Depends on config.sh, utils.sh, migration_tracker.sh
source "$SCRIPT_DIR/scripts/lib/firewall.sh"    # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/backup_integration.sh"  # Depends on config.sh, utils.sh

# Phase 3 modules (NEW)
source "$SCRIPT_DIR/scripts/lib/sync.sh"        # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/cache_busting.sh"  # Depends on config.sh, utils.sh (NEW)
source "$SCRIPT_DIR/scripts/lib/docker.sh"      # Depends on config.sh, utils.sh, postgres.sh
source "$SCRIPT_DIR/scripts/lib/network.sh"     # Depends on config.sh, utils.sh, docker.sh (is_our_docker_container)
source "$SCRIPT_DIR/scripts/lib/ssl.sh"         # Depends on config.sh, utils.sh

# =============================================================================
# CONFIGURATION (Legacy - variables moved to config.sh)
# =============================================================================
# Note: These are duplicates kept for backward compatibility
# They are now defined in scripts/lib/config.sh

# SCRIPT_DIR already set above
DEPLOY_DIR="/opt/budget"  # Deployment directory (runtime files)
PROJECT_NAME="familybudget"
LOG_FILE="$DEPLOY_DIR/logs/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
DETACH_MODE=true
RUN_MIGRATIONS=true
CLEAN_DEPLOY=false
COMPOSE_PROFILE=""
SYNC_MODE=""  # mirror|update|clean|skip (empty = interactive)
CLEANUP_MODE=""  # skip|smart|full (empty = interactive) (v5.1.3)
REPO_DIR_OVERRIDE=""  # User-specified repository directory
REAPPLY_MIGRATION=false  # Manual reapply specific migration (downgrade/upgrade)
REAPPLY_MIGRATION_FILE=""  # Revision ID to reapply (e.g., "b2232d851007")
MIGRATIONS_ONLY=false  # Run only migrations without rebuilding containers
AUTO_REAPPLY_MIGRATIONS="${AUTO_REAPPLY_MIGRATIONS:-false}"  # Auto-detect changed migrations (disabled by default)
# Note: BUILD_IMAGES removed - now always enabled via 'docker compose up --build'

# PostgreSQL state tracking (prevent race conditions)
POSTGRES_WAS_STOPPED=true  # Track if PostgreSQL was stopped during cleanup
# false = PostgreSQL kept running (selective restart) - skip integrity checks
# true = PostgreSQL was stopped - safe to perform integrity checks

# Service health check configuration
MAX_WAIT_TIME=120  # Maximum wait time for services (seconds)
CHECK_INTERVAL=5   # Interval between health checks (seconds)

# =============================================================================
# HELPER FUNCTIONS (Loaded from scripts/lib/utils.sh)
# =============================================================================
# Functions: print_message, info, success, warning, error, step,
#            command_exists, check_root_privileges, is_postgres_running,
#            is_postgres_healthy, error_return

# =============================================================================
# VALIDATION FUNCTIONS (Loaded from scripts/lib/validation.sh)
# =============================================================================
# Functions: print_help, check_prerequisites_early, check_prerequisites_late,
#            validate_env

# =============================================================================
# CODE SYNCHRONIZATION FUNCTIONS (Loaded from scripts/lib/sync.sh)
# =============================================================================
# Functions: detect_repository_dir, check_code_changes, sync_mirror,
#            sync_update, sync_clean, sync_code_to_deploy

# =============================================================================
# DOCKER & CLEANUP FUNCTIONS (Loaded from scripts/lib/docker.sh)
# =============================================================================
# Functions: detect_changed_files_rsync, categorize_file_changes,
#            cleanup_containers_networks_v2, cleanup_containers_networks_legacy,
#            cleanup_full, cleanup_old_deployment, is_our_docker_container

# =============================================================================
# POSTGRES FUNCTIONS (Loaded from scripts/lib/postgres.sh)
# =============================================================================
# Functions: initialize_postgres_directory, check_and_repair_postgres_data

# =============================================================================
# NETWORK FUNCTIONS (Loaded from scripts/lib/network.sh)
# =============================================================================
# Functions: check_port_available

# =============================================================================
# DEPLOYMENT FUNCTIONS
# =============================================================================
# Note: compose_cmd() is loaded from scripts/lib/utils.sh

# Note: Image building is now handled automatically by 'docker compose up --build'
# which rebuilds only changed images using Docker's layer cache for speed

# =============================================================================
# SERVICE FUNCTIONS (Loaded from scripts/lib/services.sh)
# =============================================================================
# Functions: stop_services, clean_deployment, start_services,
#            wait_for_service, wait_for_services

# =============================================================================
# MIGRATION FUNCTIONS (Loaded from scripts/lib/migrations.sh)
# =============================================================================
# Functions: run_migrations, apply_migrations_directly, verify_database_schema

# =============================================================================
# SSL FUNCTIONS (Loaded from scripts/lib/ssl.sh)
# =============================================================================
# Functions: cleanup_nginx_markers, setup_ssl_certificates,
#            update_nginx_for_https, verify_ssl

# =============================================================================
# BACKUP FUNCTIONS (Loaded from scripts/lib/backup_integration.sh)
# =============================================================================
# Functions: setup_backup_cron

# =============================================================================
# FIREWALL FUNCTIONS (Loaded from scripts/lib/firewall.sh)
# =============================================================================
# Functions: configure_firewall_for_ssl

# =============================================================================
# STATUS FUNCTIONS (Loaded from scripts/lib/status.sh)
# =============================================================================
# Functions: get_service_status, print_status

# =============================================================================
# MAIN EXECUTION
# =============================================================================

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_help
                exit 0
                ;;
            -d|--detach)
                DETACH_MODE=true
                shift
                ;;
            -f|--foreground)
                DETACH_MODE=false
                shift
                ;;
            -p|--profile)
                COMPOSE_PROFILE="$2"
                shift 2
                ;;
            --no-migrate)
                RUN_MIGRATIONS=false
                shift
                ;;
            --migrations-only)
                MIGRATIONS_ONLY=true
                RUN_MIGRATIONS=true  # Ensure migrations are enabled
                shift
                ;;
            --clean)
                CLEAN_DEPLOY=true
                shift
                ;;
            --sync-mode)
                SYNC_MODE="$2"
                # Validate sync mode
                if [[ ! "$SYNC_MODE" =~ ^(mirror|update|clean|skip)$ ]]; then
                    error "Invalid sync mode: $SYNC_MODE. Must be: mirror, update, clean, or skip"
                fi
                shift 2
                ;;
            --repo-dir)
                REPO_DIR_OVERRIDE="$2"
                shift 2
                ;;
            --reapply-migration)
                REAPPLY_MIGRATION=true
                REAPPLY_MIGRATION_FILE="$2"
                shift 2
                ;;
            *)
                error "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done
}

# =============================================================================
# COLLECT DEPLOYMENT PARAMETERS (v5.1.3)
# =============================================================================
# Collect all user choices UPFRONT before starting deployment:
# 1. Sync mode (mirror/update/clean/skip)
# 2. Cleanup action (skip/smart/full)
#
# This allows users to see ALL questions at once, then deploy runs unattended.
#
# Note: Skip if parameters already set via CLI or non-interactive mode.
collect_deployment_parameters() {
    # Skip if running migrations-only mode
    if [[ "$MIGRATIONS_ONLY" == "true" ]]; then
        return 0
    fi

    # Skip if non-interactive (no TTY)
    if [[ ! -t 0 ]]; then
        info "Non-interactive mode: using defaults (sync=mirror, cleanup=smart)"
        SYNC_MODE="${SYNC_MODE:-mirror}"
        CLEANUP_MODE="${CLEANUP_MODE:-smart}"
        return 0
    fi

    echo "========================================================================"
    print_message "$CYAN" "       Deployment Parameter Selection"
    echo "========================================================================"
    echo ""

    # =========================================================================
    # STEP 1: SELECT SYNC MODE
    # =========================================================================
    if [[ -z "$SYNC_MODE" ]]; then
        # Detect repository directory
        local repo_dir
        repo_dir=$(detect_repository_dir)
        if [[ $? -ne 0 ]]; then
            error "$repo_dir"  # Error message from detect_repository_dir
            exit 1
        fi

        # Check if code synchronization needed
        local has_changes=false
        if [[ ! -d "$DEPLOY_DIR" ]]; then
            has_changes=true
            info "Deployment directory does not exist: $DEPLOY_DIR"
        elif ! check_code_changes "$repo_dir"; then
            # check_code_changes returns 1 if changes detected
            has_changes=true
        fi

        # ALWAYS show sync mode selection (mandatory choice)
        if [[ "$has_changes" == "true" ]]; then
            info "Code changes detected"
        else
            info "No code changes detected (you can still force sync if needed)"
        fi
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        print_message "$BLUE" "  STEP 1: Select Sync Mode"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "  [1] Mirror (rsync --delete) - RECOMMENDED"
        echo "      Removes files from /opt/budget not in repository"
        echo "      Protected: .env, .npm-isolated/, .migration_checksums, backups/, data/, logs/"
        echo ""
        echo "  [2] Update only (rsync)"
        echo "      Updates existing + adds new files"
        echo "      Old files NOT deleted (may leave artifacts)"
        echo ""
        echo "  [3] Clean + copy (DANGEROUS!)"
        echo "      Deletes EVERYTHING (code, data/*, logs/*, backups, Docker volumes)"
        echo "      ⚠️  DELETES PostgreSQL database and ALL data!"
        echo "      Protected: .env, .npm-isolated/, .migration_checksums (directories cleared)"
        echo ""
        echo "  [4] Skip synchronization"
        echo "      Deploy without updating code"
        echo ""

        read -p "Select [1-4]: " mode_choice
        echo ""

        case $mode_choice in
            1)
                SYNC_MODE="mirror"
                ;;
            2)
                SYNC_MODE="update"
                ;;
            3)
                SYNC_MODE="clean"
                ;;
            4)
                SYNC_MODE="skip"
                ;;
            *)
                error "Invalid choice"
                exit 1
                ;;
        esac

        success "Sync mode selected: $SYNC_MODE"
        echo ""
    else
        info "Sync mode preset: $SYNC_MODE"
        echo ""
    fi

    # =========================================================================
    # STEP 2: SELECT CLEANUP ACTION
    # =========================================================================
    # Only ask if:
    # - Not in clean sync mode (clean mode auto-cleans everything)
    # - CLEANUP_MODE not already set
    # - Old deployments exist
    if [[ "${SYNC_MODE}" != "clean" ]] && [[ -z "$CLEANUP_MODE" ]] && [[ "${CLEAN_DEPLOY:-false}" != "true" ]]; then
        # Check for old deployment artifacts
        local old_containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null | wc -l)
        local old_networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)
        local old_volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)

        if [[ $old_containers -gt 0 || $old_networks -gt 0 || $old_volumes -gt 0 ]]; then
            # Old deployment found - ask what to do
            warning "Found old deployment artifacts:"
            if [[ $old_containers -gt 0 ]]; then
                echo "  - Containers: $old_containers"
            fi
            if [[ $old_networks -gt 0 ]]; then
                echo "  - Networks: $old_networks"
            fi
            if [[ $old_volumes -gt 0 ]]; then
                echo "  - Volumes: $old_volumes"
            fi
            echo ""

            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            print_message "$BLUE" "  STEP 2: Choose Cleanup Action"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            warning "Old deployments may cause network conflicts!"
            echo ""
            echo "  [1] Skip - deploy alongside old deployment (may cause subnet conflicts)"
            echo "  [2] Smart cleanup - auto-detect changes & restart strategy (RECOMMENDED)"
            echo "      ✓ Analyzes git diff to determine if PostgreSQL needs restart"
            echo "      ✓ Keeps PostgreSQL running for frontend/backend changes only"
            echo "      ✓ Full restart for DB migrations or config changes"
            echo "  [3] Full cleanup - containers + networks + volumes (DELETES ALL DATA!)"
            echo "      ⚠️  Requires sudo/root privileges"
            echo ""

            # Flush stdout/stderr before reading input (prevents terminal buffer issues)
            sync 2>/dev/null || true
            read -r -p "Select [1-3]: " cleanup_choice < /dev/tty
            echo ""

            case $cleanup_choice in
                1)
                    CLEANUP_MODE="skip"
                    ;;
                2)
                    CLEANUP_MODE="smart"
                    ;;
                3)
                    CLEANUP_MODE="full"
                    ;;
                *)
                    error "Invalid choice. Please select 1-3."
                    exit 1
                    ;;
            esac

            success "Cleanup mode selected: $CLEANUP_MODE"
            echo ""
        else
            # No old deployment - skip cleanup
            CLEANUP_MODE="skip"
            info "No old deployment found - cleanup not needed"
            echo ""
        fi
    elif [[ "${SYNC_MODE}" == "clean" ]]; then
        # Clean sync mode - cleanup auto-handled
        CLEANUP_MODE="auto"
        info "Cleanup mode: auto (handled by clean sync)"
        echo ""
    elif [[ -n "$CLEANUP_MODE" ]]; then
        info "Cleanup mode preset: $CLEANUP_MODE"
        echo ""
    fi

    echo "========================================================================"
    print_message "$GREEN" "       Parameters Collected - Starting Deployment"
    echo "========================================================================"
    echo ""
    info "Sync mode:    $SYNC_MODE"
    info "Cleanup mode: ${CLEANUP_MODE:-skip}"
    echo ""
}

main() {
    # Parse arguments
    parse_args "$@"

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"

    echo "========================================================================"
    print_message "$BLUE" "       Family Budget - Deployment Script"
    echo "========================================================================"
    echo ""

    # Handle migrations-only mode (fast path)
    if [[ "$MIGRATIONS_ONLY" == "true" ]]; then
        info "Running in migrations-only mode (skipping build/restart)"
        echo ""

        # Check if postgres service is healthy
        if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
            error "PostgreSQL service is not healthy"
            error "Cannot run migrations-only mode without running PostgreSQL"
            error "Please start services first: ./deploy.sh --profile full"
            exit 1
        fi

        # Run migrations only
        if ! run_alembic_migrations; then
            error "Migrations failed"
            exit 1
        fi
        echo ""

        # Verify database schema after migrations
        if ! verify_database_schema; then
            error "Database schema verification failed"
            error "Critical tables are missing - migrations may have failed partially"
            exit 1
        fi
        echo ""

        success "Migrations completed and verified successfully"
        echo ""

        # Show current database status
        info "Current database revision:"
        compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini current"
        echo ""

        exit 0
    fi

    # Load .env to check deployment profile
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a

        # Auto-detect profile from .env if not specified
        if [[ -z "$COMPOSE_PROFILE" && "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            COMPOSE_PROFILE="full"
            info "Auto-detected profile from .env: full"
        fi
    fi

    # Display deployment configuration
    info "Deployment configuration:"
    echo "  Detach mode:      $DETACH_MODE"
    echo "  Run migrations:   $RUN_MIGRATIONS"
    echo "  Clean deploy:     $CLEAN_DEPLOY"
    if [[ -n "$COMPOSE_PROFILE" ]]; then
        echo "  Profile:          $COMPOSE_PROFILE"
    else
        echo "  Profile:          none (basic: postgres + backend)"
    fi
    if [[ -n "${DEPLOYMENT_PROFILE:-}" ]]; then
        echo "  Deployment type:  ${DEPLOYMENT_PROFILE}"
        if [[ "${SSL_TYPE:-none}" == "letsencrypt" ]]; then
            echo "  SSL:              Automatic (Let's Encrypt)"
        fi
    fi
    echo ""

    # Check if HTTP/HTTPS ports are available (for full profile with nginx)
    if [[ "$COMPOSE_PROFILE" == "full" || "${DEPLOYMENT_PROFILE:-}" == "full" ]]; then
        step "Checking Port Availability"

        # Load .env if not already loaded
        if [[ -z "${HTTP_PORT:-}" ]]; then
            set -a
            source "$DEPLOY_DIR/.env" 2>/dev/null || true
            set +a
        fi

        local http_port="${HTTP_PORT:-80}"
        local https_port="${HTTPS_PORT:-443}"

        info "Checking if ports are available for nginx..."
        check_port_available "$http_port" "HTTP"
        check_port_available "$https_port" "HTTPS"
        echo ""
    fi

    # Deployment steps

    # EARLY checks (before code sync): Docker, .env
    check_prerequisites_early
    echo ""

    validate_env
    echo ""

    # COLLECT DEPLOYMENT PARAMETERS (v5.1.3)
    # Ask user for sync mode + cleanup action UPFRONT
    # This allows deployment to run unattended after parameter selection
    collect_deployment_parameters

    # PRE-FLIGHT CHECK: Verify npm environment exists BEFORE sync
    # This prevents issues if rsync accidentally deletes .npm-isolated/
    print_message info "Pre-flight check: Verifying production npm environment..."
    if [[ -d "/opt/budget/.npm-isolated/node_modules" ]]; then
        local pkg_count
        pkg_count=$(find "/opt/budget/.npm-isolated/node_modules" -maxdepth 1 -type d ! -name ".*" | wc -l)
        print_message success "Production npm environment verified: $pkg_count packages"
    else
        print_message warning "Production npm environment NOT found: /opt/budget/.npm-isolated/"
        print_message warning "Run install.sh to create npm environment before first deploy"
        print_message warning "Build process will be skipped if npm environment is missing"
    fi
    echo ""

    # Synchronize code from repository to /opt/budget
    sync_code_to_deploy
    echo ""

    # POST-SYNC VERIFICATION: Ensure npm environment was NOT deleted by rsync
    print_message info "Post-sync check: Verifying npm environment preservation..."
    if [[ ! -d "/opt/budget/.npm-isolated/node_modules" ]]; then
        print_message error "CRITICAL: Production npm environment was DELETED during sync!"
        print_message error "This should NEVER happen with --filter='protect .npm-isolated/'"
        print_message error ""
        print_message error "Possible causes:"
        print_message error "  1. rsync filter not working correctly"
        print_message error "  2. Manual deletion of /opt/budget/.npm-isolated"
        print_message error "  3. Filesystem corruption"
        print_message error ""
        print_message error "To fix: Run install.sh to recreate npm environment"
        print_message error "  cd ~/familyBudget && sudo ./install.sh"
        print_message error ""
        print_message warning "Deployment will continue but build will be SKIPPED"
    else
        print_message success "npm environment preserved successfully"
    fi
    echo ""

    # Minify static assets (JS and CSS) for production
    echo ""
    print_message info "Minifying static assets..."
    echo ""
    cd "/opt/budget" || error_return "Failed to cd to /opt/budget"

    # Fix permissions before build (prevent EACCES errors)
    # IMPORTANT: Build process needs write access to frontend/ directory
    print_message info "Ensuring correct permissions for build..."
    sudo chown -R ikeniborn:ikeniborn /opt/budget/frontend /opt/budget/.npm-isolated 2>/dev/null || true

    # Clean up ALL npm-related processes before build (prevent zombie process buildup)
    # ARCHITECTURE IMPROVEMENT (2025-11-08):
    # - Kill ALL npm processes (not just specific patterns)
    # - Prevents zombie process accumulation from interrupted builds
    # - No timeout needed if we aggressively cleanup before starting
    echo ""
    print_message info "Cleaning up npm processes before build..."

    # Kill ALL npm-related processes (aggressive cleanup, suppress "Killed" messages)
    sudo pkill -9 -f "npm" 2>&1 | grep -v "Killed" || true
    sudo pkill -9 -f "terser" 2>&1 | grep -v "Killed" || true
    sudo pkill -9 -f "postcss" 2>&1 | grep -v "Killed" || true
    sudo pkill -9 -f "tailwindcss" 2>&1 | grep -v "Killed" || true
    sleep 2  # Give processes time to fully terminate

    # Verify cleanup
    local remaining=$(ps aux | grep -E "(npm|terser|postcss|tailwindcss)" | grep -v grep | wc -l)
    if [[ $remaining -eq 0 ]]; then
        print_message success "All npm processes cleaned up (0 remaining)"
        echo ""
    else
        print_message warning "Some processes still running ($remaining), attempting force cleanup..."
        sudo pkill -9 -f "node" 2>&1 | grep -v "Killed" || true  # Nuclear option
        sleep 1
        print_message success "Force cleanup completed"
        echo ""
    fi

    # Check that npm dependencies are installed in production isolated environment
    # ARCHITECTURE CHANGE (2025-11-08):
    # - npm env now in /opt/budget/.npm-isolated (NOT copied via rsync)
    # - Must be created by install.sh (runs once, persists across deploys)
    # - Faster deploys (~100-200MB not transferred)
    local npm_isolated_dir="/opt/budget/.npm-isolated"
    local node_modules_dir="$npm_isolated_dir/node_modules"
    local build_allowed=true

    if [[ ! -d "$npm_isolated_dir" ]]; then
        print_message error "Production npm environment not found: $npm_isolated_dir"
        print_message error "This directory must exist in production (not copied from repository)"
        print_message error ""
        print_message error "To fix: Run install.sh to create production npm environment"
        print_message error "  cd ~/familyBudget && sudo ./install.sh"
        print_message error ""
        print_message warning "Skipping minification - deployment will continue with unminified assets"
        build_allowed=false
    elif [[ ! -d "$node_modules_dir" ]]; then
        print_message error "node_modules not found in production npm environment: $node_modules_dir"
        print_message error "Please run install.sh to install npm dependencies"
        print_message warning "Skipping minification - deployment will continue with unminified assets"
        build_allowed=false
    elif [[ ! -f "$node_modules_dir/.package-lock.json" ]]; then
        print_message warning "package-lock.json not found in $node_modules_dir - dependencies may be corrupted"
        print_message warning "Consider re-running install.sh to reinstall npm packages"
        print_message warning "Attempting to run build anyway..."
    fi

    # Validate npm package versions (especially Tailwind CSS to prevent 4.x mismatch)
    if [[ "$build_allowed" == true ]] && command -v jq &> /dev/null; then
        print_message info "Validating npm package versions..."

        if [[ -f "package.json" && -f "$node_modules_dir/tailwindcss/package.json" ]]; then
            local expected_tailwind
            local installed_tailwind

            expected_tailwind=$(jq -r '.devDependencies.tailwindcss // empty' "package.json" 2>/dev/null)
            installed_tailwind=$(jq -r '.version // empty' "$node_modules_dir/tailwindcss/package.json" 2>/dev/null)

            if [[ -n "$expected_tailwind" && -n "$installed_tailwind" ]]; then
                if [[ "$expected_tailwind" != "$installed_tailwind" ]]; then
                    print_message error "Tailwind CSS version mismatch detected!"
                    print_message error "  Expected (package.json): $expected_tailwind"
                    print_message error "  Installed (node_modules): $installed_tailwind"
                    print_message error ""
                    print_message error "This mismatch can cause build failures (especially 4.x vs 3.x)"
                    print_message error "Please reinstall npm dependencies with correct versions:"
                    print_message error "  cd ~/familyBudget"
                    print_message error "  sudo ./install.sh"
                    print_message error ""
                    print_message warning "Skipping build to prevent errors"
                    build_allowed=false
                else
                    print_message success "Tailwind CSS version validated: $installed_tailwind"
                    echo ""
                fi
            fi
        fi
    fi

    # Run minification (build Tailwind CSS + minify JS/CSS) - use isolated environment
    if [[ "$build_allowed" == true ]]; then
        # Validate npm environment comprehensively
        if ! bash scripts/lib/check_npm_env.sh "$PWD"; then
            echo ""
            print_message error "npm environment validation failed"
            print_message error "Cannot proceed with deployment - critical packages missing"
            print_message error "Fix by running: cd ~/familyBudget && sudo ./install.sh"
            exit 1
        fi

        # Add isolated node_modules/.bin to PATH for npx
        export PATH="$node_modules_dir/.bin:$PATH"

        echo ""
        if npm run build 2>&1; then
            echo ""
            print_message success "Static assets built and minified successfully"
            echo ""
        else
            echo ""
            print_message warning "Build failed - check npm logs above"
            print_message warning "Continuing with existing/unminified assets"
            echo ""
        fi

        # Restore PATH (remove isolated bin)
        export PATH="${PATH#$node_modules_dir/.bin:}"
    else
        echo ""
        print_message warning "Minification skipped (build validation failed)"
        echo ""
    fi

    cd - > /dev/null || error_return "Failed to return to previous directory"
    echo ""

    # Update cache versions AFTER synchronization and minification (in /opt/budget)
    run_cache_busting "auto" "/opt/budget"
    echo ""

    # LATE checks (after code sync): docker-compose.yml, directories
    check_prerequisites_late
    echo ""

    # Check for old deployments and cleanup if needed (sets POSTGRES_WAS_STOPPED flag)
    cleanup_old_deployment
    echo ""

    # Initialize PostgreSQL directory with correct permissions (skipped if PostgreSQL is running)
    initialize_postgres_directory
    echo ""

    # Check and repair PostgreSQL data directory (skipped if PostgreSQL is running or clean sync)
    check_and_repair_postgres_data "$SYNC_MODE"
    echo ""

    clean_deployment
    echo ""

    # Note: Image building now happens automatically in start_services()
    # via 'docker compose up --build' which uses cache for unchanged images

    # stop_services removed - redundant after cleanup_old_deployment

    # Clean up old nginx markers from previous deployments
    cleanup_nginx_markers
    echo ""

    start_services
    echo ""

    if [[ "$DETACH_MODE" == "true" ]]; then
        wait_for_services
        echo ""

        # Run Alembic migrations
        # Admin user is created automatically during migration
        if ! run_alembic_migrations; then
            error "Deployment failed: Database migrations did not complete successfully"
            error "Please check the logs and fix any migration issues before redeploying"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Verify database schema after migrations
        if ! verify_database_schema; then
            error "Deployment failed: Database schema verification failed"
            error "Critical tables are missing - migrations may have failed partially"
            error "Please check migration logs and database state"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        setup_backup_cron
        echo ""

        # Configure firewall before SSL certificate setup
        configure_firewall_for_ssl
        echo ""

        setup_ssl_certificates
        echo ""

        verify_ssl
        echo ""

        verify_all_services
        echo ""

        print_status
    else
        info "Running in foreground mode (Ctrl+C to stop)"
        info "Services will be stopped when you exit"
        # Logs will be shown by docker compose up in foreground mode
    fi
}

# Run main function
main "$@"

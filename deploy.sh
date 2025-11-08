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
source "$SCRIPT_DIR/scripts/lib/migrations.sh"  # Depends on config.sh, utils.sh
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
REPO_DIR_OVERRIDE=""  # User-specified repository directory
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
            *)
                error "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done
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

    # Synchronize code from repository to /opt/budget
    sync_code_to_deploy
    echo ""

    # Minify static assets (JS and CSS) for production
    print_message info "Minifying static assets..."
    cd "/opt/budget" || error_return "Failed to cd to /opt/budget"

    # Clean up any stuck minification processes from previous deployments
    print_message info "Checking for stuck minification processes..."
    local stuck_processes=$(pgrep -f "npm run build|minify.sh|terser --version|cssnano --version" 2>/dev/null || true)
    if [[ -n "$stuck_processes" ]]; then
        print_message warning "Found stuck processes from previous deployment, killing them..."
        pkill -9 -f "npm run build" 2>/dev/null || true
        pkill -9 -f "minify.sh" 2>/dev/null || true
        pkill -9 -f "terser --version" 2>/dev/null || true
        pkill -9 -f "cssnano --version" 2>/dev/null || true
        sleep 2  # Give processes time to terminate
        print_message success "Stuck processes cleaned up"
    else
        print_message success "No stuck processes found"
    fi

    # Check that npm dependencies are installed in isolated environment
    # Note: Dependencies must be installed by running install.sh first
    local npm_isolated_dir=".npm-isolated"
    local node_modules_dir="$npm_isolated_dir/node_modules"
    local build_allowed=true

    if [[ ! -d "$node_modules_dir" ]]; then
        print_message error "Isolated npm environment not found: $node_modules_dir"
        print_message error "Please run install.sh to set up npm dependencies:"
        print_message error "  cd ~/familyBudget && sudo ./install.sh"
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
                fi
            fi
        fi
    fi

    # Run minification (build Tailwind CSS + minify JS/CSS) - use isolated environment
    if [[ "$build_allowed" == true ]]; then
        # Validate npm environment comprehensively
        if ! bash scripts/lib/check_npm_env.sh "$PWD"; then
            print_message error "npm environment validation failed"
            print_message error "Cannot proceed with deployment - critical packages missing"
            print_message error "Fix by running: cd ~/familyBudget && sudo ./install.sh"
            exit 1
        fi

        # Add isolated node_modules/.bin to PATH for npx
        export PATH="$PWD/$node_modules_dir/.bin:$PATH"

        if npm run build 2>&1; then
            print_message success "Static assets built and minified successfully"
        else
            print_message warning "Build failed - check npm logs above"
            print_message warning "Continuing with existing/unminified assets"
        fi

        # Restore PATH (remove isolated bin)
        export PATH="${PATH#$PWD/$node_modules_dir/.bin:}"
    else
        print_message warning "Minification skipped (build validation failed)"
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

        run_migrations
        echo ""

        run_bootstrap_script
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

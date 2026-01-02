#!/bin/bash
#
# Family Budget - Deployment Script
#
# This script deploys the Family Budget application using Docker Compose:
# - Validates prerequisites (Docker, .env file)
# - Syncs code from repository to deployment directory
# - Builds Docker images
# - Starts services (PostgreSQL uses Docker managed volume)
# - Waits for healthy status
# - Runs database migrations
# - Configures UFW firewall rules for PostgreSQL (automatic)
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
# Phase 1: Simple modules (config, utils, timeout, validation, status)
# Phase 2: Service modules (postgres, services, migrations, firewall, backup_integration)
# Phase 3: Complex modules (sync, docker) - NEW
# See scripts/lib/README.md for documentation

# Phase 1 modules
source "$SCRIPT_DIR/scripts/lib/config.sh"      # Must be first (no dependencies)
source "$SCRIPT_DIR/scripts/lib/utils.sh"       # Depends on config.sh
source "$SCRIPT_DIR/scripts/lib/timeout.sh"     # Depends on config.sh, utils.sh (v6.5.5+ resilience)
source "$SCRIPT_DIR/scripts/lib/nginx.sh"       # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/validation.sh"  # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/status.sh"      # Depends on config.sh, utils.sh

# Phase 2 modules
source "$SCRIPT_DIR/scripts/lib/postgres.sh"    # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/redis.sh"       # Depends on config.sh, utils.sh
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
source "$SCRIPT_DIR/scripts/lib/version.sh"     # Depends on config.sh, utils.sh (version management)

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
SYNC_MODE=""  # mirror|update|clean|skip (empty = interactive)
CLEANUP_MODE=""  # skip|smart|full (empty = interactive)
REPO_DIR_OVERRIDE=""  # User-specified repository directory
REAPPLY_MIGRATION=false  # Manual reapply specific migration (downgrade/upgrade)
REAPPLY_MIGRATION_FILE=""  # Revision ID to reapply (e.g., "b2232d851007")
AUTO_REAPPLY_MIGRATIONS="${AUTO_REAPPLY_MIGRATIONS:-false}"  # Auto-detect changed migrations (disabled by default)

# Docker daemon optimization options
FORCE_DOCKERD_RESTART=false  # Force Docker daemon restart at end of deployment
SKIP_DOCKERD_RESTART=false   # Skip automatic Docker daemon restart optimization

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
# Functions: verify_postgres_health_post_start, create_deployment_safety_backup,
#            check_postgres_health_pre_deploy

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
# Functions: stop_services, start_services, wait_for_service, wait_for_services

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
# NGINX CONFIGURATION REGENERATION
# =============================================================================

# Regenerate nginx configuration from template with current DOMAIN
# Select and generate appropriate nginx configuration based on SSL state
# Uses new modular approach (nginx.sh) instead of sed-based marker manipulation
regenerate_nginx_config() {
    step "Configuring Nginx"

    # Load .env to get current DOMAIN and DEPLOYMENT_PROFILE
    set -a
    if ! source "$DEPLOY_DIR/.env" 2>/dev/null; then
        error "Failed to load .env file from $DEPLOY_DIR/.env"
        error "Nginx configuration cannot proceed without .env"
        return 1
    fi
    set +a

    local deployment_profile="${DEPLOYMENT_PROFILE:-basic}"
    local domain="${DOMAIN:-localhost}"

    info "Deployment profile: $deployment_profile"
    info "Domain: $domain"

    # Skip if basic profile (nginx not used)
    if [[ "$deployment_profile" != "full" ]]; then
        info "Deployment profile is '$deployment_profile' - nginx not used, skipping"
        return 0
    fi

    info "Configuring nginx for domain: $domain"

    # Use new modular approach from nginx.sh
    # This function intelligently selects HTTP or HTTPS config based on SSL state
    if ! select_nginx_config "$domain"; then
        error "Failed to configure nginx"
        return 1
    fi

    # Reload nginx if container is running (applies new config without restart)
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "familybudget-nginx"; then
        info "Reloading nginx to apply new configuration"
        reload_nginx || warning "Failed to reload nginx (will be applied on next restart)"
    fi

    success "Nginx configured successfully"
    return 0
}

# =============================================================================
# PWA ICONS REGENERATION
# =============================================================================

# Regenerate PWA icons from SVG if trigger file exists
# Trigger: tmp/budget-icon-v3.svg presence in deployment directory
# This function runs AFTER code sync and BEFORE Service Worker cache update
regenerate_pwa_icons_if_needed() {
    local trigger_svg="$DEPLOY_DIR/tmp/budget-icon-v3.svg"
    local icons_script="$DEPLOY_DIR/scripts/generate_pwa_icons.sh"

    # Check if trigger file exists
    if [[ ! -f "$trigger_svg" ]]; then
        info "PWA icons: No changes detected (trigger file not found), skipping regeneration"
        return 0
    fi

    step "Regenerating PWA Icons"

    # Verify generation script exists
    if [[ ! -f "$icons_script" ]]; then
        warning "generate_pwa_icons.sh not found, skipping PWA icons regeneration"
        warning "Expected location: $icons_script"
        return 0
    fi

    info "Trigger file detected: $trigger_svg"
    info "Running PWA icons generation..."
    echo ""

    cd "$DEPLOY_DIR" || {
        error "Failed to cd to $DEPLOY_DIR"
        return 1
    }

    # Run generation script
    if bash "$icons_script" "$trigger_svg"; then
        success "PWA icons regenerated successfully"

        # Remove trigger file after successful generation
        rm -f "$trigger_svg"
        info "Removed trigger file: $trigger_svg"
    else
        warning "PWA icons generation failed, continuing deployment..."
        warning "Trigger file NOT removed: $trigger_svg"
        return 0
    fi

    echo ""
    return 0
}

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
            --sync-mode)
                SYNC_MODE="$2"
                # Validate sync mode
                if [[ ! "$SYNC_MODE" =~ ^(mirror|update|clean|skip)$ ]]; then
                    error "Invalid sync mode: $SYNC_MODE. Must be: mirror, update, clean, or skip"
                fi
                shift 2
                ;;
            --cleanup-mode)
                CLEANUP_MODE="$2"
                # Validate cleanup mode
                if [[ ! "$CLEANUP_MODE" =~ ^(skip|smart|full)$ ]]; then
                    error "Invalid cleanup mode: $CLEANUP_MODE. Must be: skip, smart, or full"
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
            --major)
                VERSION_BUMP_TYPE="major"
                shift
                ;;
            --minor)
                VERSION_BUMP_TYPE="minor"
                shift
                ;;
            --patch)
                VERSION_BUMP_TYPE="patch"
                shift
                ;;
            --version)
                VERSION_EXPLICIT="$2"
                # Validate version format
                if [[ ! "$VERSION_EXPLICIT" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    error "Invalid version format: $VERSION_EXPLICIT. Must be X.Y.Z (e.g., 5.2.0)"
                fi
                shift 2
                ;;
            --no-version)
                VERSION_BUMP_TYPE="none"
                shift
                ;;
            --restart-dockerd)
                FORCE_DOCKERD_RESTART=true
                shift
                ;;
            --no-restart-dockerd)
                SKIP_DOCKERD_RESTART=true
                shift
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
        echo "      Protected: .env, .npm-isolated/, .migration_checksums, backups/, logs/"
        echo ""
        echo "  [2] Update only (rsync)"
        echo "      Updates existing + adds new files"
        echo "      Old files NOT deleted (may leave artifacts)"
        echo ""
        echo "  [3] Clean + copy (DANGEROUS!)"
        echo "      Deletes EVERYTHING (code, logs/*, backups, Docker volumes)"
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

    # NOTE: STEP 2 "Choose Cleanup Action" moved to cleanup_old_deployment()
    # This eliminates code duplication and ensures cleanup check happens
    # AFTER PostgreSQL health check (which may auto-set CLEANUP_MODE=full)

    echo "========================================================================"
    print_message "$GREEN" "       Parameters Collected - Starting Deployment"
    echo "========================================================================"
    echo ""
    info "Sync mode:    $SYNC_MODE"
    echo ""
}

# =============================================================================
# FIREWALL VALIDATION
# =============================================================================

validate_firewall_rules() {
    step "Validating Firewall Rules"

    # Check if UFW is installed
    if ! command -v ufw &> /dev/null; then
        warning "UFW not installed, skipping firewall validation"
        return 0
    fi

    # Get current UFW status
    local ufw_status
    if ! ufw_status=$(sudo ufw status numbered 2>/dev/null); then
        warning "Cannot read UFW status, skipping validation"
        return 0
    fi

    local has_errors=false

    # Check required ports
    info "Checking required open ports..."

    # SSH (22) - CRITICAL
    if echo "$ufw_status" | grep -q "22/tcp.*ALLOW"; then
        success "✓ Port 22 (SSH) is open"
    else
        error "✗ Port 22 (SSH) is NOT open - SSH access will be blocked!"
        has_errors=true
    fi

    # HTTPS (443) - REQUIRED
    if echo "$ufw_status" | grep -q "443/tcp.*ALLOW"; then
        success "✓ Port 443 (HTTPS) is open"
    else
        warning "⚠ Port 443 (HTTPS) is NOT open - HTTPS will not work"
        info "This is normal if SSL is not configured yet"
    fi

    echo ""
    info "Checking security rules..."

    # HTTP (80) - SHOULD BE CLOSED (except during certbot)
    if echo "$ufw_status" | grep -q "80/tcp.*ALLOW"; then
        warning "⚠ Port 80 (HTTP) is OPEN"
        echo ""
        warning "SECURITY ISSUE: Port 80 should be closed!"
        info "Port 80 should only open temporarily during certbot renewal"
        info "The deploy script will close it automatically"
        echo ""
    else
        success "✓ Port 80 (HTTP) is closed (correct)"
    fi

    # PostgreSQL (5432) - Check if restricted
    if echo "$ufw_status" | grep -q "5432.*ALLOW"; then
        local pg_rules=$(echo "$ufw_status" | grep "5432.*ALLOW")

        # Check if rule has specific IP (not "Anywhere")
        # Format: "5432  ALLOW  78.107.114.37" or "[1] 5432  ALLOW IN  78.107.114.37"
        if echo "$pg_rules" | grep -qE "ALLOW.*(IN)?\s+[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+"; then
            # Restricted access - extract IP address
            local allowed_ip=$(echo "$pg_rules" | grep -oP 'ALLOW\s+(IN\s+)?\K[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+' | head -1)
            success "✓ PostgreSQL (5432) - restricted to IP: $allowed_ip"
        else
            # Open to all (Anywhere)!
            error "✗ PostgreSQL (5432) - OPEN TO ALL IPs!"
            echo ""
            error "CRITICAL SECURITY ISSUE: PostgreSQL is accessible from anywhere!"
            echo ""
            warning "ACTION REQUIRED:"
            echo "  1. sudo ufw delete allow 5432/tcp"
            echo "  2. sudo ufw allow from <YOUR_IP> to any port 5432"
            echo "  OR re-run: ./setup.sh (choose PostgreSQL external access)"
            echo ""
            has_errors=true
        fi
    else
        success "✓ PostgreSQL (5432) - closed (most secure)"
    fi

    echo ""

    # Show current status
    info "Current UFW rules:"
    sudo ufw status numbered | grep -E "ALLOW|DENY" || echo "  (none)"
    echo ""

    # Error handling
    if [[ "$has_errors" == "true" ]]; then
        error "Firewall validation FAILED - critical security issues detected!"
        echo ""
        warning "RECOMMENDED ACTIONS:"
        echo "  • Fix critical issues listed above"
        echo "  • Re-run install.sh to reset firewall: sudo ./install.sh"
        echo "  • Or manually fix rules and re-run deploy"
        echo ""

        read -p "Continue deployment anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "Deployment cancelled for security reasons"
            exit 1
        fi

        warning "Continuing deployment with firewall issues (NOT RECOMMENDED)"
        echo ""
    else
        success "Firewall validation passed"
        echo ""
    fi

    return 0
}

# =============================================================================
# NPM ENVIRONMENT AUTO-REPAIR FUNCTION
# =============================================================================
# Validates npm environment and auto-repairs if issues detected
# Returns: 0 on success, 1 on failure
repair_npm_environment() {
    local npm_isolated_dir="/opt/budget/.npm-isolated"
    local node_modules_dir="$npm_isolated_dir/node_modules"
    local package_lock="/opt/budget/package-lock.json"

    step "npm Environment Validation"

    # Check 1: .npm-isolated directory exists
    if [[ ! -d "$npm_isolated_dir" ]]; then
        print_message error "npm isolated directory not found: $npm_isolated_dir"
        print_message error "This indicates install.sh was not run or npm environment was deleted"
        print_message error ""
        print_message error "Auto-repair: Creating isolated npm environment..."
        echo ""

        # Auto-repair: Create directory and install packages
        mkdir -p "$npm_isolated_dir"
        cd "$npm_isolated_dir" || return 1

        # Copy package files
        cp /opt/budget/package.json . 2>/dev/null || {
            print_message error "package.json not found in /opt/budget"
            return 1
        }
        cp -f /opt/budget/package-lock.json . 2>/dev/null || true

        print_message info "Installing npm packages (timeout: ${TIMEOUT_NPM_INSTALL}s, retry: ${MAX_RETRY_ATTEMPTS}x)..."
        if [[ -f "package-lock.json" ]]; then
            npm_with_retry ci --prefer-offline --no-audit || {
                print_message error "npm ci failed - trying npm install..."
                npm_with_retry install --prefer-offline --no-audit || return 1
            }
        else
            npm_with_retry install --prefer-offline --no-audit || return 1
        fi

        cd /opt/budget || return 1
        print_message success "npm environment created successfully"
        echo ""
    fi

    # Check 2: Run comprehensive validation
    print_message info "Running comprehensive npm environment validation..."
    if bash scripts/lib/check_npm_env.sh "$PWD"; then
        print_message success "npm environment validation passed"
        echo ""
        return 0
    fi

    # Validation failed - attempt auto-repair
    print_message warning "npm environment validation failed - attempting auto-repair..."
    echo ""

    # Auto-repair: Reinstall packages
    print_message info "Reinstalling npm packages in $npm_isolated_dir..."
    cd "$npm_isolated_dir" || return 1

    # Copy latest package files
    cp /opt/budget/package.json . 2>/dev/null || {
        print_message error "package.json not found"
        return 1
    }
    cp -f /opt/budget/package-lock.json . 2>/dev/null || true

    # Remove corrupted node_modules
    if [[ -d "node_modules" ]]; then
        print_message info "Removing corrupted node_modules..."
        rm -rf node_modules
    fi

    # Reinstall
    print_message info "Installing fresh npm packages (timeout: ${TIMEOUT_NPM_INSTALL}s, retry: ${MAX_RETRY_ATTEMPTS}x)..."
    if [[ -f "package-lock.json" ]]; then
        npm_with_retry ci --prefer-offline --no-audit || {
            print_message error "npm ci failed - trying npm install..."
            npm_with_retry install --prefer-offline --no-audit || {
                print_message error "npm install failed - cannot auto-repair"
                cd /opt/budget || return 1
                return 1
            }
        }
    else
        npm_with_retry install --prefer-offline --no-audit || {
            print_message error "npm install failed - cannot auto-repair"
            cd /opt/budget || return 1
            return 1
        }
    fi

    cd /opt/budget || return 1

    # Verify repair
    print_message info "Verifying npm environment after repair..."
    if bash scripts/lib/check_npm_env.sh "$PWD"; then
        print_message success "Auto-repair successful - npm environment validated"
        echo ""
        return 0
    else
        print_message error "Auto-repair failed - npm environment still invalid"
        print_message error ""
        print_message error "Manual intervention required:"
        print_message error "  1. cd ~/familyBudget && sudo ./install.sh"
        print_message error "  2. Or manually fix npm packages in $npm_isolated_dir"
        print_message error ""
        return 1
    fi
}

# =============================================================================
# CHECK GIT REPOSITORY SYNC STATUS
# =============================================================================
# Validates that the repository is synchronized with remote origin
# to prevent deploying outdated code.
#
# Checks:
# - Repository has no uncommitted changes
# - Local HEAD matches remote branch HEAD
#
# Aborts deployment if repository is out of sync.
#
# Usage: check_git_sync
# =============================================================================
check_git_sync() {
    # Skip check if not a git repository
    if [[ ! -d "$SCRIPT_DIR/.git" ]]; then
        print_message warning "Not a git repository - skipping sync check"
        return 0
    fi

    local current_dir
    current_dir=$(pwd)

    cd "$SCRIPT_DIR" || {
        print_message error "Failed to access repository directory: $SCRIPT_DIR"
        exit 1
    }

    # Get current branch name
    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

    if [[ -z "$current_branch" ]]; then
        print_message error "Failed to determine current git branch"
        cd "$current_dir" || true
        exit 1
    fi

    print_message info "Checking git repository sync status..."
    print_message info "Repository: $SCRIPT_DIR"
    print_message info "Branch: $current_branch"

    # Check for uncommitted changes
    if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
        print_message warning "Repository has uncommitted changes:"
        git status --short
        print_message warning ""
        print_message warning "This may indicate local modifications that were not pushed."
        print_message warning "Consider committing and pushing changes before deployment."
        print_message warning ""
    fi

    # Fetch latest from remote (quietly)
    print_message info "Fetching latest changes from origin/$current_branch..."
    if ! git fetch origin "$current_branch" --quiet 2>/dev/null; then
        print_message warning "Failed to fetch from origin - network issue or remote not configured"
        print_message warning "Continuing deployment with local repository state"
        cd "$current_dir" || true
        return 0
    fi

    # Compare local and remote commits
    local local_commit
    local remote_commit

    local_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
    remote_commit=$(git rev-parse "origin/$current_branch" 2>/dev/null || echo "")

    if [[ -z "$local_commit" ]] || [[ -z "$remote_commit" ]]; then
        print_message error "Failed to retrieve git commit hashes"
        cd "$current_dir" || true
        exit 1
    fi

    # Check sync status
    if [[ "$local_commit" == "$remote_commit" ]]; then
        print_message success "✓ Repository is synchronized with origin/$current_branch"
        print_message info "  Commit: ${local_commit:0:8}"
        cd "$current_dir" || true
        return 0
    fi

    # Repository is out of sync - determine direction
    local ahead_count
    local behind_count

    ahead_count=$(git rev-list --count origin/$current_branch..HEAD 2>/dev/null || echo "0")
    behind_count=$(git rev-list --count HEAD..origin/$current_branch 2>/dev/null || echo "0")

    print_message error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message error "❌ REPOSITORY OUT OF SYNC WITH REMOTE"
    print_message error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message error ""
    print_message error "Repository: $SCRIPT_DIR"
    print_message error "Branch:     $current_branch"
    print_message error ""
    print_message error "Local commit:  ${local_commit:0:8} ($(git log -1 --format='%s' HEAD 2>/dev/null || echo 'unknown'))"
    print_message error "Remote commit: ${remote_commit:0:8} ($(git log -1 --format='%s' origin/$current_branch 2>/dev/null || echo 'unknown'))"
    print_message error ""

    if [[ $behind_count -gt 0 ]]; then
        print_message error "⚠️  Local repository is BEHIND remote by $behind_count commit(s)"
        print_message error ""
        print_message error "REQUIRED ACTION:"
        print_message error "  cd $SCRIPT_DIR"
        print_message error "  git pull origin $current_branch"
        print_message error ""
        print_message error "Then re-run deployment."
    elif [[ $ahead_count -gt 0 ]]; then
        print_message error "⚠️  Local repository is AHEAD of remote by $ahead_count commit(s)"
        print_message error ""
        print_message error "RECOMMENDED ACTION:"
        print_message error "  cd $SCRIPT_DIR"
        print_message error "  git push origin $current_branch"
        print_message error ""
        print_message error "Or if you want to deploy anyway (not recommended):"
        print_message error "  Manually confirm that unpushed changes are intentional"
    fi

    print_message error "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message error ""
    print_message error "Deployment ABORTED to prevent deploying outdated or unintended code."
    print_message error ""

    cd "$current_dir" || true
    exit 1
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

    # Clean up orphaned deployment processes from previous failed deployments
    # This runs automatically and terminates stuck processes (alembic, npm, rsync, etc.)
    check_orphaned_deployment_processes --terminate || true
    echo ""

    # Load .env to auto-detect deployment profile
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a

        # Display deployment profile info
        if [[ -n "${DEPLOYMENT_PROFILE:-}" ]]; then
            info "Deployment profile: ${DEPLOYMENT_PROFILE}"
            if [[ "${SSL_TYPE:-none}" == "letsencrypt" ]]; then
                info "SSL: Automatic (Let's Encrypt)"
            fi
            echo ""
        fi
    fi

    # Validate firewall rules before deployment
    validate_firewall_rules

    # Check if HTTP/HTTPS ports are available (for full profile with nginx)
    if [[ "${DEPLOYMENT_PROFILE:-}" == "full" ]]; then
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

    # CHECK: Ensure repository is synchronized with remote
    # Prevents deploying outdated code from un-updated repository
    step "Git Repository Sync Check"
    check_git_sync
    echo ""

    # Synchronize code from repository to /opt/budget
    sync_code_to_deploy
    echo ""

    # Analyze sync changes for smart restart decisions
    # IMPORTANT: Must run AFTER sync_code_to_deploy() because:
    # - Uses SYNC_CHANGED_FILES environment variable set by sync_update()
    # - Sets NEEDS_BACKEND_RECREATE, NEEDS_BOT_RECREATE, NEEDS_NGINX_RECREATE flags
    # - Flags used by start_application_services() to selectively recreate containers
    analyze_sync_changes
    echo ""

    # VERSION MANAGEMENT (AFTER SYNC!)
    # IMPORTANT: Must run AFTER sync_code_to_deploy() because:
    # 1. Reads current version from DEPLOY_DIR (copied from repo)
    # 2. Updates VERSION, package.json, .env ONLY in /opt/budget
    # 3. Repository files are NEVER modified - keeps git clean
    process_version_bump
    echo ""

    # CRITICAL: Regenerate nginx config IMMEDIATELY after sync
    # sync_update() may delete nginx/conf.d/*.conf as "orphaned" (not in repo)
    # This ensures nginx config is always present, even if deploy is interrupted later
    if ! regenerate_nginx_config; then
        error "Failed to regenerate nginx configuration"
        error "Nginx will not start without valid configuration"
        exit 1
    fi
    echo ""

    # Regenerate PWA icons if trigger file exists (AFTER sync)
    # This ensures new icons are available before Service Worker cache is updated
    regenerate_pwa_icons_if_needed

    # NOTE: Cache busting moved AFTER npm run build (see lines ~1110)
    # This ensures we update sw.min.js (not sw.js) and HTML templates
    # after all minification is complete

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
    # Use SUDO_USER if available (when running with sudo), otherwise current user
    local build_user="${SUDO_USER:-$(whoami)}"
    sudo chown -R "${build_user}:${build_user}" /opt/budget/frontend /opt/budget/.npm-isolated 2>/dev/null || true

    # Clean up ALL npm-related processes before build (prevent zombie process buildup)
    # ARCHITECTURE IMPROVEMENT (2025-11-08):
    # - Kill ALL npm processes (not just specific patterns)
    # - Prevents zombie process accumulation from interrupted builds
    # - No timeout needed if we aggressively cleanup before starting
    echo ""
    print_message info "Cleaning up npm processes before build..."

    # Kill npm-related processes from /opt/budget only (more targeted, avoids killing unrelated processes)
    # SECURITY: Use specific path patterns to avoid affecting other npm processes
    sudo pkill -9 -f "/opt/budget.*npm" 2>&1 | grep -v "Killed" || true
    sudo pkill -9 -f "/opt/budget.*terser" 2>&1 | grep -v "Killed" || true
    sudo pkill -9 -f "/opt/budget.*postcss" 2>&1 | grep -v "Killed" || true
    sudo pkill -9 -f "/opt/budget.*tailwindcss" 2>&1 | grep -v "Killed" || true
    sleep 2  # Give processes time to fully terminate

    # Verify cleanup (only check /opt/budget processes)
    local remaining=$(ps aux | grep -E "/opt/budget.*(npm|terser|postcss|tailwindcss)" | grep -v grep | wc -l)
    if [[ $remaining -eq 0 ]]; then
        print_message success "Build processes cleaned up (0 remaining)"
        echo ""
    else
        print_message warning "Some processes still running ($remaining), attempting targeted cleanup..."
        # Only kill node processes from /opt/budget
        sudo pkill -9 -f "/opt/budget.*node" 2>&1 | grep -v "Killed" || true
        sleep 1
        print_message success "Targeted cleanup completed"
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
        # Validate npm environment comprehensively (with auto-repair)
        if ! repair_npm_environment; then
            echo ""
            print_message error "npm environment validation/repair failed"
            print_message error "Cannot proceed with deployment - critical packages missing or corrupted"
            print_message error ""
            print_message error "Manual fix required:"
            print_message error "  cd ~/familyBudget && sudo ./install.sh"
            print_message error ""
            exit 1
        fi

        # ARCHITECTURE FIX (2025-11-21):
        # - Use NODE_PATH instead of symlinks for module resolution
        # - Problem: Symlinked node_modules breaks nested require() in bundled modules
        #   (browserslist → node-releases/data/processed/envs.json fails)
        # - Solution: Set NODE_PATH to tell Node.js where to find modules directly

        # CRITICAL: Remove /opt/budget/node_modules (symlink OR directory)
        # - Only .npm-isolated/node_modules should exist
        # - If /opt/budget/node_modules exists, npm will use IT instead of NODE_PATH
        # - This causes "Cannot find module" errors for incomplete installations
        if [[ -e "$PWD/node_modules" ]]; then
            print_message info "Removing $PWD/node_modules (will use .npm-isolated/node_modules)"
            rm -rf "$PWD/node_modules"
            print_message success "Removed - using .npm-isolated/node_modules exclusively"
        fi

        # Add isolated node_modules/.bin to PATH for npx executables
        export PATH="$node_modules_dir/.bin:$PATH"

        # Set NODE_PATH for correct nested module resolution
        export NODE_PATH="$node_modules_dir${NODE_PATH:+:$NODE_PATH}"

        print_message info "npm build environment configured (PATH + NODE_PATH)"

        # Generate cache version ONCE for entire deployment (v6.8.0+)
        # This version will be used by:
        # 1. minify.sh (sw.min.js)
        # 2. update-cache-busting.sh (HTML templates)
        # Ensures SAME version across all files
        export CACHE_VERSION="v$(date -u +"%Y%m%d_%H%M")"
        print_message info "Generated CACHE_VERSION: $CACHE_VERSION (will be used for all files)"

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

        # Restore PATH and NODE_PATH (remove isolated paths)
        export PATH="${PATH#$node_modules_dir/.bin:}"
        export NODE_PATH="${NODE_PATH#$node_modules_dir:}"
        export NODE_PATH="${NODE_PATH#$node_modules_dir}"
    else
        echo ""
        print_message warning "Minification skipped (build validation failed)"
        echo ""
    fi

    cd - > /dev/null || error_return "Failed to return to previous directory"
    echo ""

    # SAFEGUARD: Ensure Service Worker minified files are properly created
    # Docker creates empty DIRECTORIES for non-existent mount paths in docker-compose.yml
    # This breaks nginx serving of sw.js. We must ensure sw.min.js and sw.min.js.gz are FILES.
    local sw_min="$DEPLOY_DIR/sw.min.js"
    local sw_min_gz="$DEPLOY_DIR/sw.min.js.gz"

    # Check 1: Fix if files are directories (Docker artifact)
    if [[ -d "$sw_min" ]] || [[ -d "$sw_min_gz" ]]; then
        warning "Service Worker minified files are directories (Docker artifact) - fixing..."
        rm -rf "$sw_min" "$sw_min_gz"
    fi

    # Check 2: Create if files are missing (first deployment or deleted)
    if [[ ! -f "$sw_min" ]] || [[ ! -f "$sw_min_gz" ]]; then
        warning "Service Worker minified files missing - creating..."

        # Re-run minification for Service Worker only
        if [[ -f "$DEPLOY_DIR/sw.js" ]]; then
            (
                cd "$DEPLOY_DIR"
                # BUGFIX: Configure PATH for terser access in subshell
                # Parent shell's PATH was restored after npm run build (line 1045)
                # Subshell needs PATH reconfigured to access terser binary
                local node_modules_dir="$DEPLOY_DIR/.npm-isolated/node_modules"
                if [[ -d "$node_modules_dir/.bin" ]]; then
                    export PATH="$node_modules_dir/.bin:$PATH"
                fi
                source scripts/lib/minify.sh
                minify_service_worker
            )
        else
            error_return "Cannot create Service Worker minified files: sw.js not found"
        fi
    fi

    # Final validation
    if [[ -f "$sw_min" ]] && [[ -f "$sw_min_gz" ]]; then
        local sw_min_size=$(stat -c%s "$sw_min" 2>/dev/null || stat -f%z "$sw_min" 2>/dev/null)
        local sw_gz_size=$(stat -c%s "$sw_min_gz" 2>/dev/null || stat -f%z "$sw_min_gz" 2>/dev/null)
        success "Service Worker minified: sw.min.js (${sw_min_size}B) + sw.min.js.gz (${sw_gz_size}B)"

        # Update cache busting versions AFTER minification
        # CRITICAL: Must run AFTER npm run build to update sw.min.js (not sw.js)
        # and HTML templates with version timestamp
        step "Updating Cache Busting Versions (Post-Build)"
        cd "$DEPLOY_DIR" || error_return "Failed to cd to $DEPLOY_DIR"

        if [[ -f "scripts/update-cache-busting.sh" ]]; then
            info "Running update-cache-busting.sh after minification..."
            if ! bash scripts/update-cache-busting.sh; then
                error "CRITICAL: Failed to update cache busting versions!"
                error "Deployment ABORTED - cannot deploy with PLACEHOLDER tokens"
                exit 1
            fi
            echo ""
        else
            error "CRITICAL: scripts/update-cache-busting.sh not found!"
            error "Deployment ABORTED - cannot deploy without cache busting update"
            exit 1
        fi

        # BUGFIX: Restart nginx to remount updated sw.min.js files
        # Docker volumes are mounted at container start. If sw.min.js changes on host,
        # nginx continues serving old version until restarted.
        if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "familybudget-nginx"; then
            info "Service Worker updated - restarting nginx to apply changes..."
            docker compose restart nginx >/dev/null 2>&1 || warning "Failed to restart nginx"
            # Wait for nginx to become healthy (using proper retry logic)
            wait_for_service "nginx" 30
        fi
    elif [[ -f "$DEPLOY_DIR/sw.js" ]]; then
        warning "Service Worker minified files missing - nginx will fallback to backend proxy"
        warning "IMPORTANT: sw.js contains PLACEHOLDER and should NOT be served to users"
        warning "Run 'npm run minify:js' to generate sw.min.js with proper cache version"
    fi
    echo ""

    # Update cache versions AFTER synchronization and minification (in /opt/budget)
    # DISABLED: update-cache-busting.sh already updated all versions (line 1106)
    # Double execution causes version mismatch (different timestamps)
    # run_cache_busting "auto" "/opt/budget"
    echo ""

    # CRITICAL SAFEGUARD: Abort deployment if Service Worker cache version broken
    # This prevents deploying broken PWA that won't cache splash screens
    if [[ -f "$DEPLOY_DIR/sw.min.js" ]]; then
        if grep -q "CACHE_VERSION_PLACEHOLDER" "$DEPLOY_DIR/sw.min.js" 2>/dev/null; then
            echo ""
            print_message error "═══════════════════════════════════════════════════════════"
            print_message error "         CRITICAL ERROR: SERVICE WORKER BROKEN           "
            print_message error "═══════════════════════════════════════════════════════════"
            print_message error ""
            print_message error "sw.min.js still contains CACHE_VERSION_PLACEHOLDER"
            print_message error "This means PWA caching will COMPLETELY FAIL"
            print_message error ""
            print_message error "Splash screens won't show, offline mode won't work"
            print_message error ""
            print_message error "Possible causes:"
            print_message error "  1. npm run build failed silently"
            print_message error "  2. terser minification timeout"
            print_message error "  3. update-cache-busting.sh failed to replace PLACEHOLDER"
            print_message error "  4. File permissions preventing sw.min.js update"
            print_message error ""
            print_message error "DEPLOYMENT ABORTED - Fix Service Worker first"
            print_message error "═══════════════════════════════════════════════════════════"
            echo ""
            exit 1
        fi
    fi

    # Cache busting validation is now handled by update-cache-busting.sh
    # This section removed to avoid duplication

    # Verify Service Worker cache version updated
    if [[ -f "$DEPLOY_DIR/sw.min.js" ]]; then
        info "Checking Service Worker cache version..."

        # Use grep -q for reliable boolean check (avoids multiline count issues)
        if grep -q "CACHE_VERSION_PLACEHOLDER" "$DEPLOY_DIR/sw.min.js" 2>/dev/null; then
            warning "Service Worker still contains CACHE_VERSION_PLACEHOLDER"
            warning "Cache busting did not update sw.min.js"
            echo ""
        else
            # Extract actual version (format: CACHE_VERSION="v20251220_1203" with double quotes)
            sw_version=$(grep -oE 'CACHE_VERSION="v[0-9_]+"' "$DEPLOY_DIR/sw.min.js" 2>/dev/null | sed 's/CACHE_VERSION="//' | sed 's/"$//' | head -1)
            if [[ -n "$sw_version" ]]; then
                success "Service Worker cache version: $sw_version"
            else
                warning "Could not extract Service Worker version from sw.min.js"
            fi
        fi
        echo ""
    else
        warning "Service Worker file not found: $DEPLOY_DIR/sw.min.js"
        echo ""
    fi

    # LATE checks (after code sync): docker-compose.yml, directories
    check_prerequisites_late
    echo ""

    # CRITICAL SAFEGUARD: Check PostgreSQL health BEFORE deployment
    # This prevents proceeding if PostgreSQL is already corrupted
    # If corrupted → auto-switch to Full cleanup mode for automatic repair
    # NOTE: Temporarily disable 'set -e' because we need to handle non-zero return
    set +e
    check_postgres_health_pre_deploy
    health_check_result=$?
    set -e

    if [[ $health_check_result -ne 0 ]]; then
        warning "PostgreSQL corruption detected - AUTOMATIC RECOVERY MODE"
        echo ""

        # Docker managed volume - no repair needed (Docker handles permissions automatically)
        atomic_repair_result=0

        if [[ $atomic_repair_result -eq 0 ]]; then
            success "Atomic repair completed - retrying health check"
            echo ""

            # Retry health check after repair
            set +e
            check_postgres_health_pre_deploy
            health_check_result=$?
            set -e

            if [[ $health_check_result -eq 0 ]]; then
                success "PostgreSQL healthy after atomic repair - continuing deployment normally"
                info "Full cleanup NOT required (atomic repair was sufficient)"
                echo ""
                # Continue with normal deployment flow (skip Full cleanup section below)
            else
                warning "Atomic repair completed but PostgreSQL still unhealthy"
                warning "Switching to Full cleanup mode for comprehensive repair"
                echo ""
                CLEANUP_MODE="full"
            fi
        else
            warning "Atomic repair failed - switching to Full cleanup mode"
            echo ""
            CLEANUP_MODE="full"
        fi

        # If atomic repair was insufficient, ask confirmation for Full cleanup
        if [[ "$CLEANUP_MODE" == "full" ]]; then
            info "Cleanup mode overridden: smart → full (automatic)"
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "⚠️  AUTOMATIC RECOVERY CONFIRMATION (Full Cleanup Required)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Atomic repair was insufficient - Full cleanup required:"
            echo "  1. Stop all containers"
            echo "  2. Remove networks"
            echo "  3. Comprehensive PostgreSQL data directory repair"
            echo "  4. Restart services"
            echo ""
            echo "DATA IS PRESERVED (volumes NOT deleted unless you type 'DELETE')."
            echo ""
            read -p "Continue with Full cleanup? [Y/n]: " -r
            echo ""

            if [[ ! $REPLY =~ ^[Yy]?$ ]]; then
                error "Automatic recovery cancelled by user"
                error "PostgreSQL is corrupted and cannot be repaired with atomic repair"
                error "Full cleanup required - please run again and accept Full cleanup"
                exit 1
            fi

            success "Full cleanup confirmed - proceeding with comprehensive repair"
            echo ""
        fi
    fi
    echo ""

    # NOTE: Legacy bind mount repair code removed after migration to Docker managed volume
    # Docker managed volumes automatically handle permissions and directories

    # Check for old deployments and cleanup if needed (sets POSTGRES_WAS_STOPPED flag)
    cleanup_old_deployment
    echo ""

    # Cleanup dangling Docker images and build cache to free disk space
    cleanup_docker_images true  # true = auto-cleanup (no confirmation needed)
    echo ""

    # Cleanup old image versions (keep only last 3) to prevent 100+ images accumulation
    cleanup_old_image_versions 3
    echo ""

    # Check Docker daemon health and restart if CPU is too high (>50%)
    # High dockerd CPU often indicates accumulated state from many images
    check_and_restart_dockerd 50
    echo ""

    # NOTE: PostgreSQL initialization and repair functions removed after migration to Docker managed volume
    # Docker managed volumes automatically handle directory creation and permissions

    # Note: Image building now happens automatically in start_services()
    # via 'docker compose up --build' which uses cache for unchanged images

    # stop_services removed - redundant after cleanup_old_deployment

    # NOTE: regenerate_nginx_config() moved earlier - runs immediately after sync_code_to_deploy()
    # This ensures nginx config exists even if deploy is interrupted during cleanup phase

    # NOTE: PostgreSQL permissions validation removed after migration to Docker managed volume
    # Docker managed volumes handle permissions automatically

    # PRODUCTION SAFEGUARD: Create safety backup before starting services
    # This provides rollback capability if corruption occurs during deployment
    # Only runs if PostgreSQL is currently running (skipped if full cleanup)
    create_deployment_safety_backup "pre_start"
    echo ""

    # NOTE: Pre-start PostgreSQL repair removed after migration to Docker managed volume
    # Docker managed volumes create directories automatically with correct permissions

    # Prepare upload directories for backend container (import feature)
    # Creates /opt/budget/uploads and /opt/budget/uploads/temp with correct permissions
    # Backend runs as appuser (UID:GID 999:999), host directory must match to allow file writes
    step "Preparing upload directories"
    prepare_upload_directories || {
        error "Failed to prepare upload directories. Check permissions."
    }
    echo ""

    # Ensure PostgreSQL Docker volume exists (idempotent check)
    # CRITICAL: Must run BEFORE start_postgres_only() to avoid "external volume not found" error
    # This is required for first deployment on clean servers
    step "Ensuring PostgreSQL Docker Volume Exists"
    if ! ensure_postgres_volume_exists; then
        error "Deployment failed: PostgreSQL volume creation failed"
        error "Cannot proceed without database volume"
        error "See troubleshooting steps above"
        error "Log file: $LOG_FILE"
        exit 1
    fi
    echo ""

    # PHASED STARTUP: PostgreSQL → Redis → Backend → Migrations → Application Services
    # This eliminates race condition where backend starts before dependencies are ready
    # Phase 1: PostgreSQL only
    # Phase 1.2: Redis only (dependency for backend)
    # Phase 1.5: Backend container (for running migrations)
    # Phase 2: Bot/Nginx (backend already running from Phase 1.5)

    # Phase 1: Start PostgreSQL only
    if ! start_postgres_only; then
        error "Deployment failed: PostgreSQL failed to start"
        error "Log file: $LOG_FILE"
        exit 1
    fi
    echo ""

    if [[ "$DETACH_MODE" == "true" ]]; then
        # CRITICAL SAFEGUARD: Verify PostgreSQL health after start
        # This catches corruption early, before running migrations
        if ! verify_postgres_health_post_start; then
            error "Deployment failed: PostgreSQL health verification failed"
            error "Database may be corrupted - see recovery options above"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Phase 1.2: Start Redis only (backend depends on Redis with service_healthy)
        # Redis must be healthy before backend can start
        if ! start_redis_only; then
            error "Deployment failed: Redis failed to start"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Phase 1.5: Start backend container (needed for migrations)
        # Backend container starts but application doesn't fully initialize yet
        # This allows running migrations via 'docker compose exec backend'
        if ! start_backend_only; then
            error "Deployment failed: Backend container failed to start"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Run Alembic migrations (uses backend container started above)
        # This ensures database schema is ready when backend fully starts
        if ! run_alembic_migrations; then
            error "Deployment failed: Database migrations did not complete successfully"
            error "Please check the logs and fix any migration issues before redeploying"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Create admin user (if ADMIN_EMAIL configured)
        # This allows admin login via email/password WITHOUT 2FA (security exception)
        # Regular users ALWAYS require 2FA for email/password login
        step "Creating Admin User"
        info "Checking if admin email/password configured..."
        if docker compose exec -T backend python scripts/create_admin_user.py; then
            success "Admin user creation completed"
            info "Admin can now login via:"
            info "  - Telegram OAuth (ADMIN_TELEGRAM_ID)"
            info "  - Email + Password (ADMIN_EMAIL) - bypasses 2FA"
        else
            warning "Admin user creation skipped or failed"
            info "This is not critical - admin can still use Telegram authentication"
            info "Check logs above for details"
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

        # Phase 2: Start remaining application services (bot, nginx)
        # Backend already running, this starts bot/nginx only
        if ! start_application_services; then
            error "Deployment failed: Application services failed to start"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Wait for all services to become healthy
        wait_for_services
        echo ""

        # Configure Docker firewall (DOCKER-USER chain)
        # CRITICAL: Block exposed ports 5432 (PostgreSQL) and 8000 (Backend)
        # Docker bypasses UFW by adding iptables rules before UFW chain
        # Solution: Use DOCKER-USER chain to enforce firewall rules
        info "Configuring Docker firewall..."
        if configure_docker_firewall >> "$LOG_FILE" 2>&1; then
            success "Docker firewall configured successfully"
        else
            warning "Failed to configure Docker firewall - ports may be exposed!"
            warning "Run manually: source scripts/lib/firewall.sh && configure_docker_firewall"
        fi
        echo ""

        # Configure UFW rules for PostgreSQL external access
        # Automatically creates/deletes rules based on POSTGRES_EXTERNAL_ACCESS and POSTGRES_ALLOWED_IP
        info "Configuring UFW rules for PostgreSQL..."
        if configure_ufw_for_postgres >> "$LOG_FILE" 2>&1; then
            success "PostgreSQL UFW rules configured successfully"
        else
            warning "Failed to configure PostgreSQL UFW rules"
            warning "Run manually: source scripts/lib/firewall.sh && configure_ufw_for_postgres"
        fi
        echo ""

        setup_backup_cron
        echo ""

        install_systemd_service
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

        # Smoke test: verify critical pages load
        if [[ "${SKIP_SMOKE_TEST:-false}" != "true" ]]; then
            info "Running smoke tests..."
            echo ""

            # Wait for backend to be ready
            sleep 5

            smoke_test_failed=false

            # Test 1: Health endpoint
            if curl -sf -o /dev/null http://localhost:8000/health; then
                success "✓ Health endpoint responding"
            else
                warning "✗ Health endpoint failed"
                smoke_test_failed=true
            fi

            # Test 2: Manifest loads (public endpoint)
            manifest_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/manifest.json 2>/dev/null || echo "000")
            if [[ "$manifest_status" == "200" ]]; then
                success "✓ Manifest loads (HTTP $manifest_status)"
            else
                warning "✗ Manifest failed (HTTP $manifest_status)"
                smoke_test_failed=true
            fi

            # Test 3: Manifest has proper version (not PLACEHOLDER)
            manifest_json=$(curl -s http://localhost:8000/manifest.json 2>/dev/null)
            if echo "$manifest_json" | grep -q "PLACEHOLDER"; then
                warning "✗ Manifest contains PLACEHOLDER tokens"
                smoke_test_failed=true
            else
                success "✓ Manifest has proper versions (no PLACEHOLDER)"
            fi

            # Test 4: Hierarchy JS loads
            hierarchy_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/static/js/lists/hierarchyView.min.js 2>/dev/null || echo "000")
            if [[ "$hierarchy_status" == "200" ]]; then
                success "✓ Hierarchy JS available (HTTP $hierarchy_status)"
            else
                warning "✗ Hierarchy JS failed (HTTP $hierarchy_status)"
                smoke_test_failed=true
            fi

            # Test 5: Service Worker has version (check minified version)
            if [[ -f "$DEPLOY_DIR/sw.min.js" ]]; then
                sw_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/sw.min.js 2>/dev/null || echo "000")
                if [[ "$sw_status" != "200" ]]; then
                    warning "✗ Service Worker not accessible (HTTP $sw_status)"
                    smoke_test_failed=true
                else
                    sw_content=$(curl -s http://localhost:8000/sw.min.js 2>/dev/null)
                    if echo "$sw_content" | grep -q "CACHE_VERSION_PLACEHOLDER"; then
                        warning "✗ Service Worker contains PLACEHOLDER"
                        smoke_test_failed=true
                    elif echo "$sw_content" | grep -qE "CACHE_VERSION.*=.*['\"]v[0-9]{8}_[0-9]{4}"; then
                        sw_ver=$(echo "$sw_content" | grep -oE "v[0-9]{8}_[0-9]{4}" | head -1)
                        success "✓ Service Worker has version: $sw_ver"
                    else
                        warning "⚠ Could not verify Service Worker version format"
                    fi
                fi
            fi

            echo ""

            if [[ "$smoke_test_failed" == "true" ]]; then
                warning "Smoke tests completed with failures"
                warning "Review warnings above and check logs"
            else
                success "All smoke tests passed!"
            fi

            echo ""
        fi

        # Check for orphaned deployment processes after successful deployment
        # This ensures no deployment-related processes (alembic, npm, pip, rsync) remain running
        # Uvicorn workers and other service processes are excluded from this check
        check_orphaned_deployment_processes || {
            warning "Orphaned processes detected but deployment completed successfully"
            warning "These processes will be automatically cleaned up on next deployment"
        }
        echo ""

        # Soft Docker cleanup AFTER successful deployment
        # Removes unused networks, stopped containers, and clears daemon cache
        # This is a soft alternative to dockerd restart for reducing high CPU
        cleanup_docker_system_soft
        echo ""

        # Final Docker daemon optimization (after all cleanup)
        # Restarts dockerd if CPU still elevated (>50%) to clear accumulated state
        # Can be forced with --restart-dockerd or skipped with --no-restart-dockerd
        if [[ "$SKIP_DOCKERD_RESTART" != "true" ]]; then
            final_dockerd_optimization "$FORCE_DOCKERD_RESTART"
            echo ""
        fi

        # Save deployed version for next deployment comparison
        if [[ -n "${NEW_VERSION:-}" ]]; then
            save_deployed_version "$NEW_VERSION"
        fi
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

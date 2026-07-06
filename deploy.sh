#!/bin/bash
#
# Family Budget - Deployment Script
#
# This script deploys the Family Budget application using Docker Compose:
# - Validates prerequisites (Docker, .env file)
# - Syncs code from repository to deployment directory
# - Pulls pre-built Docker images from GitHub Container Registry (ghcr.io)
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
#   ./deploy.sh --profile full     # full deployment (+ traefik + bot)
#   ./deploy.sh --clean            # Clean deployment (removes data!)
#
# Note: Docker images are pre-built in GitHub Actions CI/CD (registry-first v9.0+).
#       Server only pulls ready images from ghcr.io - no local building occurs.
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
source "$SCRIPT_DIR/scripts/lib/docker.sh"      # Depends on config.sh, utils.sh, postgres.sh
source "$SCRIPT_DIR/scripts/lib/network.sh"     # Depends on config.sh, utils.sh, docker.sh (is_our_docker_container)
source "$SCRIPT_DIR/scripts/lib/ssl.sh"         # Depends on config.sh, utils.sh
source "$SCRIPT_DIR/scripts/lib/registry.sh"    # Depends on config.sh, utils.sh (container registry integration)

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

# Frontend build options
FORCE_FRONTEND_BUILD=false   # Force frontend rebuild regardless of checksums

# Container registry options
USE_REGISTRY=false           # Pull images from container registry instead of building locally
USER_IMAGE_TAG=""            # User-specified image tag (overrides auto-detection)

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
# Functions: check_port_available, ensure_monitoring_network

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
# TRAEFIK CONFIGURATION (REGISTRY-FIRST v9.0+)
# =============================================================================
# Traefik uses native ACME and file-provider templates from git.
# Runtime: traefik/docker-entrypoint.sh renders DOMAIN into config templates.

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
            --major|--minor|--patch)
                # DEPRECATED: Use --version TYPE instead
                warning "DEPRECATED: ${1} is deprecated, use --version ${1#--} instead"
                VERSION_BUMP_TYPE="${1#--}"
                shift
                ;;
            --set-version)
                VERSION_SET="$2"
                # Validate version format
                if [[ ! "$VERSION_SET" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    error "Invalid version format: $VERSION_SET. Must be X.Y.Z (e.g., 5.2.0)"
                fi
                shift 2
                ;;
            --version)
                # Support both old and new usage:
                # OLD (deprecated): --version X.Y.Z → explicit version
                # NEW: --version TYPE → version bump type (patch|minor|major)
                if [[ "$2" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
                    # OLD usage: explicit version number
                    warning "DEPRECATED: --version X.Y.Z is deprecated, use --set-version X.Y.Z instead"
                    VERSION_SET="$2"
                    shift 2
                elif [[ "$2" =~ ^(patch|minor|major)$ ]]; then
                    # NEW usage: version bump type
                    VERSION_BUMP_TYPE="$2"
                    shift 2
                else
                    error "Invalid --version argument: $2. Use --version TYPE (patch|minor|major) or --set-version X.Y.Z"
                fi
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
            --force-build)
                FORCE_FRONTEND_BUILD=true
                shift
                ;;
            --use-registry)
                USE_REGISTRY=true
                shift
                ;;
            --image-tag)
                USER_IMAGE_TAG="$2"
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
        echo "      Protected: .env, .migration_checksums, .docker_build_checksums, backups/, logs/"
        echo ""
        echo "  [2] Update only (rsync)"
        echo "      Updates existing + adds new files"
        echo "      Old files NOT deleted (may leave artifacts)"
        echo ""
        echo "  [3] Clean + copy (DANGEROUS!)"
        echo "      Deletes EVERYTHING (code, logs/*, backups, Docker volumes)"
        echo "      ⚠️  DELETES PostgreSQL database and ALL data!"
        echo "      Protected: .env, .migration_checksums, .docker_build_checksums (directories cleared)"
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
        if [[ "${SSL_TYPE:-none}" == "letsencrypt" ]]; then
            warning "⚠ Port 443 (HTTPS) is NOT open - HTTPS will not work"
        else
            info "Port 443 (HTTPS) not open (SSL_TYPE=${SSL_TYPE:-none} — expected)"
        fi
    fi

    echo ""
    info "Checking security rules..."

    # HTTP (80) - REQUIRED for Traefik HTTP-01 and HTTP-to-HTTPS redirect
    if echo "$ufw_status" | grep -q "80/tcp.*ALLOW"; then
        success "✓ Port 80 (HTTP) is open for Traefik HTTP-01"
    else
        warning "⚠ Port 80 (HTTP) is NOT open - Traefik HTTP-01 will fail"
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

# =============================================================================
# BUILD ARTIFACTS VALIDATION (REMOVED IN v9.0)
# =============================================================================
# validate_build_artifacts() removed - artifacts embedded in Docker images
# Validation happens in GitHub Actions CI/CD (quality-checks job)
# See: .github/workflows/build-and-push.yml


# REMOVED: cleanup_old_images() function (replaced by cleanup_old_image_versions)
# Old function had race condition risks:
# - Only checked docker ps (running containers)
# - Did NOT check IMAGE_VERSIONS.json (deployment source of truth)
# - Did NOT check stopped containers (could be restarted)
# - Could delete active image during deployment (if stopped temporarily)
#
# New approach: Use cleanup_old_image_versions() from scripts/lib/docker.sh
# - Checks docker inspect (actual container image references)
# - Keeps last N versions (predictable)
# - Not affected by image age (better for frequent releases)
# - More reliable protection against active image deletion

main() {
    # Parse arguments
    parse_args "$@"

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"

    # Setup cleanup trap for temporary files
    # This ensures SYNC_FILES_TEMP is removed on script exit (success, error, or Ctrl+C)
    # Prevents accumulation of legacy deployment files in /tmp
    trap 'rm -f /tmp/sync_changed_files_* 2>/dev/null || true' EXIT

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

    # Check if HTTP/HTTPS ports are available (for full profile with Traefik)
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

        info "Checking if ports are available for Traefik..."
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

    # PRE-FLIGHT CHECK: Verify Docker prerequisites
    print_message info "Pre-flight check: Verifying Docker environment..."
    if ! docker ps > /dev/null 2>&1; then
        error "Docker daemon not running"
        error "Start Docker: sudo systemctl start docker"
        exit 1
    fi
    success "Docker daemon running"
    echo ""

    # Traefik metrics use an external monitoring network in full profile.
    if [[ "${DEPLOYMENT_PROFILE:-}" == "full" ]]; then
        ensure_monitoring_network
        echo ""
    fi

    # CHECK: Ensure repository is synchronized with remote
    # Prevents deploying outdated code from un-updated repository
    step "Git Repository Sync Check"
    check_git_sync
    echo ""

    # Synchronize code from repository to /opt/budget
    sync_code_to_deploy
    echo ""

    # VERIFICATION: Check critical files were synced correctly
    # Verifies that expected content exists in deployment directory
    # This catches sync failures (git conflicts, rsync errors)
    # Add new patterns here as critical features are added
    local verification_passed=true
    local verification_checks=0
    local verification_failures=0

    # Check 1: Service Worker registration (critical for PWA)
    if [[ -f "$DEPLOY_DIR/frontend/web/templates/base.html" ]]; then
        ((verification_checks++)) || true
        if grep -q "serviceWorker" "$DEPLOY_DIR/frontend/web/templates/base.html" 2>/dev/null; then
            print_message info "Verified: base.html contains Service Worker registration"
        else
            print_message warning "VERIFICATION FAILED: base.html missing Service Worker registration"
            verification_passed=false
            ((verification_failures++)) || true
        fi
    fi

    # Check 2: sw.min.js exists (built Service Worker)
    if [[ -f "$DEPLOY_DIR/sw.min.js" ]]; then
        ((verification_checks++)) || true
        if grep -q "CACHE_VERSION" "$DEPLOY_DIR/sw.min.js" 2>/dev/null; then
            print_message info "Verified: sw.min.js contains CACHE_VERSION"
        else
            print_message warning "VERIFICATION FAILED: sw.min.js missing CACHE_VERSION"
            verification_passed=false
            ((verification_failures++)) || true
        fi
    fi

    # Summary
    if [[ "$verification_passed" == "true" ]]; then
        print_message success "All $verification_checks verification checks passed"
    else
        print_message warning "Verification: $verification_failures/$verification_checks checks failed"
        print_message warning "Check git status and rsync output above"
    fi

    # AUTO-SYNC: VERSION → package.json (if mismatch detected)
    # Ensures package.json version always matches VERSION file (single source of truth)
    # This fixes existing mismatches (e.g., VERSION=6.6.0, package.json=5.3.0)
    if [[ -f "$DEPLOY_DIR/VERSION" && -f "$DEPLOY_DIR/package.json" ]]; then
        VERSION_FROM_FILE=$(cat "$DEPLOY_DIR/VERSION" | tr -d '[:space:]')
        VERSION_FROM_PKG=$(grep -oP '"version":\s*"\K[^"]+' "$DEPLOY_DIR/package.json")

        if [[ "$VERSION_FROM_FILE" != "$VERSION_FROM_PKG" ]]; then
            print_message warning "VERSION mismatch detected: VERSION ($VERSION_FROM_FILE) ≠ package.json ($VERSION_FROM_PKG)"
            print_message info "Auto-syncing package.json to match VERSION file (single source of truth)..."

            # Update package.json to match VERSION file
            sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION_FROM_FILE\"/" "$DEPLOY_DIR/package.json"

            if [[ $? -eq 0 ]]; then
                # Verify sync was successful
                local synced_version=$(grep -oP '"version":\s*"\K[^"]+' "$DEPLOY_DIR/package.json")
                if [[ "$synced_version" == "$VERSION_FROM_FILE" ]]; then
                    print_message success "package.json synchronized: $VERSION_FROM_PKG → $VERSION_FROM_FILE"
                else
                    print_message error "Verification failed: expected $VERSION_FROM_FILE, got $synced_version"
                    exit 1
                fi
            else
                print_message error "Failed to update package.json"
                exit 1
            fi
        else
            print_message info "VERSION and package.json are synchronized: $VERSION_FROM_FILE"
        fi
    fi
    echo ""

    # AUTO-SYNC: VERSION → .env (if mismatch detected)
    # Ensures .env VERSION always matches VERSION file (single source of truth)
    # This prevents Docker containers from loading stale VERSION via environment variables
    if [[ -f "$DEPLOY_DIR/VERSION" && -f "$DEPLOY_DIR/.env" ]]; then
        VERSION_FROM_FILE=$(cat "$DEPLOY_DIR/VERSION" | tr -d '[:space:]')
        VERSION_FROM_ENV=$(grep -oP '^VERSION=\K.*' "$DEPLOY_DIR/.env" 2>/dev/null || echo "")

        if [[ "$VERSION_FROM_FILE" != "$VERSION_FROM_ENV" ]]; then
            print_message warning "VERSION mismatch detected: VERSION ($VERSION_FROM_FILE) ≠ .env ($VERSION_FROM_ENV)"
            print_message info "Auto-syncing .env to match VERSION file (single source of truth)..."

            # Update .env to match VERSION file
            if grep -q '^VERSION=' "$DEPLOY_DIR/.env"; then
                # VERSION exists in .env - update it
                sed -i "s|^VERSION=.*|VERSION=$VERSION_FROM_FILE|" "$DEPLOY_DIR/.env"
            else
                # VERSION doesn't exist in .env - append it
                echo "VERSION=$VERSION_FROM_FILE" >> "$DEPLOY_DIR/.env"
            fi

            if [[ $? -eq 0 ]]; then
                # Verify sync was successful
                local synced_version=$(grep -oP '^VERSION=\K.*' "$DEPLOY_DIR/.env")
                if [[ "$synced_version" == "$VERSION_FROM_FILE" ]]; then
                    print_message success ".env synchronized: VERSION=$VERSION_FROM_ENV → VERSION=$VERSION_FROM_FILE"
                    print_message info "Note: Backend container restart required for changes to take effect"
                else
                    print_message error "Verification failed: expected $VERSION_FROM_FILE, got $synced_version"
                    exit 1
                fi
            else
                print_message error "Failed to update .env"
                exit 1
            fi
        else
            print_message info "VERSION and .env are synchronized: $VERSION_FROM_FILE"
        fi
    fi
    echo ""

    # Analyze sync changes for smart restart decisions
    # IMPORTANT: Must run AFTER sync_code_to_deploy() because:
    # - Uses SYNC_CHANGED_FILES environment variable set by sync_update()
    # - Sets recreation flags for ALL services:
    #   NEEDS_POSTGRES_RECREATE  (migrations changed)
    #   NEEDS_REDIS_RECREATE     (redis code/config changed)
    #   NEEDS_BACKEND_RECREATE   (templates/static/Python changed)
    #   NEEDS_BOT_RECREATE       (bot code changed)
    #   NEEDS_TRAEFIK_RECREATE   (Traefik config changed)
    #   NEEDS_FULL_RESTART       (docker-compose.yml global changes)
    # - Flags used by start_postgres_only(), start_redis_only(), start_application_services()
    analyze_sync_changes
    echo ""

    # VERSION MANAGEMENT (AFTER SYNC!)
    # Registry-first v9.0: Version management in CI/CD
    # Server uses IMAGE_VERSIONS.json to determine which image versions to pull
    # VERSION file is authoritative source (synced from git)
    # No server-side version bumping - all changes committed to git first
    echo ""

    # NOTE: Traefik configuration is rendered by traefik/docker-entrypoint.sh

    # Regenerate PWA icons if trigger file exists (AFTER sync)
    # This ensures new icons are available before Service Worker cache is updated
    regenerate_pwa_icons_if_needed

    # =============================================================================
    # REGISTRY-FIRST ARCHITECTURE (v9.0.0+)
    # =============================================================================
    # All building (minification, cache busting, packaging) happens in GitHub Actions CI/CD.
    # On server: only pull ready Docker images from ghcr.io and run them.
    #
    # Benefits:
    # - Faster deployments (2-3 min vs 5-7 min)
    # - No npm/Node.js dependencies on server
    # - Consistent builds across environments
    # - Frontend embedded in backend Docker image (no bind mounts)
    #
    # See: .github/workflows/build-and-push.yml for CI/CD pipeline
    # =============================================================================

    step "Pulling Docker Images from GitHub Container Registry"
    echo ""
    cd "/opt/budget" || error_return "Failed to cd to /opt/budget"

    # Determine image tag from VERSION file
    if [[ -f "$DEPLOY_DIR/VERSION" ]]; then
        VERSION=$(cat "$DEPLOY_DIR/VERSION" | tr -d '[:space:]')
        info "Deploying version: $VERSION"
    else
        error "VERSION file not found in $DEPLOY_DIR"
        exit 1
    fi
    echo ""

    # NEW: Display and confirm IMAGE_VERSIONS.json (v9.0+)
    info "Reading deployment versions from IMAGE_VERSIONS.json..."
    if [[ -f "$DEPLOY_DIR/IMAGE_VERSIONS.json" ]]; then
        # Display versions + ask confirmation (display_deployment_versions called inside)
        if ! confirm_deployment_versions; then
            error "Deployment cancelled by user"
            exit 1
        fi

        # NEW: Generate .env file from IMAGE_VERSIONS.json
        if ! generate_env_from_image_versions; then
            error "Failed to generate .env from IMAGE_VERSIONS.json"
            exit 1
        fi

        # Skip confirmation in pull_from_registry (already confirmed above)
        export SKIP_VERSION_CONFIRM=true
    else
        error "IMAGE_VERSIONS.json not found in $DEPLOY_DIR"
        error "This file should be auto-generated by GitHub Actions"
        error ""
        error "Troubleshooting:"
        error "  1. Verify GitHub Actions workflow completed"
        error "  2. Check git pull succeeded"
        error "  3. Verify IMAGE_VERSIONS.json exists in repository"
        exit 1
    fi
    echo ""

    # =============================================================================
    # REGISTRY-FIRST OPTIMIZATION: Cleanup old images BEFORE pull
    # =============================================================================
    # Free disk space before downloading new images (up to 2GB)
    # This prevents "no space left on device" errors during pull
    # Note: cleanup_old_image_versions() is safer than cleanup_old_images():
    # - Checks docker inspect (protects running containers)
    # - Keeps last N versions (predictable for frequent releases)
    step "Cleaning Up Old Docker Images (Pre-Pull Optimization)"
    if cleanup_old_image_versions 3; then
        success "Old Docker image versions cleaned up successfully"
        info "Disk space freed for new image pull"
    else
        warning "Image cleanup had some issues - continuing anyway"
    fi
    echo ""

    # Pre-validate all images exist in registry before attempting pull
    step "Validating Image Availability in Registry"
    if ! validate_registry_images; then
        error "Deployment aborted: required images missing from registry"
        error "Check IMAGE_VERSIONS.json versions and ensure CI/CD built all images"
        exit 1
    fi
    echo ""

    # Pull images from ghcr.io (backend, bot, redis, postgresql)
    # Versions exported to .env: BACKEND_VERSION, BOT_VERSION, etc.
    info "Pulling Docker images from registry..."
    if ! pull_from_registry; then
        error "Failed to pull Docker images from registry"
        error ""
        error "Please check:"
        error "  1. GitHub Actions build completed successfully"
        error "  2. Images exist in ghcr.io/ikeniborn/familybudget-*:${VERSION}"
        error "  3. Network connectivity to ghcr.io"
        error "  4. Docker daemon is running"
        error ""
        error "To debug: docker pull ghcr.io/ikeniborn/familybudget-backend:${VERSION}"
        exit 1
    fi
    echo ""
    success "All Docker images pulled successfully"
    echo ""

    # Compare running containers with pulled images
    # Sets NEEDS_*_RECREATE flags if images differ or containers unhealthy
    info "Comparing running containers with pulled images..."
    if ! compare_running_vs_pulled_images; then
        error "Failed to compare container images"
        exit 1
    fi
    echo ""


    # REMOVED: Build artifacts validation (v9.0 registry-first)
    # validate_build_artifacts() function was removed - artifacts are validated in CI/CD
    # (GitHub Actions quality-checks job) and embedded in Docker images.
    # No validation needed on server during deployment.

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
                # Issue #6 fix: Ask BEFORE changing mode, not after
                warning "Atomic repair completed but PostgreSQL still unhealthy"
                echo ""

                # ASK FIRST, THEN CHANGE MODE
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo "⚠️  CLEANUP MODE UPGRADE REQUIRED"
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
                echo "Your selection: Smart cleanup (atomic PostgreSQL repair)"
                echo "Problem: PostgreSQL remains unhealthy after atomic repair"
                echo ""
                echo "Recommended action: Upgrade to Full cleanup mode"
                echo "  • Stops all containers"
                echo "  • Removes Docker networks"
                echo "  • Comprehensive PostgreSQL data directory repair"
                echo "  • Restarts all services"
                echo ""
                echo "⚠️  DATA IS PRESERVED (volumes NOT deleted)."
                echo ""
                read -p "Upgrade to Full cleanup mode? [Y/n]: " -r
                echo ""

                if [[ $REPLY =~ ^[Yy]?$ ]]; then
                    # CHANGE MODE AFTER USER APPROVES
                    CLEANUP_MODE="full"
                    success "Cleanup mode upgraded: smart → full (user approved)"
                    echo ""
                else
                    error "Full cleanup declined by user"
                    error "Cannot continue - PostgreSQL is unhealthy"
                    error ""
                    error "Options:"
                    error "  1. Re-run deployment and accept Full cleanup"
                    error "  2. Manually investigate PostgreSQL corruption"
                    error "  3. Use --cleanup-mode full explicitly"
                    exit 1
                fi
            fi
        else
            # Atomic repair failed completely
            warning "Atomic repair failed - Full cleanup mode required"
            echo ""

            # ASK FIRST, THEN CHANGE MODE
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "⚠️  CLEANUP MODE UPGRADE REQUIRED"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Your selection: Smart cleanup (atomic PostgreSQL repair)"
            echo "Problem: Atomic repair could not execute (PostgreSQL severely corrupted)"
            echo ""
            echo "Recommended action: Upgrade to Full cleanup mode"
            echo "  • Stops all containers"
            echo "  • Removes Docker networks"
            echo "  • Comprehensive PostgreSQL data directory repair"
            echo "  • Restarts all services"
            echo ""
            echo "⚠️  DATA IS PRESERVED (volumes NOT deleted)."
            echo ""
            read -p "Upgrade to Full cleanup mode? [Y/n]: " -r
            echo ""

            if [[ $REPLY =~ ^[Yy]?$ ]]; then
                # CHANGE MODE AFTER USER APPROVES
                CLEANUP_MODE="full"
                success "Cleanup mode upgraded: smart → full (user approved)"
                echo ""
            else
                error "Full cleanup declined by user"
                error "Cannot continue - PostgreSQL repair failed"
                error ""
                error "Options:"
                error "  1. Re-run deployment and accept Full cleanup"
                error "  2. Manually investigate PostgreSQL corruption"
                error "  3. Use --cleanup-mode full explicitly"
                exit 1
            fi
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

    # NOTE: cleanup_old_image_versions() moved to PHASE 2 (before pull_from_registry)
    # This frees disk space BEFORE pulling new images (registry-first optimization)
    # See: Image Management section above

    # Check Docker daemon health and restart if CPU is too high (>50%)
    # High dockerd CPU often indicates accumulated state from many images
    check_and_restart_dockerd 50
    echo ""

    # NOTE: PostgreSQL initialization and repair functions removed after migration to Docker managed volume
    # Docker managed volumes automatically handle directory creation and permissions

    # Note: Image building now happens automatically in start_services()
    # via 'docker compose up --build' which uses cache for unchanged images

    # stop_services removed - redundant after cleanup_old_deployment

    # NOTE: Traefik configuration is rendered by traefik/docker-entrypoint.sh

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
    # Phase 2: Bot/Traefik (backend already running from Phase 1.5)

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

        # Phase 2: Start remaining application services (bot, Traefik)
        # Backend already running, this starts bot/Traefik only
        if ! start_application_services; then
            error "Deployment failed: Application services failed to start"
            error "Log file: $LOG_FILE"
            exit 1
        fi
        echo ""

        # Wait for all services to become healthy
        wait_for_services
        echo ""

        # NOTE: Old Docker image cleanup moved to PHASE 2 (before pull_from_registry)
        # This optimization frees disk space BEFORE pulling new images
        # No need to cleanup again here - already done during image management phase

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

        # Configure firewall for Traefik HTTP-01 and HTTPS traffic
        configure_firewall_for_ssl
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

            # Test 4: Lists bundle loads (includes HierarchyView since ES Modules migration)
            lists_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/static/js/lists.min.js 2>/dev/null || echo "000")
            if [[ "$lists_status" == "200" ]]; then
                success "✓ Lists bundle available (HTTP $lists_status)"
            else
                warning "✗ Lists bundle failed (HTTP $lists_status)"
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
                    elif echo "$sw_content" | grep -qE "['\"]v[0-9]{8}_[0-9]{4}['\"]"; then
                        # NOTE: After Vite minification, CACHE_VERSION variable name is mangled (e.g. -> f)
                        # So we search for version string directly instead of variable name
                        sw_ver=$(echo "$sw_content" | grep -oE "v[0-9]{8}_[0-9]{4}" | head -1)
                        success "✓ Service Worker has version: $sw_ver"
                    else
                        # SW accessible and no PLACEHOLDER — version string may be minified differently
                        success "✓ Service Worker available (HTTP 200, no PLACEHOLDER)"
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
        # Symmetrical policy with deployment start (line 871): auto-terminate orphaned processes
        check_orphaned_deployment_processes --terminate || {
            warning "Failed to terminate orphaned processes"
            warning "Manual cleanup may be required"
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

        # Cleanup temporary sync files
        # Remove any sync_changed_files_* from current and previous deployments
        # This complements the trap EXIT cleanup for additional safety
        rm -f /tmp/sync_changed_files_* 2>/dev/null || true

        print_status
    else
        info "Running in foreground mode (Ctrl+C to stop)"
        info "Services will be stopped when you exit"
        # Logs will be shown by docker compose up in foreground mode
    fi
}

# Run main function
main "$@"

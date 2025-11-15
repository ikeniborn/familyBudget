#!/bin/bash
#
# validation.sh - Prerequisites and Environment Validation
#
# This module provides functions for validating deployment prerequisites
# and environment configuration.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/validation.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR)
#   - utils.sh (for logging functions, command_exists)
#

# =============================================================================
# HELP MESSAGE
# =============================================================================

# Print help message
print_help() {
    cat << EOF
Family Budget - Deployment Script

Usage:
  ./deploy.sh [OPTIONS]

Options:
  -h, --help                      Show this help message
  -d, --detach                    Run in detached mode (default)
  -f, --foreground                Run in foreground (show logs)
  -p, --profile PROFILE           Docker Compose profile (default: auto-detect from .env)
  --no-migrate                    Skip database migrations
  --migrations-only               Run ONLY migrations (skip build/restart containers)
  --clean                         Clean deployment (remove volumes) - WARNING: DELETES DATA!
  --sync-mode MODE                Code sync mode: mirror|update|clean|skip (default: interactive)
  --repo-dir PATH                 Repository directory path (default: auto-detect)
  --reapply-migration REVISION    Force reapply specific migration (downgrade then upgrade)
                                  Example: --reapply-migration b2232d851007
                                  WARNING: May cause data loss if downgrade() drops data!

Sync Modes:
  mirror   - Full sync with --delete (removes files not in repository)
             Protected: .env, backups/, data/, logs/, .git/
  update   - Only update/add files (keeps old files)
  clean    - Full cleanup + copy (DELETES everything except .env and backups/)
  skip     - No code synchronization (use current code in /opt/budget)

Examples:
  ./deploy.sh                                # Interactive sync mode + deploy
  ./deploy.sh --sync-mode mirror             # Mirror sync + deploy
  ./deploy.sh --sync-mode skip               # Deploy without code sync
  ./deploy.sh --repo-dir ~/familyBudget      # Specify repository path
  ./deploy.sh --reapply-migration b2232d851007  # Manually reapply specific migration (downgrade/upgrade)
  AUTO_REAPPLY_MIGRATIONS=true ./deploy.sh   # Enable auto-detection of changed migrations (dev/staging only)

Workflow:
  1. Detects repository directory (current dir, ~/familyBudget, or ask)
  2. Syncs code from repository to /opt/budget (unless --sync-mode skip)
  3. Builds Docker images (only changed layers)
  4. Starts services with Docker Compose
  5. Runs database migrations
  6. Sets up SSL certificates (if configured)

Profiles:
  none (default)   - PostgreSQL + Backend only
  full             - All services (PostgreSQL + Backend + Bot + Nginx + Certbot)

Prerequisites:
  - Docker and Docker Compose installed (run install.sh)
  - .env file configured in /opt/budget (run setup.sh)
  - Repository with latest code (git pull before deploy)

For more information, see CLAUDE.md
EOF
}

# =============================================================================
# PREREQUISITES VALIDATION
# =============================================================================

# Check prerequisites (early stage - before code sync)
check_prerequisites_early() {
    info "Checking prerequisites (early stage)..."

    # Check if Docker is installed
    if ! command_exists docker; then
        error "Docker is not installed. Please run install.sh first."
    fi

    # Check if Docker Compose is installed
    if ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is not installed. Please run install.sh first."
    fi

    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running. Please start Docker service."
    fi

    # Check deployment directory exists
    if [[ ! -d "$DEPLOY_DIR" ]]; then
        error "Deployment directory $DEPLOY_DIR does not exist."
        echo ""
        echo "Please run install.sh first:"
        echo "  sudo ./install.sh"
        exit 1
    fi

    # Check if .env file exists
    if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
        error ".env file not found in $DEPLOY_DIR."
        echo ""
        echo "Please run setup.sh first to configure environment:"
        echo "  ./setup.sh"
        exit 1
    fi

    success "Early prerequisites check passed"
}

# Check prerequisites (late stage - after code sync)
check_prerequisites_late() {
    info "Checking prerequisites (after code sync)..."

    # Check if docker-compose.yml exists (should be copied by sync_code_to_deploy)
    if [[ ! -f "$DEPLOY_DIR/docker-compose.yml" ]]; then
        error "docker-compose.yml not found in $DEPLOY_DIR"
        echo ""
        echo "This file should have been synchronized from repository."
        echo ""
        echo "Possible causes:"
        echo "  1. Code synchronization failed"
        echo "  2. Repository doesn't contain docker-compose.yml"
        echo "  3. You skipped code synchronization but /opt/budget is empty"
        echo ""
        echo "To fix:"
        echo "  cd ~/familyBudget  # Your git repository"
        echo "  ./deploy.sh        # Try deployment again"
        exit 1
    fi

    # Check required directories
    local required_dirs=("data" "backups" "logs")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$DEPLOY_DIR/$dir" ]]; then
            info "Creating directory: $DEPLOY_DIR/$dir"
            mkdir -p "$DEPLOY_DIR/$dir"
        fi
    done

    success "All prerequisites verified"
}

# =============================================================================
# ENVIRONMENT VALIDATION
# =============================================================================

# Validate environment variables
validate_env() {
    info "Validating environment variables..."

    # Check if .env file is readable
    if [[ ! -r "$DEPLOY_DIR/.env" ]]; then
        error ".env file is not readable. Please check file permissions."
        echo ""
        echo "File: $DEPLOY_DIR/.env"
        echo "Current user: $(whoami)"
        echo ""
        echo "To fix:"
        echo "  1. Run deploy.sh as the same user who ran setup.sh"
        echo "  2. Or fix permissions: chmod 640 $DEPLOY_DIR/.env"
        echo "  3. Ensure you're in the docker group: groups | grep docker"
        exit 1
    fi

    # Source .env file
    set -a
    source "$DEPLOY_DIR/.env"
    set +a

    # Check required variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "JWT_SECRET"
        "TELEGRAM_BOT_TOKEN"
        "ADMIN_TELEGRAM_ID"
    )

    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
    fi

    # Check for default values that should be changed
    if [[ "$POSTGRES_PASSWORD" == "CHANGE_ME_STRONG_PASSWORD_HERE" ]]; then
        error "POSTGRES_PASSWORD is not set. Please configure .env file."
    fi

    if [[ "$JWT_SECRET" == "CHANGE_ME_GENERATE_WITH_OPENSSL" ]]; then
        error "JWT_SECRET is not set. Please configure .env file."
    fi

    success "Environment variables validated"
}

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

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

# Service health check configuration
MAX_WAIT_TIME=120  # Maximum wait time for services (seconds)
CHECK_INTERVAL=5   # Interval between health checks (seconds)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Print info message
info() {
    print_message "$BLUE" "[INFO] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $*" >> "$LOG_FILE"
}

# Print success message
success() {
    print_message "$GREEN" "[SUCCESS] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [SUCCESS] $*" >> "$LOG_FILE"
}

# Print warning message
warning() {
    print_message "$YELLOW" "[WARNING] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [WARNING] $*" >> "$LOG_FILE"
}

# Print error message and exit
error() {
    print_message "$RED" "[ERROR] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*" >> "$LOG_FILE"
    exit 1
}

# Print step message
step() {
    print_message "$MAGENTA" "▶ $*"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running with root/sudo privileges
check_root_privileges() {
    if [[ $EUID -ne 0 ]]; then
        return 1
    fi
    return 0
}

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
  --clean                         Clean deployment (remove volumes) - WARNING: DELETES DATA!
  --sync-mode MODE                Code sync mode: mirror|update|clean|skip (default: interactive)
  --repo-dir PATH                 Repository directory path (default: auto-detect)

Sync Modes:
  mirror   - Full sync with --delete (removes files not in repository)
             Protected: .env, backups/, data/, logs/, .git/
  update   - Only update/add files (keeps old files)
  clean    - Full cleanup + copy (DELETES everything except .env and backups/)
  skip     - No code synchronization (use current code in /opt/budget)

Examples:
  ./deploy.sh                            # Interactive sync mode + deploy
  ./deploy.sh --sync-mode mirror         # Mirror sync + deploy
  ./deploy.sh --sync-mode skip           # Deploy without code sync
  ./deploy.sh --repo-dir ~/familyBudget  # Specify repository path

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
# VALIDATION FUNCTIONS
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

# =============================================================================
# CODE SYNCHRONIZATION FUNCTIONS
# =============================================================================

# Detect repository directory
detect_repository_dir() {
    local detected_dir=""

    # Option 1: User specified via --repo-dir
    if [[ -n "$REPO_DIR_OVERRIDE" ]]; then
        if [[ -d "$REPO_DIR_OVERRIDE/.git" && -f "$REPO_DIR_OVERRIDE/docker-compose.yml" ]]; then
            detected_dir="$REPO_DIR_OVERRIDE"
            info "Using specified repository: $detected_dir" >&2
            echo "$detected_dir"
            return 0
        else
            error "Specified repository directory is invalid: $REPO_DIR_OVERRIDE"
            echo "" >&2
            echo "Repository must contain:" >&2
            echo "  - .git directory (git repository)" >&2
            echo "  - docker-compose.yml file" >&2
            exit 1
        fi
    fi

    # Option 2: Current directory
    if [[ -d "$SCRIPT_DIR/.git" && -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
        detected_dir="$SCRIPT_DIR"
        info "Repository detected in current directory: $detected_dir" >&2
        echo "$detected_dir"
        return 0
    fi

    # Option 3: ~/familyBudget
    if [[ -d "$HOME/familyBudget/.git" && -f "$HOME/familyBudget/docker-compose.yml" ]]; then
        detected_dir="$HOME/familyBudget"
        info "Repository detected at: $detected_dir" >&2
        echo "$detected_dir"
        return 0
    fi

    # Option 4: SCRIPT_DIR == DEPLOY_DIR (running from /opt/budget)
    if [[ "$SCRIPT_DIR" == "$DEPLOY_DIR" ]]; then
        warning "deploy.sh running from deployment directory ($DEPLOY_DIR)" >&2
        warning "This is NOT a development repository!" >&2
        echo "" >&2
        info "Recommended workflow:" >&2
        echo "  1. Clone repository: git clone <url> ~/familyBudget" >&2
        echo "  2. Update code: cd ~/familyBudget && git pull" >&2
        echo "  3. Deploy: ./deploy.sh" >&2
        echo "" >&2
        echo "Choose action:" >&2
        echo "  [1] Skip code synchronization (deploy current code in /opt/budget)" >&2
        echo "  [2] Specify repository path manually" >&2
        echo "  [3] Cancel deployment" >&2
        echo "" >&2

        read -p "Select [1-3]: " choice
        echo "" >&2

        case $choice in
            1)
                info "Skipping code synchronization" >&2
                SYNC_MODE="skip"
                echo "" >&2
                return 1
                ;;
            2)
                read -p "Enter repository path: " repo_path
                if [[ -d "$repo_path/.git" && -f "$repo_path/docker-compose.yml" ]]; then
                    detected_dir="$repo_path"
                    info "Using repository: $detected_dir" >&2
                    echo "$detected_dir"
                    return 0
                else
                    error "Invalid repository path: $repo_path"
                    exit 1
                fi
                ;;
            3)
                error "Deployment cancelled by user"
                ;;
            *)
                error "Invalid choice"
                ;;
        esac
    fi

    # Option 5: Interactive prompt
    warning "Repository directory not found automatically" >&2
    echo "" >&2
    echo "Checked locations:" >&2
    echo "  - Current directory: $SCRIPT_DIR" >&2
    echo "  - Home directory: ~/familyBudget" >&2
    echo "" >&2
    echo "Options:" >&2
    echo "  [1] Enter repository path manually" >&2
    echo "  [2] Skip code synchronization (deploy current code)" >&2
    echo "  [3] Cancel deployment" >&2
    echo "" >&2

    read -p "Select [1-3]: " choice
    echo "" >&2

    case $choice in
        1)
            read -p "Enter repository path: " repo_path
            if [[ -d "$repo_path/.git" && -f "$repo_path/docker-compose.yml" ]]; then
                detected_dir="$repo_path"
                info "Using repository: $detected_dir" >&2
                echo "$detected_dir"
                return 0
            else
                error "Invalid repository path: $repo_path"
                exit 1
            fi
            ;;
        2)
            info "Skipping code synchronization" >&2
            SYNC_MODE="skip"
            return 1
            ;;
        3)
            error "Deployment cancelled by user"
            ;;
        *)
            error "Invalid choice"
            ;;
    esac
}

# Check if there are code changes to sync
check_code_changes() {
    local repo_dir=$1

    # Use rsync --dry-run to detect changes
    local changes=$(rsync -avn \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        "$repo_dir/" "$DEPLOY_DIR/" 2>/dev/null | grep -v "/$" | grep -v "^sending\|^sent\|^total" | wc -l)

    if [[ $changes -gt 0 ]]; then
        info "Detected $changes changed files"
        return 0  # Changes exist
    else
        info "No code changes detected"
        return 1  # No changes
    fi
}

# Sync code using mirror mode (rsync --delete)
sync_mirror() {
    local repo_dir=$1

    info "Syncing code: mirror mode (rsync --delete)"
    info "From: $repo_dir"
    info "To:   $DEPLOY_DIR"
    echo ""

    # Show preview of changes
    info "Preview of changes (first 20 files):"
    rsync -avn \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        "$repo_dir/" "$DEPLOY_DIR/" 2>/dev/null | grep -v "/$" | grep -v "^sending\|^sent\|^total" | head -20

    echo ""
    read -p "Continue with mirror sync? [Y/n]: " confirm

    if [[ "${confirm,,}" == "n" ]]; then
        warning "Sync cancelled by user"
        return 1
    fi

    # Perform sync
    if rsync -av --delete \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        "$repo_dir/" "$DEPLOY_DIR/" >> "$LOG_FILE" 2>&1; then
        success "Code synced successfully (mirror mode)"
        return 0
    else
        error "Failed to sync code. Check $LOG_FILE for details."
        return 1
    fi
}

# Sync code using update mode (rsync + delete orphaned files)
sync_update() {
    local repo_dir=$1

    info "Syncing code: update mode + cleanup orphaned files"
    info "From: $repo_dir"
    info "To:   $DEPLOY_DIR"
    echo ""

    # Show preview
    info "Preview of changes (first 20 files):"
    rsync -avn \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        "$repo_dir/" "$DEPLOY_DIR/" 2>/dev/null | grep -v "/$" | grep -v "^sending\|^sent\|^total" | head -20

    echo ""
    read -p "Continue with update sync? [Y/n]: " confirm

    if [[ "${confirm,,}" == "n" ]]; then
        warning "Sync cancelled by user"
        return 1
    fi

    # 1. Perform rsync (update/add files)
    info "Step 1/2: Syncing new and modified files..."
    if ! rsync -av \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        "$repo_dir/" "$DEPLOY_DIR/" >> "$LOG_FILE" 2>&1; then
        error "Failed to sync code. Check $LOG_FILE for details."
        return 1
    fi

    # 2. Find and remove orphaned files (not in repository)
    info "Step 2/2: Cleaning orphaned files..."

    local temp_repo_list="/tmp/deploy_repo_files_$$"
    local temp_deploy_list="/tmp/deploy_deploy_files_$$"
    local deleted_count=0

    # Generate list of files in repository (relative paths)
    (cd "$repo_dir" && find . -type f \
        ! -path "./.git/*" \
        ! -path "./.env" \
        ! -path "./data/*" \
        ! -path "./logs/*" \
        ! -path "./backups/*" \
        ! -name "*.pyc" \
        ! -path "./__pycache__/*" \
        ! -path "./node_modules/*" \
        ! -path "./docker-compose.networks.yml" \
        2>/dev/null | sed 's|^./||' | sort) > "$temp_repo_list"

    # Generate list of files in deploy directory
    (cd "$DEPLOY_DIR" && find . -type f \
        ! -path "./.git/*" \
        ! -path "./.env" \
        ! -path "./data/*" \
        ! -path "./logs/*" \
        ! -path "./backups/*" \
        ! -name "*.pyc" \
        ! -path "./__pycache__/*" \
        ! -path "./node_modules/*" \
        ! -path "./docker-compose.networks.yml" \
        2>/dev/null | sed 's|^./||' | sort) > "$temp_deploy_list"

    # Find orphaned files (in deploy but not in repo)
    while IFS= read -r deploy_file; do
        if ! grep -Fxq "$deploy_file" "$temp_repo_list"; then
            if [[ -f "$DEPLOY_DIR/$deploy_file" ]]; then
                rm -f "$DEPLOY_DIR/$deploy_file" && {
                    echo "  Deleted: $deploy_file" | tee -a "$LOG_FILE"
                    deleted_count=$((deleted_count + 1))
                }
            fi
        fi
    done < "$temp_deploy_list"

    # Cleanup temp files
    rm -f "$temp_repo_list" "$temp_deploy_list"

    # Remove empty directories
    find "$DEPLOY_DIR" -type d -empty -delete 2>/dev/null || true

    success "Code synced: updated/added files, deleted $deleted_count orphaned files"
    return 0
}

# Sync code using clean mode (full cleanup + copy)
sync_clean() {
    local repo_dir=$1

    warning "Clean sync: DELETES everything in $DEPLOY_DIR except .env"
    warning "This will also DELETE backups/ directory!"
    echo ""
    read -p "Type 'CLEAN' to confirm (all caps): " confirm
    echo ""

    if [[ "$confirm" != "CLEAN" ]]; then
        warning "Clean sync cancelled"
        return 1
    fi

    info "Performing clean sync..."

    # Remove all directories except .env, data/, logs/
    local dirs_to_remove=("backend" "bot" "nginx" "web" "scripts" "backups")
    for dir in "${dirs_to_remove[@]}"; do
        if [[ -d "$DEPLOY_DIR/$dir" ]]; then
            info "Removing $DEPLOY_DIR/$dir"
            rm -rf "$DEPLOY_DIR/$dir" || warning "Failed to remove $dir"
        fi
    done

    # Remove docker-compose.yml
    if [[ -f "$DEPLOY_DIR/docker-compose.yml" ]]; then
        info "Removing docker-compose.yml"
        rm -f "$DEPLOY_DIR/docker-compose.yml"
    fi

    # Copy everything from repository
    info "Copying code from $repo_dir to $DEPLOY_DIR"
    if rsync -av \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        "$repo_dir/" "$DEPLOY_DIR/" >> "$LOG_FILE" 2>&1; then
        success "Code synced successfully (clean mode)"
        return 0
    else
        error "Failed to sync code. Check $LOG_FILE for details."
        return 1
    fi
}

# Main code synchronization function
sync_code_to_deploy() {
    step "Code Synchronization"

    # Check if sync should be skipped
    if [[ "$SYNC_MODE" == "skip" ]]; then
        info "Skipping code synchronization (--sync-mode skip)"
        info "Using current code in: $DEPLOY_DIR"
        return 0
    fi

    # Detect repository directory
    local repo_dir=$(detect_repository_dir)
    if [[ $? -ne 0 || -z "$repo_dir" ]]; then
        # detect_repository_dir already set SYNC_MODE=skip if user chose to skip
        if [[ "$SYNC_MODE" == "skip" ]]; then
            return 0
        fi
        error "Failed to detect repository directory"
        exit 1
    fi

    # Check for code changes
    if ! check_code_changes "$repo_dir"; then
        info "No code changes detected. Skipping synchronization."
        echo ""
        read -p "Force sync anyway? [y/N]: " force
        if [[ "${force,,}" != "y" ]]; then
            info "Skipping code synchronization"
            return 0
        fi
    fi

    # Interactive mode selection (if not specified via CLI)
    if [[ -z "$SYNC_MODE" ]]; then
        echo ""
        info "Code synchronization required"
        echo ""
        echo "Select sync mode:"
        echo "  [1] Mirror (rsync --delete) - RECOMMENDED"
        echo "      Removes files from /opt/budget not in repository"
        echo "      Protected: .env, backups/, data/, logs/"
        echo ""
        echo "  [2] Update only (rsync)"
        echo "      Updates existing + adds new files"
        echo "      Old files NOT deleted (may leave artifacts)"
        echo ""
        echo "  [3] Clean + copy (DANGEROUS!)"
        echo "      Deletes ALL code AND backups in /opt/budget, then copies from repository"
        echo "      Protected: .env, data/, logs/ only"
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
                info "Skipping code synchronization"
                return 0
                ;;
            *)
                error "Invalid choice"
                exit 1
                ;;
        esac
    fi

    # Execute sync based on selected mode
    case "$SYNC_MODE" in
        mirror)
            sync_mirror "$repo_dir" || exit 1
            ;;
        update)
            sync_update "$repo_dir" || exit 1
            ;;
        clean)
            sync_clean "$repo_dir" || exit 1
            ;;
        skip)
            info "Skipping code synchronization"
            return 0
            ;;
        *)
            error "Invalid sync mode: $SYNC_MODE"
            exit 1
            ;;
    esac

    # Log synchronization
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] Code synchronized from $repo_dir (mode: $SYNC_MODE)" >> "$LOG_FILE"
}

# =============================================================================
# NETWORK AND CLEANUP FUNCTIONS
# =============================================================================

# Cleanup containers and networks only (safe - keeps data)
cleanup_containers_networks() {
    info "Stopping and removing old containers and networks..."

    # Use docker compose stop for graceful shutdown (respects stop_grace_period and stop_signal)
    # This prevents PostgreSQL data corruption by allowing proper cleanup
    if compose_cmd ps -q 2>/dev/null | grep -q .; then
        info "Gracefully stopping services with extended timeout..."
        # Use 90s timeout: gives PostgreSQL 60s (stop_grace_period) + 30s buffer
        compose_cmd stop --timeout 90 >> "$LOG_FILE" 2>&1 || true
        success "Services stopped gracefully"
    fi

    # Remove stopped containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Removing containers: $containers"
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
        success "Containers removed"
    fi

    # Remove all familybudget networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing networks: $networks"
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
        success "Networks removed"
    fi

    success "Safe cleanup completed (data volumes preserved)"
}

# Selective cleanup - restart only app services (KEEPS PostgreSQL running)
cleanup_selective() {
    info "Selective restart - stopping only app services (PostgreSQL stays running)..."
    echo ""

    # Stop and remove only app containers (NOT postgres)
    local app_containers=("familybudget-backend" "familybudget-bot" "familybudget-nginx")

    for container in "${app_containers[@]}"; do
        if docker ps -a --format "{{.Names}}" 2>/dev/null | grep -q "^${container}$"; then
            info "Stopping $container..."
            docker stop "$container" >> "$LOG_FILE" 2>&1 || true
            info "Removing $container..."
            docker rm "$container" >> "$LOG_FILE" 2>&1 || true
        fi
    done

    # Keep PostgreSQL container running
    if docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^familybudget-postgres$"; then
        success "PostgreSQL container kept running (no restart)"
    else
        warning "PostgreSQL container not found - will be started with full deployment"
    fi

    success "Selective cleanup completed (PostgreSQL preserved)"
}

# Initialize PostgreSQL data directory with correct permissions
initialize_postgres_directory() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    # Detect current PostgreSQL UID from existing data (if any)
    # Default: 999:999 (Alpine Linux PostgreSQL)
    # Alternative: 70:70 (Debian/Ubuntu PostgreSQL)
    local target_uid=999
    local target_gid=999

    if [[ -d "$postgres_data_dir/base" ]]; then
        # Data exists - detect current owner from base/ directory
        target_uid=$(stat -c '%u' "$postgres_data_dir/base" 2>/dev/null || echo "999")
        target_gid=$(stat -c '%g' "$postgres_data_dir/base" 2>/dev/null || echo "999")
        info "Detected existing PostgreSQL UID from data: $target_uid:$target_gid"
    else
        info "No existing data - will use default UID: $target_uid:$target_gid (Alpine Linux)"
    fi

    # Create directory if doesn't exist
    if [[ ! -d "$postgres_data_dir" ]]; then
        info "Creating PostgreSQL data directory..."
        if sudo mkdir -p "$postgres_data_dir"; then
            # Set ownership to detected/default postgres user
            sudo chown $target_uid:$target_gid "$postgres_data_dir"
            sudo chmod 0700 "$postgres_data_dir"
            success "PostgreSQL data directory created with correct permissions ($target_uid:$target_gid)"
        else
            error "Failed to create PostgreSQL data directory"
            return 1
        fi
    else
        # Directory exists - verify/fix ownership RECURSIVELY
        info "Verifying PostgreSQL data directory permissions..."
        local current_owner=$(stat -c '%u:%g' "$postgres_data_dir" 2>/dev/null || echo "unknown")

        if [[ "$current_owner" != "$target_uid:$target_gid" ]]; then
            warning "Incorrect ownership: $current_owner (expected $target_uid:$target_gid)"
            info "Fixing ownership recursively (including all subdirectories)..."
            if sudo chown -R $target_uid:$target_gid "$postgres_data_dir"; then
                success "Ownership corrected to $target_uid:$target_gid (recursive)"
            else
                error "Failed to fix ownership"
                return 1
            fi
        else
            # Even if parent ownership is correct, ensure ALL subdirectories match
            info "Parent directory ownership correct, verifying subdirectories..."
            if sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null; then
                success "PostgreSQL data directory permissions verified ($target_uid:$target_gid, recursive)"
            else
                warning "Failed to recursively verify ownership (continuing anyway)"
            fi
        fi
    fi

    return 0
}

# Full cleanup - containers + networks + volumes (DELETES DATA!)
cleanup_full() {
    warning "Full cleanup will DELETE ALL DATA including database!"
    echo ""

    # Check for root privileges (required for PostgreSQL data deletion)
    if ! check_root_privileges; then
        error "Full cleanup requires root privileges to delete PostgreSQL data!"
        echo ""
        echo "Please run deploy.sh with sudo:"
        echo "  sudo $SCRIPT_DIR/deploy.sh [OPTIONS]"
        echo ""
        echo "Or manually delete PostgreSQL data after deployment:"
        echo "  sudo rm -rf $DEPLOY_DIR/data/postgres/*"
        echo ""
        exit 1
    fi

    read -p "Type 'DELETE' to confirm full cleanup: " confirm
    echo ""

    if [[ "$confirm" != "DELETE" ]]; then
        info "Full cleanup cancelled"
        return 0
    fi

    info "Performing full cleanup..."

    # Stop and remove containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Stopping containers..."
        echo "$containers" | xargs docker stop >> "$LOG_FILE" 2>&1 || true
        info "Removing containers..."
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing networks..."
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove volumes
    local volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$volumes" ]]; then
        warning "Removing volumes (DATA DELETION)..."
        echo "$volumes" | xargs docker volume rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove data directories
    if [[ -d "$DEPLOY_DIR/data/postgres" ]]; then
        warning "Removing PostgreSQL data directory..."
        if ! sudo rm -rf "$DEPLOY_DIR/data/postgres"/* >> "$LOG_FILE" 2>&1; then
            error "Failed to remove PostgreSQL data directory. Check sudo privileges."
        fi
    fi

    success "Full cleanup completed (ALL DATA DELETED)"
}

# Check and repair PostgreSQL data directory structure
check_and_repair_postgres_data() {
    local sync_mode="${1:-}"
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    # Skip integrity check if clean sync was used (everything will be recreated)
    if [[ "$sync_mode" == "clean" ]]; then
        info "Skipping PostgreSQL integrity check (clean sync mode - will be initialized fresh)"
        return 0
    fi

    # Skip if data directory doesn't exist or is empty
    if [[ ! -d "$postgres_data_dir" ]] || [[ -z "$(ls -A "$postgres_data_dir" 2>/dev/null)" ]]; then
        info "PostgreSQL data directory is empty or doesn't exist - will be initialized by container"
        return 0
    fi

    # Check if this is a PostgreSQL data directory
    if [[ ! -f "$postgres_data_dir/PG_VERSION" ]]; then
        info "No PG_VERSION found - not a PostgreSQL data directory"
        return 0
    fi

    step "Checking PostgreSQL data directory integrity..."

    # List of required system directories for PostgreSQL 16
    # Including subdirectories that must exist for proper operation
    local required_dirs=(
        "pg_commit_ts"
        "pg_dynshmem"
        "pg_notify"
        "pg_replslot"
        "pg_serial"
        "pg_snapshots"
        "pg_stat"
        "pg_stat_tmp"
        "pg_tblspc"
        "pg_twophase"
        "pg_logical/snapshots"
        "pg_logical/mappings"
    )

    local missing_dirs=()
    local needs_repair=false

    # Check each required directory
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$postgres_data_dir/$dir" ]]; then
            missing_dirs+=("$dir")
            needs_repair=true
        fi
    done

    # If all directories present, no repair needed
    if [[ "$needs_repair" == "false" ]]; then
        success "PostgreSQL data directory structure is valid"
        return 0
    fi

    # Report missing directories
    warning "PostgreSQL data directory is corrupted!"
    warning "Missing ${#missing_dirs[@]} system directories:"
    for dir in "${missing_dirs[@]}"; do
        echo "  ✗ $dir"
    done
    echo ""

    # Create backup before any modifications
    info "Creating backup before modifications..."
    local backup_file="$HOME/postgres_data_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    if sudo tar -czf "$backup_file" -C "$DEPLOY_DIR/data" postgres/ 2>/dev/null; then
        success "Backup created: $backup_file"
    else
        warning "Failed to create backup (continuing anyway)"
    fi
    echo ""

    # If severely corrupted (missing 50%+ directories), better to recreate
    local total_dirs=${#required_dirs[@]}
    local missing_count=${#missing_dirs[@]}
    local corruption_percent=$((missing_count * 100 / total_dirs))

    if [[ $corruption_percent -ge 50 ]]; then
        warning "Corruption level: $corruption_percent% ($missing_count of $total_dirs directories missing)"
        warning "Directory is severely corrupted - recreation recommended"
        echo ""

        # Check if there's any real user data worth preserving
        local has_user_data=false
        if [[ -d "$postgres_data_dir/base" ]] && [[ -n "$(ls -A "$postgres_data_dir/base" 2>/dev/null)" ]]; then
            has_user_data=true
        fi

        if [[ "$has_user_data" == "false" ]]; then
            info "No user databases found - safe to recreate"
            info "Deleting corrupted directory and allowing PostgreSQL to initialize fresh..."
            echo ""

            # Delete corrupted directory
            if sudo rm -rf "$postgres_data_dir"/* 2>/dev/null; then
                success "Corrupted directory deleted"
                info "PostgreSQL will initialize clean structure on first start"
                return 0
            else
                error "Failed to delete corrupted directory"
                return 1
            fi
        else
            warning "User databases detected - attempting repair to preserve data..."
            echo ""
        fi
    fi

    # Automatically repair (for minor corruption or when user data exists)
    info "Attempting to repair PostgreSQL data directory structure..."
    echo ""

    # Detect existing UID from data to ensure consistency
    local target_uid=999
    local target_gid=999
    if [[ -d "$postgres_data_dir/base" ]]; then
        target_uid=$(stat -c '%u' "$postgres_data_dir/base" 2>/dev/null || echo "999")
        target_gid=$(stat -c '%g' "$postgres_data_dir/base" 2>/dev/null || echo "999")
        info "Detected existing PostgreSQL UID: $target_uid:$target_gid"
    fi
    echo ""

    # Create missing directories with correct ownership and permissions
    local repaired=0
    for dir in "${missing_dirs[@]}"; do
        local dir_path="$postgres_data_dir/$dir"

        info "Creating: $dir"

        if sudo mkdir -p "$dir_path" 2>/dev/null; then
            # Set ownership to detected postgres user UID
            sudo chown $target_uid:$target_gid "$dir_path" 2>/dev/null

            # Set permissions to 0700 (drwx------)
            sudo chmod 0700 "$dir_path" 2>/dev/null

            success "  ✓ Created and configured: $dir"
            repaired=$((repaired + 1))
        else
            error "  ✗ Failed to create: $dir"
            return 1
        fi
    done

    echo ""
    success "PostgreSQL data directory repaired: $repaired directories created"
    info "PostgreSQL will initialize these directories on startup"
    echo ""

    # Verify ownership of all directories to ensure consistency
    info "Verifying ownership of all PostgreSQL directories..."
    if sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null; then
        success "All directories have correct ownership ($target_uid:$target_gid)"
    else
        warning "Failed to set ownership on some directories (continuing anyway)"
    fi

    return 0
}

# Check for old deployments and offer cleanup options
cleanup_old_deployment() {
    step "Checking for Old Deployments"

    # Count old artifacts
    local old_containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null | wc -l)
    local old_networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)
    local old_volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)

    # If nothing found, skip
    if [[ $old_containers -eq 0 && $old_networks -eq 0 && $old_volumes -eq 0 ]]; then
        info "No old deployments found"
        return 0
    fi

    # Display findings
    warning "Found old deployment artifacts:"
    if [[ $old_containers -gt 0 ]]; then
        echo "  - Containers: $old_containers"
        docker ps -a --filter "name=familybudget" --format "    {{.Names}} ({{.Status}})" 2>/dev/null
    fi
    if [[ $old_networks -gt 0 ]]; then
        echo "  - Networks: $old_networks"
        docker network ls --filter "name=familybudget" --format "    {{.Name}}" 2>/dev/null
    fi
    if [[ $old_volumes -gt 0 ]]; then
        echo "  - Volumes: $old_volumes"
        docker volume ls --filter "name=familybudget" --format "    {{.Name}}" 2>/dev/null
    fi
    echo ""

    # Offer cleanup options
    warning "Old deployments may cause network conflicts!"
    echo "Choose cleanup action:"
    echo "  [1] Skip - deploy alongside old deployment (may cause subnet conflicts)"
    echo "  [2] Safe cleanup - stop & remove containers + networks (KEEPS data)"
    echo "  [3] Selective restart - restart only app services (KEEPS PostgreSQL running)"
    echo "      ✓ Use for frontend/backend/bot updates"
    echo "      ✓ Prevents PostgreSQL corruption from improper shutdown"
    echo "  [4] Full cleanup - containers + networks + volumes (DELETES ALL DATA!)"
    echo "      ⚠️  Requires sudo/root privileges"
    echo ""

    read -p "Select [1-4]: " choice
    echo ""

    case $choice in
        1)
            info "Skipping cleanup (network conflicts may occur)"
            return 0
            ;;
        2)
            cleanup_containers_networks
            ;;
        3)
            cleanup_selective
            ;;
        4)
            cleanup_full
            ;;
        *)
            error "Invalid choice. Please select 1-4."
            ;;
    esac
}

# Find free subnets in range 172.20-172.30
# Check if port is available
check_port_available() {
    local port=$1
    local service_name=$2

    # Check if port is in use
    local process_info=""
    if command_exists lsof; then
        process_info=$(sudo lsof -i :"$port" -t 2>/dev/null || true)
    elif command_exists netstat; then
        process_info=$(sudo netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' || true)
    else
        warning "Cannot check port availability (lsof/netstat not found)"
        return 0
    fi

    if [[ -n "$process_info" ]]; then
        warning "Port $port is already in use!"
        echo ""
        echo "Process using port $port:"
        if command_exists lsof; then
            sudo lsof -i :"$port" 2>/dev/null || true
        else
            sudo netstat -tulpn 2>/dev/null | grep ":$port " || true
        fi
        echo ""

        # Detect if process is certbot
        local process_name=""
        local is_certbot=false

        if command_exists lsof; then
            # Get process name from lsof output
            process_name=$(sudo lsof -i :"$port" 2>/dev/null | grep -v "COMMAND" | awk '{print $1}' | head -1 || true)
        fi

        if [[ "$process_name" == "certbot" ]] || sudo lsof -i :"$port" 2>/dev/null | grep -q certbot; then
            is_certbot=true
        fi

        # Special handling for certbot
        if [[ "$is_certbot" == "true" ]]; then
            warning "ОБНАРУЖЕН CERTBOT НА ХОСТЕ!"
            echo ""
            info "Проверка systemd сервисов certbot..."
            echo ""

            # Check certbot.service status
            if systemctl is-active --quiet certbot.service 2>/dev/null; then
                echo "  certbot.service: ${GREEN}active${NC}"
            else
                echo "  certbot.service: inactive"
            fi

            # Check certbot.timer status
            if systemctl is-active --quiet certbot.timer 2>/dev/null; then
                echo "  certbot.timer: ${GREEN}active${NC}"
            else
                echo "  certbot.timer: inactive"
            fi

            echo ""
            warning "ВАЖНО: Этот деплой использует контейнеризованный certbot."
            warning "Host certbot конфликтует с портом $port, необходимым для nginx/SSL."
            echo ""
            info "Рекомендация: Остановить host certbot и использовать контейнерную версию."
            echo ""
            echo "Опции:"
            echo "  [1] Остановить host certbot (временно) и продолжить деплой (рекомендуется)"
            echo "  [2] Отключить host certbot навсегда и продолжить"
            echo "  [3] Отменить деплой"
            echo ""

            read -p "Выберите [1-3]: " choice
            echo ""

            case $choice in
                1)
                    info "Остановка certbot.service и certbot.timer..."
                    sudo systemctl stop certbot.service 2>/dev/null || true
                    sudo systemctl stop certbot.timer 2>/dev/null || true
                    sleep 2

                    # Verify port is free
                    if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                        warning "systemctl stop не освободил порт. Процесс certbot запущен вне systemd."
                        echo ""

                        # Get PIDs still holding the port
                        local remaining_pids=$(sudo lsof -i :"$port" -t 2>/dev/null || true)

                        if [[ -n "$remaining_pids" ]]; then
                            info "Попытка завершить процесс certbot (PID: $remaining_pids)..."

                            # Try graceful SIGTERM first
                            sudo kill -TERM $remaining_pids 2>/dev/null || true
                            sleep 3

                            # Check if still running
                            if sudo lsof -i :"$port" >/dev/null 2>&1; then
                                warning "Процесс не завершился. Принудительное завершение (SIGKILL)..."
                                sudo kill -9 $remaining_pids 2>/dev/null || true
                                sleep 2
                            fi

                            # Final verification
                            if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                                error "Не удалось освободить порт $port. Процесс certbot всё ещё запущен. Попробуйте вручную: sudo kill -9 $remaining_pids"
                            else
                                success "Host certbot остановлен."
                                info "Контейнеризованный certbot возьмёт на себя управление SSL сертификатами."
                                echo ""
                                warning "ПРИМЕЧАНИЕ: certbot.timer может автоматически запуститься при следующей перезагрузке."
                                info "Для постоянного отключения выберите опцию [2] при следующем деплое."
                            fi
                        fi
                    else
                        success "Host certbot остановлен."
                        info "Контейнеризованный certbot возьмёт на себя управление SSL сертификатами."
                        echo ""
                        warning "ПРИМЕЧАНИЕ: certbot.timer может автоматически запуститься при следующей перезагрузке."
                        info "Для постоянного отключения выберите опцию [2] при следующем деплое."
                    fi
                    ;;
                2)
                    info "Отключение certbot.service и certbot.timer навсегда..."
                    sudo systemctl stop certbot.service 2>/dev/null || true
                    sudo systemctl stop certbot.timer 2>/dev/null || true
                    sudo systemctl disable certbot.service 2>/dev/null || true
                    sudo systemctl disable certbot.timer 2>/dev/null || true
                    sleep 2

                    # Verify port is free
                    if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                        warning "systemctl stop не освободил порт. Процесс certbot запущен вне systemd."
                        echo ""

                        # Get PIDs still holding the port
                        local remaining_pids=$(sudo lsof -i :"$port" -t 2>/dev/null || true)

                        if [[ -n "$remaining_pids" ]]; then
                            info "Попытка завершить процесс certbot (PID: $remaining_pids)..."

                            # Try graceful SIGTERM first
                            sudo kill -TERM $remaining_pids 2>/dev/null || true
                            sleep 3

                            # Check if still running
                            if sudo lsof -i :"$port" >/dev/null 2>&1; then
                                warning "Процесс не завершился. Принудительное завершение (SIGKILL)..."
                                sudo kill -9 $remaining_pids 2>/dev/null || true
                                sleep 2
                            fi

                            # Final verification
                            if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                                error "Не удалось освободить порт $port. Процесс certbot всё ещё запущен. Попробуйте вручную: sudo kill -9 $remaining_pids"
                            else
                                success "Host certbot отключён навсегда."
                                info "Контейнеризованный certbot будет управлять SSL сертификатами."
                            fi
                        fi
                    else
                        success "Host certbot отключён навсегда."
                        info "Контейнеризованный certbot будет управлять SSL сертификатами."
                    fi
                    ;;
                3)
                    error "Деплой отменён пользователем"
                    ;;
                *)
                    error "Неверный выбор"
                    ;;
            esac
        else
            # Standard handling for non-certbot processes
            warning "This will prevent $service_name from starting."
            echo ""
            echo "Опции:"
            echo "  [1] Остановить процесс и продолжить"
            echo "  [2] Изменить порт в .env файле"
            echo "  [3] Отменить деплой"
            echo ""

            read -p "Выберите [1-3]: " choice
            echo ""

            case $choice in
                1)
                    info "Попытка остановить процесс на порту $port..."
                    if [[ -n "$process_info" ]]; then
                        sudo kill -9 $process_info 2>/dev/null || true
                        sleep 2

                        # Verify port is free
                        if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                            error "Не удалось освободить порт $port. Пожалуйста, остановите процесс вручную."
                        else
                            success "Порт $port теперь свободен"
                        fi
                    fi
                    ;;
                2)
                    error "Пожалуйста, отредактируйте $DEPLOY_DIR/.env и измените ${service_name}_PORT, затем запустите deploy.sh снова"
                    ;;
                3)
                    error "Деплой отменён"
                    ;;
                *)
                    error "Неверный выбор"
                    ;;
            esac
        fi
    fi
}

# Helper function to run docker compose with all override files
compose_cmd() {
    local compose_files="-f docker-compose.yml"

    # PostgreSQL port 5432 is exposed in docker-compose.yml
    # Access is controlled by UFW firewall (configured in setup.sh)

    # Change to deployment directory and execute docker compose with all override files
    # --profile full: Start ALL services including nginx and bot (they have profiles: [full] in docker-compose.yml)
    (cd "$DEPLOY_DIR" && docker compose --profile full $compose_files "$@")
}

# =============================================================================
# DEPLOYMENT FUNCTIONS
# =============================================================================

# Note: Image building is now handled automatically by 'docker compose up --build'
# which rebuilds only changed images using Docker's layer cache for speed

# Stop existing services
stop_services() {
    info "Checking for running services..."

    local running_containers
    running_containers=$(compose_cmd ps -q 2>/dev/null || echo "")

    if [[ -n "$running_containers" ]]; then
        warning "Found running services, stopping..."

        if compose_cmd down >> "$LOG_FILE" 2>&1; then
            success "Services stopped"
        else
            warning "Failed to stop some services (continuing anyway)"
        fi
    else
        info "No running services found"
    fi
}

# Clean deployment (remove volumes)
clean_deployment() {
    if [[ "$CLEAN_DEPLOY" == "true" ]]; then
        warning "Clean deployment requested - this will DELETE ALL DATA!"
        echo ""
        read -p "Are you sure you want to delete all data? (type 'yes' to confirm): " -r
        echo ""

        if [[ "$REPLY" == "yes" ]]; then
            step "Removing volumes and data..."

            # Stop services
            compose_cmd down >> "$LOG_FILE" 2>&1 || true

            # Remove volumes
            if compose_cmd down -v >> "$LOG_FILE" 2>&1; then
                success "Volumes removed"
            else
                warning "Failed to remove some volumes"
            fi

            # Remove data directories
            if [[ -d "$DEPLOY_DIR/data/postgres" ]]; then
                warning "Removing PostgreSQL data directory..."
                if ! sudo rm -rf "$DEPLOY_DIR/data/postgres"/* >> "$LOG_FILE" 2>&1; then
                    error "Failed to remove PostgreSQL data directory. Check sudo privileges."
                fi
            fi
        else
            info "Clean deployment cancelled"
            CLEAN_DEPLOY=false
        fi
    fi
}

# Start services
start_services() {
    step "Starting services..."

    local compose_args=""
    if [[ -n "$COMPOSE_PROFILE" ]]; then
        compose_args="--profile $COMPOSE_PROFILE"
    fi

    local detach_flag=""
    if [[ "$DETACH_MODE" == "true" ]]; then
        detach_flag="-d"
    fi

    # Add --build flag to automatically rebuild images if code changed
    # Docker will use cache and skip rebuild if nothing changed
    local build_flag="--build"

    info "Running: docker compose $compose_args up $detach_flag $build_flag"
    info "Note: Docker will rebuild only changed images (uses cache for unchanged layers)"

    if compose_cmd $compose_args up $detach_flag $build_flag >> "$LOG_FILE" 2>&1; then
        success "Services started"
    else
        error "Failed to start services. Check $LOG_FILE for details."
    fi
}

# Wait for service to be healthy
wait_for_service() {
    local service_name=$1
    local max_wait=$2
    local elapsed=0

    info "Waiting for $service_name to be healthy (max ${max_wait}s)..."

    while [[ $elapsed -lt $max_wait ]]; do
        local health_status
        health_status=$(compose_cmd ps -q "$service_name" 2>/dev/null | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

        case "$health_status" in
            "healthy")
                success "$service_name is healthy"
                return 0
                ;;
            "starting")
                echo -n "."
                ;;
            "unhealthy")
                error "$service_name is unhealthy. Check logs: docker compose logs $service_name"
                ;;
            "none")
                # Service has no health check, check if it's running
                local running_status
                running_status=$(compose_cmd ps -q "$service_name" 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not_running")

                if [[ "$running_status" == "running" ]]; then
                    success "$service_name is running (no health check)"
                    return 0
                else
                    echo -n "."
                fi
                ;;
            *)
                echo -n "."
                ;;
        esac

        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
    done

    error "$service_name failed to become healthy within ${max_wait}s"
}

# Wait for all services
wait_for_services() {
    step "Waiting for services to become healthy..."

    # Get list of running services
    local services
    services=$(compose_cmd ps --services 2>/dev/null || echo "")

    if [[ -z "$services" ]]; then
        error "No services found. Deployment may have failed."
    fi

    # Wait for each service
    for service in $services; do
        wait_for_service "$service" "$MAX_WAIT_TIME"
    done

    echo ""
    success "All services are healthy"
}

# Run database migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        step "Running database migrations..."

        # Check if postgres service is healthy
        if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
            error "PostgreSQL service is not healthy, cannot run migrations"
            return 1
        fi

        # Check if migrations directory exists
        if [[ ! -d "$DEPLOY_DIR/backend/db/migrations" ]]; then
            error "Migrations directory not found: $DEPLOY_DIR/backend/db/migrations"
            info "This may indicate incomplete setup. Run ./setup.sh to copy files."
            return 1
        fi

        # Count migration files
        local migration_count=$(find "$DEPLOY_DIR/backend/db/migrations" -name "*.sql" -type f | wc -l)
        info "Found $migration_count SQL migration files"

        if [[ $migration_count -eq 0 ]]; then
            warning "No migration files found, skipping"
            return 0
        fi

        # Wait for PostgreSQL to be fully ready (beyond health check)
        info "Waiting for PostgreSQL to accept connections..."
        local max_attempts=30
        local attempt=0
        while [[ $attempt -lt $max_attempts ]]; do
            if compose_cmd exec -T postgres pg_isready -U familybudget -d familybudget >/dev/null 2>&1; then
                success "PostgreSQL is ready"
                break
            fi
            attempt=$((attempt + 1))
            if [[ $attempt -eq $max_attempts ]]; then
                error "PostgreSQL did not become ready in time"
                return 1
            fi
            sleep 1
        done

        # Run migrations using run_migrations.sh if it exists
        if [[ -f "$DEPLOY_DIR/backend/db/run_migrations.sh" ]]; then
            info "Running migrations using run_migrations.sh..."

            # Make script executable
            chmod +x "$DEPLOY_DIR/backend/db/run_migrations.sh"

            # Run migrations inside postgres container
            if compose_cmd exec -T postgres bash -c "cd /docker-entrypoint-initdb.d && bash run_migrations.sh" >> "$LOG_FILE" 2>&1; then
                success "Database migrations completed"
            else
                warning "run_migrations.sh failed, trying direct SQL execution..."
                # Fallback: apply migrations directly
                apply_migrations_directly
            fi
        else
            # Direct SQL execution
            info "run_migrations.sh not found, applying migrations directly..."
            apply_migrations_directly
        fi

        # Verify critical tables exist
        verify_database_schema
    else
        info "Skipping database migrations (--no-migrate specified)"
    fi
}

# Apply SQL migrations directly to database
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

# Clean up old nginx configuration markers (from previous deployments)
cleanup_nginx_markers() {
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/app.conf"

    # Check if nginx config exists
    if [[ ! -f "$nginx_conf" ]]; then
        # No config yet, nothing to clean
        return 0
    fi

    # Check if file contains old markers (from previous deployments)
    if grep -q "^SSL_HTTPS_START$\|^SSL_HTTPS_END$\|^SSL_REDIRECT_START$\|^SSL_REDIRECT_END$" "$nginx_conf"; then
        info "Detected old SSL markers in nginx config, cleaning up..."

        # Remove marker lines (they should have been removed by update_nginx_for_https)
        sed -i '/^SSL_HTTPS_START$/d' "$nginx_conf"
        sed -i '/^SSL_HTTPS_END$/d' "$nginx_conf"
        sed -i '/^SSL_REDIRECT_START$/d' "$nginx_conf"
        sed -i '/^SSL_REDIRECT_END$/d' "$nginx_conf"

        success "Old SSL markers removed from nginx config"
        info "Configuration file: $nginx_conf"
    fi
}

# =============================================================================
# SSL CERTIFICATE FUNCTIONS
# =============================================================================

# Setup SSL certificates with Let's Encrypt (using host certbot)
setup_ssl_certificates() {
    # Source .env to check SSL_TYPE
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    # Skip if SSL is not letsencrypt
    if [[ "$ssl_type" != "letsencrypt" ]]; then
        info "SSL type is '$ssl_type' - skipping certificate setup"
        return 0
    fi

    # Skip if domain is localhost
    if [[ "$domain" == "localhost" ]]; then
        info "Domain is localhost - skipping SSL certificate setup"
        return 0
    fi

    step "Setting up SSL certificate for $domain..."

    # Check if ssl_certificate_manager.sh exists
    local ssl_manager="$DEPLOY_DIR/scripts/ssl_certificate_manager.sh"
    if [[ ! -f "$ssl_manager" ]]; then
        error "SSL certificate manager script not found: $ssl_manager"
    fi

    # Get Let's Encrypt email
    local email="${LETSENCRYPT_EMAIL:-}"
    if [[ -z "$email" ]]; then
        error "LETSENCRYPT_EMAIL is not set in .env file"
    fi

    # Get server IP (try to detect automatically)
    local server_ip="${SERVER_IP:-}"
    if [[ -z "$server_ip" ]]; then
        # Try to detect public IP
        server_ip=$(curl -s ifconfig.me 2>/dev/null || echo "")
        if [[ -z "$server_ip" ]]; then
            error "SERVER_IP not set in .env and auto-detection failed. Please set SERVER_IP in .env file."
        fi
        info "Auto-detected server IP: $server_ip"
    fi

    # Check if certificate already exists
    if [ -d "/etc/letsencrypt/live/$domain" ]; then
        success "SSL certificate already exists for $domain"

        # Validate certificate
        if sudo "$ssl_manager" check "$domain" >> "$LOG_FILE" 2>&1; then
            info "Certificate is valid"

            # Update nginx configuration to enable HTTPS if not already done
            update_nginx_for_https "$domain"

            # Reload nginx to pick up certificates
            if compose_cmd ps -q nginx >/dev/null 2>&1; then
                info "Reloading nginx with certificates..."
                if compose_cmd exec nginx nginx -s reload >> "$LOG_FILE" 2>&1; then
                    success "Nginx reloaded successfully"
                else
                    warning "Failed to reload nginx"
                fi
            fi

            return 0
        else
            warning "Certificate validation failed, will obtain new certificate"
        fi
    fi

    # Obtain new certificate using ssl_certificate_manager.sh
    info "Obtaining SSL certificate from Let's Encrypt (host certbot)..."
    info "Domain: $domain"
    info "Email: $email"
    info "Server IP: $server_ip"
    echo ""

    if sudo "$ssl_manager" obtain "$domain" "$email" "$server_ip" >> "$LOG_FILE" 2>&1; then
        success "SSL certificate obtained successfully!"

        # Update nginx configuration to enable HTTPS
        update_nginx_for_https "$domain"

        # Start nginx if not running (may have been stopped by ssl_certificate_manager)
        if ! compose_cmd ps -q nginx >/dev/null 2>&1; then
            info "Starting nginx..."
            compose_cmd start nginx >> "$LOG_FILE" 2>&1 || true
            sleep 3
        fi

        # Reload nginx with new configuration
        info "Reloading nginx with new configuration..."
        if compose_cmd exec nginx nginx -s reload >> "$LOG_FILE" 2>&1; then
            success "Nginx reloaded successfully"
        else
            warning "Failed to reload nginx. Restarting..."
            compose_cmd restart nginx >> "$LOG_FILE" 2>&1 || true
        fi

        success "SSL certificate setup completed!"
    else
        error "Failed to obtain SSL certificate. Check $LOG_FILE for details."
    fi
}

# Update nginx configuration to enable HTTPS
update_nginx_for_https() {
    local domain=$1
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/app.conf"

    if [[ ! -f "$nginx_conf" ]]; then
        error "Nginx configuration not found: $nginx_conf"
    fi

    info "Updating nginx configuration to enable HTTPS..."

    # Create backup before modification
    cp "$nginx_conf" "$nginx_conf.backup" || true

    # Check if markers exist
    if ! grep -q "SSL_HTTPS_START" "$nginx_conf"; then
        warning "SSL markers not found in nginx config - configuration may already be updated"
        return 0
    fi

    info "Processing nginx configuration using SSL markers..."

    # Uncomment HTTPS block (between SSL_HTTPS_START and SSL_HTTPS_END)
    # This removes "# " from the beginning of lines, but preserves "# #" comments
    sed -i '/^# SSL_HTTPS_START$/,/^# SSL_HTTPS_END$/{
        /^# SSL_HTTPS_START$/d
        /^# SSL_HTTPS_END$/d
        s/^# \(.*\)/\1/
    }' "$nginx_conf"

    # Uncomment HTTP redirect block (between SSL_REDIRECT_START and SSL_REDIRECT_END)
    sed -i '/^# SSL_REDIRECT_START$/,/^# SSL_REDIRECT_END$/{
        /^# SSL_REDIRECT_START$/d
        /^# SSL_REDIRECT_END$/d
        s/^# \(.*\)/\1/
    }' "$nginx_conf"

    # Comment out initial HTTP block (between SSL_HTTP_INITIAL_START and SSL_HTTP_INITIAL_END)
    # to prevent conflicting server names after enabling SSL redirect
    sed -i '/^# SSL_HTTP_INITIAL_START$/,/^# SSL_HTTP_INITIAL_END$/{
        /^# SSL_HTTP_INITIAL_START$/d
        /^# SSL_HTTP_INITIAL_END$/d
        s/^\([^#]\)/# \1/
    }' "$nginx_conf"

    # Verify the result is not empty
    if [[ ! -s "$nginx_conf" ]]; then
        error "Nginx configuration became empty after processing"
        mv "$nginx_conf.backup" "$nginx_conf" 2>/dev/null || true
        return 1
    fi

    # Validate nginx configuration (if container is running)
    if compose_cmd ps -q nginx >/dev/null 2>&1 && compose_cmd ps nginx | grep -q "Up"; then
        info "Validating nginx configuration..."
        if compose_cmd exec nginx nginx -t >> "$LOG_FILE" 2>&1; then
            success "Nginx configuration is valid"
            # Remove backup on success
            rm -f "$nginx_conf.backup"
        else
            error "Nginx configuration is invalid after update"
            warning "Restoring previous configuration..."
            mv "$nginx_conf.backup" "$nginx_conf" 2>/dev/null || true
            error "Configuration validation failed. Check $LOG_FILE for details."
        fi
    else
        info "Nginx container not running, skipping validation (will be validated on start)"
        # Still remove backup
        rm -f "$nginx_conf.backup"
    fi

    success "Nginx configuration updated for HTTPS"
    info "Configuration file: $nginx_conf"
}

# Verify SSL certificate
verify_ssl() {
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    if [[ "$ssl_type" != "letsencrypt" || "$domain" == "localhost" ]]; then
        return 0
    fi

    step "Verifying SSL certificate..."

    # Check certificate file exists (now on host system)
    local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
    if [[ ! -f "$cert_path" ]]; then
        warning "Certificate file not found: $cert_path"
        return 0
    fi

    # Check certificate expiry
    if command_exists openssl; then
        local expiry_date
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
        info "Certificate expires: $expiry_date"
    fi

    # Test HTTPS connectivity
    info "Testing HTTPS connectivity..."
    if command_exists curl; then
        if curl -Is --max-time 10 "https://$domain/health" >/dev/null 2>&1; then
            success "HTTPS is working correctly!"
            info "URL: https://$domain"
            # Set global variable for close_http_port() function
            export HTTPS_WORKING="true"
        else
            warning "HTTPS test failed. Certificate may need time to propagate."
            info "Try accessing: https://$domain in a few minutes"
            # Set global variable for close_http_port() function
            export HTTPS_WORKING="false"
        fi
    else
        info "curl not available - skipping HTTPS test"
        # Cannot verify, assume HTTPS not working
        export HTTPS_WORKING="false"
    fi
}

# =============================================================================
# BACKUP CRON JOB SETUP
# =============================================================================

# Setup automatic daily backups via cron
setup_backup_cron() {
    step "Setting up automatic backups..."

    # Check if cron is installed
    if ! command_exists crontab; then
        warning "cron not installed"
        info "Installing cron package..."

        # Try to install cron automatically
        if sudo apt-get update >> "$LOG_FILE" 2>&1 && \
           sudo apt-get install -y cron >> "$LOG_FILE" 2>&1; then
            success "cron installed successfully"

            # Enable and start cron service
            if sudo systemctl enable cron >> "$LOG_FILE" 2>&1; then
                info "cron service enabled"
            fi

            if sudo systemctl start cron >> "$LOG_FILE" 2>&1; then
                success "cron service started"
            fi
        else
            warning "Failed to install cron automatically"
            info "Install manually with: sudo apt-get install cron"
            info "Then run deploy.sh again to setup backup cron job"
            return 0
        fi
    fi

    # Create log directory for cron logs
    local log_dir="/var/log/familybudget"
    if [[ ! -d "$log_dir" ]]; then
        info "Creating log directory: $log_dir"
        if sudo mkdir -p "$log_dir" >> "$LOG_FILE" 2>&1; then
            sudo chown ${USER}:${USER} "$log_dir" >> "$LOG_FILE" 2>&1 || true
            sudo chmod 755 "$log_dir" >> "$LOG_FILE" 2>&1 || true
            success "Log directory created: $log_dir"
        else
            warning "Failed to create log directory (continuing anyway)"
        fi
    fi

    # Prepare cron file with correct project path
    local cron_source="${DEPLOY_DIR}/scripts/cron/familybudget-backup.cron"
    local cron_dest="/etc/cron.d/familybudget-backup"

    if [[ ! -f "$cron_source" ]]; then
        warning "Cron template not found: $cron_source"
        info "Skipping backup cron setup"
        return 0
    fi

    # Replace /opt/familybudget with actual DEPLOY_DIR
    info "Installing cron job to: $cron_dest"

    # Create temporary file with updated path
    local temp_cron="/tmp/familybudget-backup.cron.tmp"
    sed "s|/opt/familybudget|${DEPLOY_DIR}|g" "$cron_source" > "$temp_cron"

    # Copy to /etc/cron.d/ (requires sudo)
    if sudo cp "$temp_cron" "$cron_dest" >> "$LOG_FILE" 2>&1; then
        sudo chmod 644 "$cron_dest" >> "$LOG_FILE" 2>&1
        sudo chown root:root "$cron_dest" >> "$LOG_FILE" 2>&1
        rm -f "$temp_cron"

        success "Backup cron job installed"
        info "Schedule: Daily at 2:00 AM"
        info "Logs: $log_dir/cron.log"
        info "Backup logs: ${DEPLOY_DIR}/backups/logs/"

        # Check if S3 is configured
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a

        if [[ -n "${S3_BUCKET_NAME:-}" && -n "${AWS_ACCESS_KEY_ID:-}" ]]; then
            info "S3 uploads: Weekly on Sundays to s3://${S3_BUCKET_NAME}/"
        else
            warning "S3 not configured - backups will be local only"
            info "To enable S3: Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME in .env"
        fi

        # Display cron job
        info "Installed cron job:"
        sudo cat "$cron_dest" | grep -v "^#" | grep -v "^$" | tail -1 | sed 's/^/  /' || true

    else
        warning "Failed to install cron job (requires sudo)"
        info "You can manually install with:"
        echo "  sudo cp $cron_source $cron_dest"
        echo "  sudo chmod 644 $cron_dest"
        rm -f "$temp_cron"
    fi
}

# =============================================================================
# FIREWALL MANAGEMENT FOR SSL
# =============================================================================

# Check and open firewall ports for SSL
configure_firewall_for_ssl() {
    # Source .env to check SSL_TYPE and DOMAIN
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    # Skip if no SSL or localhost
    if [[ "$ssl_type" == "none" || "$domain" == "localhost" ]]; then
        info "No SSL configuration needed (type: $ssl_type, domain: $domain)"
        return 0
    fi

    step "Configuring firewall for SSL..."

    # Check if UFW is installed and active
    if ! command_exists ufw; then
        warning "UFW not installed, skipping firewall configuration"
        return 0
    fi

    if ! sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        warning "UFW is not active, skipping firewall configuration"
        return 0
    fi

    # Check current port status
    local port_80_status=$(sudo ufw status 2>/dev/null | grep "80/tcp" || echo "❌ not configured")
    local port_443_status=$(sudo ufw status 2>/dev/null | grep "443/tcp" || echo "❌ not configured")

    info "Current firewall status:"
    echo "  Port 80 (HTTP):   $port_80_status"
    echo "  Port 443 (HTTPS): $port_443_status"
    echo ""

    # IMPORTANT: Automatically open both ports 80 and 443
    # Port 80 is required for:
    # - Let's Encrypt ACME HTTP-01 challenge
    # - HTTP→HTTPS redirect from external sources
    # - Certificate auto-renewal
    # Port 443 is required for:
    # - HTTPS traffic
    info "Automatically opening ports 80 and 443 for SSL and HTTP→HTTPS redirect..."

    # Open port 80 (HTTP) - required for Let's Encrypt and redirect
    if ! sudo ufw status 2>/dev/null | grep -q "80/tcp.*ALLOW"; then
        sudo ufw allow 80/tcp comment 'HTTP for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 80 (HTTP) opened in firewall"
    else
        info "✓ Port 80 (HTTP) already open"
    fi

    # Open port 443 (HTTPS)
    if ! sudo ufw status 2>/dev/null | grep -q "443/tcp.*ALLOW"; then
        sudo ufw allow 443/tcp comment 'HTTPS for Family Budget' >> "$LOG_FILE" 2>&1 || true
        success "✓ Port 443 (HTTPS) opened in firewall"
    else
        info "✓ Port 443 (HTTPS) already open"
    fi

    echo ""
    success "Firewall configured for SSL: Ports 80 and 443 are open"
    info "This enables:"
    echo "  ✓ Let's Encrypt certificate issuance and renewal"
    echo "  ✓ HTTP→HTTPS automatic redirect"
    echo "  ✓ Secure HTTPS access"
}


# =============================================================================
# STATUS FUNCTIONS
# =============================================================================

# Get service status
get_service_status() {
    local service=$1

    local container_id
    container_id=$(compose_cmd ps -q "$service" 2>/dev/null || echo "")

    if [[ -z "$container_id" ]]; then
        echo "not_running"
        return
    fi

    local health_status
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "none")

    if [[ "$health_status" == "none" ]]; then
        local running_status
        running_status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "not_running")
        echo "$running_status"
    else
        echo "$health_status"
    fi
}

# Print deployment status
print_status() {
    echo ""
    echo "========================================================================"
    print_message "$GREEN" "           Family Budget - Deployment Status"
    echo "========================================================================"
    echo ""

    # Services status
    echo "Services:"
    local services
    services=$(compose_cmd ps --services 2>/dev/null || echo "")

    if [[ -z "$services" ]]; then
        print_message "$RED" "  ✗ No services running"
        return
    fi

    for service in $services; do
        local status
        status=$(get_service_status "$service")

        case "$status" in
            "healthy")
                print_message "$GREEN" "  ✓ $service: healthy"
                ;;
            "running")
                print_message "$GREEN" "  ✓ $service: running"
                ;;
            "starting")
                print_message "$YELLOW" "  ⏳ $service: starting"
                ;;
            "unhealthy")
                print_message "$RED" "  ✗ $service: unhealthy"
                ;;
            *)
                print_message "$RED" "  ✗ $service: $status"
                ;;
        esac
    done

    echo ""

    # Access URLs
    echo "Access URLs:"

    # Source .env to get ports
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local backend_port="${BACKEND_PORT:-8000}"
    local http_port="${HTTP_PORT:-80}"
    local https_port="${HTTPS_PORT:-443}"
    local domain="${DOMAIN:-localhost}"

    # Backend URL
    if compose_cmd ps -q backend >/dev/null 2>&1; then
        if [[ "$domain" == "localhost" ]]; then
            print_message "$CYAN" "  Backend:     http://localhost:$backend_port"
        else
            print_message "$CYAN" "  Backend:     http://$domain:$backend_port"
        fi
    fi

    # Nginx URLs
    if compose_cmd ps -q nginx >/dev/null 2>&1; then
        if [[ "$domain" == "localhost" ]]; then
            print_message "$CYAN" "  HTTP:        http://localhost:$http_port"
            if [[ "$https_port" != "443" ]]; then
                print_message "$CYAN" "  HTTPS:       https://localhost:$https_port"
            else
                print_message "$CYAN" "  HTTPS:       https://localhost"
            fi
        else
            print_message "$CYAN" "  HTTP:        http://$domain"
            print_message "$CYAN" "  HTTPS:       https://$domain"
        fi
    fi

    echo ""

    # Useful commands
    echo "Useful commands:"
    echo "  View logs:           docker compose logs -f"
    echo "  View service logs:   docker compose logs -f <service>"
    echo "  Restart service:     docker compose restart <service>"
    echo "  Stop all:            docker compose down"
    echo "  Service status:      docker compose ps"
    echo ""

    # Log file location
    echo "Logs: $LOG_FILE"
    echo "========================================================================"
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

    # LATE checks (after code sync): docker-compose.yml, directories
    check_prerequisites_late
    echo ""

    # Initialize PostgreSQL directory with correct permissions
    initialize_postgres_directory
    echo ""

    # Check for old deployments and cleanup if needed
    cleanup_old_deployment
    echo ""

    # Check and repair PostgreSQL data directory (skipped if clean sync was used)
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

        setup_backup_cron
        echo ""

        # Configure firewall before SSL certificate setup
        configure_firewall_for_ssl
        echo ""

        setup_ssl_certificates
        echo ""

        verify_ssl
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

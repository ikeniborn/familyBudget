#!/bin/bash
#
# utils.sh - Utility Functions
#
# This module provides core utility functions for the deployment script:
# - Logging functions (info, success, warning, error)
# - Command existence checks
# - Privilege checks
# - Docker compose wrapper
#
# Usage:
#   source scripts/lib/config.sh  # Must be sourced first
#   source scripts/lib/utils.sh
#
# Dependencies:
#   - config.sh (for LOG_FILE, color constants)
#

# =============================================================================
# LOGGING FUNCTIONS
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

# Print error message without exiting (allows caller to handle)
error_return() {
    print_message "$RED" "[ERROR] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*" >> "$LOG_FILE"
}

# Print step message (visual separator)
step() {
    print_message "$MAGENTA" "▶ $*"
}

# =============================================================================
# COMMAND CHECKS
# =============================================================================

# Check if command exists
# Usage: command_exists docker
# Returns: 0 if exists, 1 if not
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# =============================================================================
# PRIVILEGE CHECKS
# =============================================================================

# Check if running with root/sudo privileges
# Returns: 0 if root, 1 if not
check_root_privileges() {
    if [[ $EUID -ne 0 ]]; then
        return 1
    fi
    return 0
}

# =============================================================================
# POSTGRESQL HELPERS
# =============================================================================

# Check if PostgreSQL container is running
# Returns: 0 if running, 1 if not
is_postgres_running() {
    docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^familybudget-postgres$"
}

# Check if PostgreSQL container is healthy
# Returns: 0 if healthy, 1 if not
is_postgres_healthy() {
    local status=$(docker inspect --format='{{.State.Health.Status}}' familybudget-postgres 2>/dev/null || echo "none")
    [[ "$status" == "healthy" ]]
}

# =============================================================================
# DIRECTORY PREPARATION
# =============================================================================

# Prepare upload directories with correct permissions for backend container
# Creates /opt/budget/uploads and /opt/budget/uploads/temp with UID:GID 999:999
# This matches the 'appuser' in backend/Dockerfile (created by groupadd -r appuser && useradd -r -g appuser appuser)
#
# Why this is needed:
#   - Backend container runs as non-root user 'appuser' (UID=999, GID=999)
#   - docker-compose.yml mounts host directory ./uploads to container /app/uploads
#   - Host directory permissions override container internal permissions
#   - If host directory is root:root, backend cannot write files (PermissionError)
#
# Returns: 0 on success, 1 on failure
prepare_upload_directories() {
    local upload_dir="$DEPLOY_DIR/uploads"
    local temp_dir="$upload_dir/temp"
    local backend_uid=999  # appuser UID from backend/Dockerfile
    local backend_gid=999  # appuser GID from backend/Dockerfile

    # Create directories if they don't exist
    if [[ ! -d "$upload_dir" ]]; then
        info "Creating uploads directory: $upload_dir"
        mkdir -p "$upload_dir" || {
            error_return "Failed to create uploads directory"
            return 1
        }
    fi

    if [[ ! -d "$temp_dir" ]]; then
        info "Creating temp uploads directory: $temp_dir"
        mkdir -p "$temp_dir" || {
            error_return "Failed to create temp directory"
            return 1
        }
    fi

    # Set ownership to backend container user (appuser UID:GID 999:999)
    info "Setting ownership for uploads directory (UID:GID $backend_uid:$backend_gid)"
    chown -R "$backend_uid:$backend_gid" "$upload_dir" || {
        error_return "Failed to set ownership for uploads directory"
        return 1
    }

    # Set permissions (755 = rwxr-xr-x: owner can write, others can read/execute)
    chmod -R 755 "$upload_dir" || {
        error_return "Failed to set permissions for uploads directory"
        return 1
    }

    success "Upload directories prepared successfully"
    return 0
}

# =============================================================================
# DOCKER COMPOSE WRAPPER
# =============================================================================

# Helper function to run docker compose with all override files
# Usage: compose_cmd ps
#        compose_cmd up --build -d
# Note: Automatically changes to DEPLOY_DIR and uses --profile full
compose_cmd() {
    local compose_files="-f docker-compose.yml"

    # PostgreSQL port 5432 is exposed in docker-compose.yml
    # Access is controlled by UFW firewall (configured in setup.sh)

    # Change to deployment directory and execute docker compose with all override files
    # Profile is managed dynamically via start_services() through COMPOSE_PROFILE variable
    (cd "$DEPLOY_DIR" && docker compose $compose_files "$@")
}

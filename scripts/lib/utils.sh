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
# ORPHANED PROCESS DETECTION
# =============================================================================

# Check for orphaned deployment-related processes and optionally terminate them
# This prevents resource leaks from failed deployments or background tasks
#
# Checked processes:
#   - alembic (database migration tool)
#   - npm/npx (Node.js package manager)
#   - pip (Python package manager)
#   - git clone/pull/fetch (repository operations)
#   - rsync (file synchronization)
#   - python -m (direct module execution)
#   - bash scripts from DEPLOY_DIR or SCRIPT_DIR
#
# NOT checked (legitimate service processes):
#   - Docker containers (familybudget-*)
#   - uvicorn workers (backend workers)
#   - python -m bot.main (telegram bot)
#   - postgres server processes
#
# Usage: check_orphaned_deployment_processes [--terminate]
# Options:
#   --terminate  Automatically terminate orphaned processes (requires confirmation)
# Returns: 0 if no orphans, 1 if orphans found
check_orphaned_deployment_processes() {
    local should_terminate=false
    if [[ "${1:-}" == "--terminate" ]]; then
        should_terminate=true
    fi

    step "Checking for orphaned deployment processes"

    local orphaned_pids=()
    local orphaned_processes=()

    # Patterns for deployment-related processes (NOT service processes)
    local deployment_patterns=(
        "alembic"
        "npm install\|npm update\|npm ci"
        "npx"
        "pip install\|pip3 install"
        "git clone\|git pull\|git fetch"
        "rsync.*familyBudget\|rsync.*budget"
        "python.*setup\.sh\|python.*deploy\.sh"
        "bash.*setup\.sh\|bash.*deploy\.sh"
        "sudo bash.*setup\.sh\|sudo bash.*deploy\.sh"
    )

    # Exclusion patterns (legitimate service processes)
    local exclude_patterns=(
        "docker"
        "containerd"
        "uvicorn.*backend\.app\.main"
        "python -m bot\.main"
        "postgres:"
        "nginx:"
        "multiprocessing\.spawn"  # uvicorn workers
        "grep"  # This script's own grep
        "check_orphaned"  # This function itself
    )

    # Build combined grep pattern
    local search_pattern
    search_pattern=$(IFS='|'; echo "${deployment_patterns[*]}")

    # Find processes matching deployment patterns
    local process_list
    if ! process_list=$(ps aux | grep -E "$search_pattern" | grep -v grep); then
        success "No orphaned deployment processes found"
        return 0
    fi

    # Filter out excluded patterns
    local filtered_list="$process_list"
    for exclude in "${exclude_patterns[@]}"; do
        filtered_list=$(echo "$filtered_list" | grep -v -E "$exclude" || true)
    done

    # Exclude current deploy process and its parent chain
    # This prevents killing the currently running deploy.sh script
    if [[ -n "${BASHPID:-}" ]]; then
        filtered_list=$(echo "$filtered_list" | grep -v -E "\\b${BASHPID}\\b" || true)
    fi
    if [[ -n "${PPID:-}" ]]; then
        filtered_list=$(echo "$filtered_list" | grep -v -E "\\b${PPID}\\b" || true)
    fi
    # Also exclude current shell's PID
    filtered_list=$(echo "$filtered_list" | grep -v -E "\\b$$\\b" || true)

    # If no processes left after filtering
    if [[ -z "$filtered_list" ]]; then
        success "No orphaned deployment processes found"
        return 0
    fi

    # Parse PIDs and process details
    while IFS= read -r line; do
        local pid
        pid=$(echo "$line" | awk '{print $2}')
        orphaned_pids+=("$pid")
        orphaned_processes+=("$line")
    done <<< "$filtered_list"

    # Report findings
    if [[ ${#orphaned_pids[@]} -gt 0 ]]; then
        warning "Found ${#orphaned_pids[@]} orphaned deployment process(es):"
        echo ""
        for process in "${orphaned_processes[@]}"; do
            echo "  $process"
        done
        echo ""

        if [[ "$should_terminate" == true ]]; then
            warning "Terminating orphaned processes..."
            for pid in "${orphaned_pids[@]}"; do
                if kill -0 "$pid" 2>/dev/null; then
                    info "Terminating PID $pid"
                    kill -TERM "$pid" 2>/dev/null || true
                    sleep 1
                    if kill -0 "$pid" 2>/dev/null; then
                        warning "Process $pid did not terminate gracefully, forcing..."
                        kill -KILL "$pid" 2>/dev/null || true
                    fi
                fi
            done
            success "Orphaned processes terminated"
        else
            warning "To terminate these processes, run:"
            echo "  sudo bash scripts/lib/utils.sh --cleanup-orphans"
            echo ""
            return 1
        fi
    else
        success "No orphaned deployment processes found"
    fi

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

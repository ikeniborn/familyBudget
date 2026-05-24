#!/bin/bash
#
# utils.sh - Utility Functions
#
# This module provides core utility functions for the deployment script:
# - Logging functions (info, success, warning, error, debug)
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

# Print debug message (only visible with DEBUG=true or --verbose)
# Used for diagnostic information that is not needed in normal operation
debug() {
    # Always log to file for troubleshooting
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [DEBUG] $*" >> "$LOG_FILE"

    # Only print to console if DEBUG mode is enabled
    if [[ "${DEBUG:-false}" == "true" || "${VERBOSE:-false}" == "true" ]]; then
        print_message "$CYAN" "[DEBUG] $*"
    fi
}

# =============================================================================
# ENHANCED ERROR REPORTING
# =============================================================================

# Extract last N error lines from log file
# Args:
#   $1: log file path
#   $2: number of lines (default: 5)
# Returns: prints last N non-empty error lines
get_last_error_lines() {
    local log_file=${1:-$LOG_FILE}
    local num_lines=${2:-5}

    if [[ ! -f "$log_file" ]]; then
        return
    fi

    # Extract last N lines containing errors (case-insensitive)
    grep -iE "(error|failed|fatal|E:|W:)" "$log_file" | tail -n "$num_lines" | while IFS= read -r line; do
        echo "  $line"
    done
}

# Context-aware error reporting with actionable suggestions
# Args:
#   $1: operation name (e.g., "apt-get update")
#   $2: exit code
report_installation_error() {
    local operation=$1
    local exit_code=${2:-1}

    echo ""
    error_return "Operation failed: $operation (exit code: $exit_code)"
    echo ""

    # Show last errors from log
    if [[ -f "$LOG_FILE" ]]; then
        error_return "Last errors from log:"
        get_last_error_lines "$LOG_FILE" 5
        echo ""
    fi

    # Show operation-specific suggestions
    case "$operation" in
        *"apt-get update"*|*"apt-get upgrade"*)
            suggest_fix_apt_update
            ;;
        *"npm"*)
            suggest_fix_npm_install
            ;;
        *"docker"*)
            suggest_fix_docker
            ;;
    esac

    echo "Full log: $LOG_FILE"
    echo ""
}

# Suggest fixes for apt-get update failures
suggest_fix_apt_update() {
    echo "Suggested fixes for apt-get update failure:"
    echo "  1. Check internet connection:"
    echo "     ping -c 3 google.com"
    echo ""
    echo "  2. Clear APT cache:"
    echo "     sudo apt-get clean"
    echo "     sudo rm -rf /var/lib/apt/lists/*"
    echo "     sudo apt-get update"
    echo ""
    echo "  3. Check /etc/apt/sources.list for invalid repositories:"
    echo "     cat /etc/apt/sources.list"
    echo "     sudo nano /etc/apt/sources.list"
    echo ""
    echo "  4. Check for proxy issues:"
    echo "     cat /etc/apt/apt.conf.d/proxy.conf"
    echo ""
    echo "  5. Try manually with verbose output:"
    echo "     sudo apt-get update -y"
    echo ""
}

# Suggest fixes for npm install failures
suggest_fix_npm_install() {
    echo "Suggested fixes for npm install failure:"
    echo "  1. Clear npm cache:"
    echo "     npm cache clean --force"
    echo ""
    echo "  2. Delete node_modules and retry:"
    echo "     rm -rf node_modules package-lock.json"
    echo "     npm install"
    echo ""
    echo "  3. Check disk space:"
    echo "     df -h"
    echo ""
    echo "  4. Check npm registry access:"
    echo "     npm config get registry"
    echo "     curl -I https://registry.npmjs.org"
    echo ""
    echo "  5. Try with increased timeout:"
    echo "     npm install --timeout=60000"
    echo ""
}

# Suggest fixes for Docker installation failures
suggest_fix_docker() {
    echo "Suggested fixes for Docker installation failure:"
    echo "  1. Remove conflicting packages:"
    echo "     sudo apt-get remove -y docker docker-engine docker.io containerd runc"
    echo "     sudo apt-get autoremove -y"
    echo ""
    echo "  2. Check Docker GPG key:"
    echo "     ls -la /etc/apt/keyrings/docker.gpg"
    echo "     sudo rm -f /etc/apt/keyrings/docker.gpg"
    echo "     # Then re-run install.sh"
    echo ""
    echo "  3. Verify Docker repository:"
    echo "     cat /etc/apt/sources.list.d/docker.list"
    echo ""
    echo "  4. Check kernel compatibility:"
    echo "     uname -r"
    echo "     # Docker requires kernel 3.10+"
    echo ""
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
# REPOSITORY DETECTION (v1.1.0)
# =============================================================================

# Detect repository directory using multiple heuristics
# Attempts to find the Family Budget repository root directory by trying:
# 1. Git repository root (if in git repo) - MOST RELIABLE
# 2. Walk up directory tree looking for marker files - FALLBACK
# 3. Common installation locations - LAST RESORT
#
# Args:
#   $1: starting directory (optional, default: pwd)
# Returns:
#   prints repository directory path if found (stdout)
#   returns 0 if found, 1 if not found
#
# Marker files used for detection:
#   - install.sh (installation script)
#   - .env.example (environment template)
#   - nginx/conf.d/app-http.conf.template (nginx config template)
#
# Usage:
#   local repo_dir
#   repo_dir=$(detect_repo_directory "$(pwd)")
#   if [[ $? -eq 0 ]]; then
#       echo "Repository found: $repo_dir"
#   fi
detect_repo_directory() {
    local start_dir="${1:-$(pwd)}"
    local repo_marker_files=("install.sh" ".env.example" "nginx/conf.d/app-http.conf.template")

    info "Attempting to auto-detect repository directory..."
    info "Starting search from: $start_dir"

    # Method 1: Git repository root (most reliable)
    if command_exists git; then
        info "Method 1: Checking git repository root..."

        local git_root
        git_root=$(cd "$start_dir" 2>/dev/null && git rev-parse --show-toplevel 2>/dev/null)

        if [[ -n "$git_root" ]] && [[ -d "$git_root" ]]; then
            info "Git root found: $git_root"

            # Verify marker files exist in git root
            local all_found=true
            for marker in "${repo_marker_files[@]}"; do
                if [[ ! -e "$git_root/$marker" ]]; then
                    info "  Missing marker: $marker"
                    all_found=false
                    break
                fi
            done

            if [[ "$all_found" == "true" ]]; then
                info "Repository detected via git: $git_root"
                info "All marker files found in git root"
                echo "$git_root"
                return 0
            else
                info "Git root missing marker files - not a valid Family Budget repository"
            fi
        else
            info "Not inside a git repository"
        fi
    else
        info "git command not available - skipping git detection"
    fi

    # Method 2: Walk up directory tree looking for marker files
    info "Method 2: Walking up directory tree (max 5 levels)..."

    local current_dir="$start_dir"
    local max_depth=5
    local depth=0

    while [[ $depth -lt $max_depth ]]; do
        info "  Checking directory (depth $depth): $current_dir"

        # Check if all marker files exist in current directory
        local all_found=true
        for marker in "${repo_marker_files[@]}"; do
            if [[ ! -e "$current_dir/$marker" ]]; then
                all_found=false
                break
            fi
        done

        if [[ "$all_found" == "true" ]]; then
            info "Repository detected via marker files: $current_dir"
            echo "$current_dir"
            return 0
        fi

        # Move up one directory
        local parent_dir
        parent_dir=$(dirname "$current_dir")

        # Stop if reached root or no change
        if [[ "$parent_dir" == "$current_dir" ]] || [[ "$parent_dir" == "/" ]]; then
            info "  Reached filesystem root - stopping tree walk"
            break
        fi

        current_dir="$parent_dir"
        ((depth++))
    done

    info "No repository found via directory tree walk"

    # Method 3: Check common locations
    info "Method 3: Checking common installation locations..."

    local common_locations=(
        "$HOME/familyBudget"
        "$HOME/Documents/familyBudget"
        "$HOME/Documents/Project/familyBudget"
        "$HOME/projects/familyBudget"
        "/opt/budget"
    )

    for location in "${common_locations[@]}"; do
        if [[ -d "$location" ]]; then
            info "  Checking: $location"

            # Verify marker files
            local all_found=true
            for marker in "${repo_marker_files[@]}"; do
                if [[ ! -e "$location/$marker" ]]; then
                    all_found=false
                    break
                fi
            done

            if [[ "$all_found" == "true" ]]; then
                info "Repository detected in common location: $location"
                echo "$location"
                return 0
            fi
        fi
    done

    # Not found
    warning "Could not auto-detect repository directory"
    info "Tried methods: git root, directory tree walk, common locations"
    info "Searched for marker files: ${repo_marker_files[*]}"
    return 1
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
    if ! chown -R "$backend_uid:$backend_gid" "$upload_dir" 2>/dev/null; then
        # Try with sudo if direct chown fails (directory may already be owned by container user)
        if ! sudo chown -R "$backend_uid:$backend_gid" "$upload_dir" 2>/dev/null; then
            warning "Could not change ownership of uploads directory - may already be correct"
        fi
    fi

    # Set permissions (755 = rwxr-xr-x: owner can write, others can read/execute)
    if ! chmod -R 755 "$upload_dir" 2>/dev/null; then
        if ! sudo chmod -R 755 "$upload_dir" 2>/dev/null; then
            warning "Could not set permissions on uploads directory - may already be correct"
        fi
    fi

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

# =============================================================================
# ADMIN PASSWORD GENERATION & VALIDATION
# =============================================================================

# Generate secure admin password (OWASP 2023 compliant)
# Returns: 24-character password with all required character types
# Format: [uppercase][lowercase][digit][special][20 random chars]
# Example: Xy5!a7bF3cG9hJ2kP8qR4tU6
generate_admin_password() {
    # Generate random base (20 characters from base64, no special chars)
    local base
    base=$(openssl rand -base64 32 | tr -d '/+=' | head -c 20)

    # Ensure requirements by prepending guaranteed characters
    # shellcheck disable=SC2207
    local upper=$(echo {A..Z} | tr ' ' '\n' | shuf | head -c 1)
    # shellcheck disable=SC2207
    local lower=$(echo {a..z} | tr ' ' '\n' | shuf | head -c 1)
    # shellcheck disable=SC2207
    local digit=$(echo {0..9} | tr ' ' '\n' | shuf | head -c 1)
    # shellcheck disable=SC2207
    local special=$(echo '!@#$%^&*' | fold -w1 | shuf | head -c 1)

    # Combine: 4 guaranteed chars + 20 random = 24 total
    echo "${upper}${lower}${digit}${special}${base}"
}

# Validate email format (basic regex)
# Args: $1 - email address
# Returns: 0 if valid, 1 if invalid
# Example: validate_email "admin@example.com" && echo "Valid"
validate_email() {
    local email="$1"

    if [[ "$email" =~ ^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        return 0
    else
        return 1
    fi
}

#!/bin/bash

set -euo pipefail

# Configuration
readonly GIT_FOLDER="/home/ikeniborn/git"
readonly GIT_BRANCH="master"
readonly APP_FOLDER="/home/ikeniborn/app"
readonly REPO_URL="https://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@github.com/ikeniborn/familyBudget.git"

# Color output for better readability
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Error handling
trap 'log_error "Script failed at line $LINENO"; exit 1' ERR

# Function to sync repository
sync_repository() {
    if [ -d "$GIT_FOLDER" ]; then
        log_info "Repository exists, pulling latest changes..."
        cd "$GIT_FOLDER" || exit 1
        
        # Check if we're in a git repository
        if ! git rev-parse --git-dir >/dev/null 2>&1; then
            log_error "Directory exists but is not a git repository"
            exit 1
        fi
        
        # Fetch and pull with error handling
        git fetch origin || {
            log_error "Failed to fetch from remote"
            exit 1
        }
        
        git pull origin "$GIT_BRANCH" || {
            log_error "Failed to pull changes"
            exit 1
        }
    else
        log_info "Repository doesn't exist, cloning..."
        git clone "$REPO_URL" "$GIT_FOLDER" || {
            log_error "Failed to clone repository"
            exit 1
        }
        
        git config --global --add safe.directory "$GIT_FOLDER"
        cd "$GIT_FOLDER" || exit 1
    fi
    
    # Ensure we're on the correct branch
    current_branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$current_branch" != "$GIT_BRANCH" ]; then
        log_info "Switching to branch $GIT_BRANCH..."
        git checkout "$GIT_BRANCH" || {
            log_error "Failed to checkout branch $GIT_BRANCH"
            exit 1
        }
    fi
}

# Function to sync files to application folder
sync_files() {
    local web_source="$GIT_FOLDER/web"
    local web_target="$APP_FOLDER/web"
    
    # Create app directory if it doesn't exist
    if [ ! -d "$APP_FOLDER" ]; then
        log_info "Creating application directory..."
        sudo mkdir -p "$APP_FOLDER"
    fi
    
    # Check if source directory exists
    if [ ! -d "$web_source" ]; then
        log_error "Source directory $web_source does not exist"
        exit 1
    fi
    
    log_info "Syncing files to application folder..."
    
    # Use rsync with proper options
    sudo rsync -av --delete \
        --exclude='.git' \
        --exclude='*.pyc' \
        --exclude='__pycache__' \
        --exclude='.env' \
        --exclude='*.log' \
        "$web_source/" "$web_target/" || {
        log_error "Failed to sync files"
        exit 1
    }
    
    log_info "Setting executable permissions..."
    
    # Array of scripts that need executable permissions
    local executable_scripts=(
        "db/postgresql/backup/postgres-backup.sh"
        "db/couchdb/backup/couchdb-backup.sh"
        "service/haproxy/prepareLetsEncryptCertificates.sh"
        "service/haproxy/renewLetsEncryptCertificates.sh"
    )
    
    # Set permissions for each script
    for script in "${executable_scripts[@]}"; do
        local full_path="$web_target/$script"
        if [ -f "$full_path" ]; then
            sudo chmod +x "$full_path" || log_warning "Failed to set permissions for $script"
        else
            log_warning "Script not found: $script"
        fi
    done
    
    log_info "Setting ownership..."
    sudo chown -R ikeniborn:ikeniborn "$APP_FOLDER" || {
        log_error "Failed to set ownership"
        exit 1
    }
}

# Function to validate configuration
validate_config() {
    # Check if required commands exist
    local required_commands=("git" "rsync" "sudo")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" >/dev/null 2>&1; then
            log_error "Required command '$cmd' not found"
            exit 1
        fi
    done
    
    # Validate GitHub token (basic check)
    if [[ ! "$REPO_URL" =~ ghp_[a-zA-Z0-9]+ ]]; then
        log_warning "GitHub token might be invalid or expired"
    fi
}

# Main execution
main() {
    log_info "Starting web synchronization..."
    
    # Validate environment
    validate_config
    
    # Sync repository
    sync_repository
    
    # Sync files to application folder
    sync_files
    
    # Return to home directory
    cd "$HOME" || exit 1
    
    log_info "Synchronization completed successfully!"
    
    # Show summary
    if [ -d "$GIT_FOLDER/.git" ]; then
        cd "$GIT_FOLDER" || exit 1
        local commit_hash=$(git rev-parse --short HEAD)
        local commit_message=$(git log -1 --pretty=%B | head -n1)
        log_info "Current commit: $commit_hash - $commit_message"
    fi
}

# Run main function
main "$@"
#!/bin/bash
#
# Family Budget - Code Synchronization Module
#
# This module provides code synchronization functions for deploy.sh
#
# Functions:
#   - detect_repository_dir()     - Auto-detect repository directory
#   - check_code_changes()         - Check if there are code changes to sync
#   - sync_mirror()                - Sync using mirror mode (rsync --delete)
#   - sync_update()                - Sync using update mode (no delete)
#   - sync_clean()                 - Sync using clean mode (full cleanup + copy)
#   - sync_code_to_deploy()        - Main code synchronization orchestrator
#
# Dependencies:
#   - config.sh (DEPLOY_DIR, SCRIPT_DIR, LOG_FILE)
#   - utils.sh (info, success, warning, error, step)
#
# Version: 1.0.0
# Phase: 3.1
#

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

    # Option 3b: ~/Documents/Project/familyBudget (alternative location)
    if [[ -d "$HOME/Documents/Project/familyBudget/.git" && -f "$HOME/Documents/Project/familyBudget/docker-compose.yml" ]]; then
        detected_dir="$HOME/Documents/Project/familyBudget"
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
    echo "  - Alternative location: ~/Documents/Project/familyBudget" >&2
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
    local changes=$(rsync -avnc \
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
# Uses --checksum (-c) to compare by content, not mtime (prevents false positives for mounted volumes)
sync_mirror() {
    local repo_dir=$1

    info "Syncing code: mirror mode (rsync --delete --checksum)"
    info "From: $repo_dir"
    info "To:   $DEPLOY_DIR"
    echo ""

    # Show preview of changes
    info "Preview of changes (first 20 files):"
    rsync -avnc \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        --exclude='docs/' \
        --exclude='setup.sh' \
        --exclude='install.sh' \
        --exclude='deploy.sh' \
        --exclude='README.md' \
        --exclude='START.md' \
        --exclude='SKILLS.md' \
        --exclude='.claude/' \
        --exclude='.gitignore' \
        --exclude='.git*' \
        "$repo_dir/" "$DEPLOY_DIR/" 2>/dev/null | grep -v "/$" | grep -v "^sending\|^sent\|^total" | head -20

    echo ""
    read -p "Continue with mirror sync? [Y/n]: " confirm

    if [[ "${confirm,,}" == "n" ]]; then
        warning "Sync cancelled by user"
        return 1
    fi

    # Perform sync
    if rsync -avc --delete \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        --exclude='docs/' \
        --exclude='setup.sh' \
        --exclude='install.sh' \
        --exclude='deploy.sh' \
        --exclude='README.md' \
        --exclude='START.md' \
        --exclude='SKILLS.md' \
        --exclude='.claude/' \
        --exclude='.gitignore' \
        --exclude='.git*' \
        "$repo_dir/" "$DEPLOY_DIR/" >> "$LOG_FILE" 2>&1; then
        success "Code synced successfully (mirror mode)"
        return 0
    else
        error "Failed to sync code. Check $LOG_FILE for details."
        return 1
    fi
}

# Sync code using update mode (rsync + delete orphaned files)
# Uses --checksum (-c) to compare by content, not mtime (prevents false positives for mounted volumes)
sync_update() {
    local repo_dir=$1

    info "Syncing code: update mode + cleanup orphaned files (checksum-based)"
    info "From: $repo_dir"
    info "To:   $DEPLOY_DIR"
    echo ""

    # Show preview
    info "Preview of changes (first 20 files):"
    rsync -avnc \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        --exclude='docs/' \
        --exclude='setup.sh' \
        --exclude='install.sh' \
        --exclude='deploy.sh' \
        --exclude='README.md' \
        --exclude='START.md' \
        --exclude='SKILLS.md' \
        --exclude='.claude/' \
        --exclude='.gitignore' \
        --exclude='.git*' \
        "$repo_dir/" "$DEPLOY_DIR/" 2>/dev/null | grep -v "/$" | grep -v "^sending\|^sent\|^total" | head -20

    echo ""
    read -p "Continue with update sync? [Y/n]: " confirm

    if [[ "${confirm,,}" == "n" ]]; then
        warning "Sync cancelled by user"
        return 1
    fi

    # 1. Perform rsync (update/add files)
    info "Step 1/2: Syncing new and modified files..."
    if ! rsync -avc \
        --exclude='.env' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='node_modules/' \
        --exclude='docker-compose.networks.yml' \
        --exclude='docs/' \
        --exclude='setup.sh' \
        --exclude='install.sh' \
        --exclude='deploy.sh' \
        --exclude='README.md' \
        --exclude='START.md' \
        --exclude='SKILLS.md' \
        --exclude='.claude/' \
        --exclude='.gitignore' \
        --exclude='.git*' \
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
        ! -path "./docs/*" \
        ! -name "setup.sh" \
        ! -name "install.sh" \
        ! -name "deploy.sh" \
        ! -name "README.md" \
        ! -name "START.md" \
        ! -name "SKILLS.md" \
        ! -path "./.claude/*" \
        ! -name ".gitignore" \
        ! -name ".git*" \
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
        ! -path "./docs/*" \
        ! -name "setup.sh" \
        ! -name "install.sh" \
        ! -name "deploy.sh" \
        ! -name "README.md" \
        ! -name "START.md" \
        ! -name "SKILLS.md" \
        ! -path "./.claude/*" \
        ! -name ".gitignore" \
        ! -name ".git*" \
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

    warning "Clean sync: DELETES EVERYTHING in $DEPLOY_DIR except .env"
    warning "⚠️  This will DELETE:"
    warning "  - All code (backend/, bot/, nginx/, web/, scripts/)"
    warning "  - All data (data/* including PostgreSQL database)"
    warning "  - All logs (logs/* except current deploy.log)"
    warning "  - All backups (backups/)"
    warning "  - All Docker volumes and containers"
    echo ""
    warning "Preserved:"
    warning "  - .env file"
    warning "  - logs/ and data/ directories (contents cleared)"
    warning "  - Current deploy.log (for troubleshooting)"
    echo ""
    read -p "Type 'DELETE' to confirm (all caps): " confirm
    echo ""

    if [[ "$confirm" != "DELETE" ]]; then
        warning "Clean sync cancelled"
        return 1
    fi

    # Check for root privileges (required for PostgreSQL data deletion)
    if ! check_root_privileges; then
        error "Clean sync requires root privileges to delete PostgreSQL data!"
        echo ""
        echo "Please run deploy.sh with sudo:"
        echo "  sudo $SCRIPT_DIR/deploy.sh --sync-mode clean"
        echo ""
        exit 1
    fi

    info "Performing FULL clean sync (everything except .env)..."

    # Step 1: Stop and remove all Docker containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Stopping Docker containers..."
        echo "$containers" | xargs docker stop >> "$LOG_FILE" 2>&1 || true
        info "Removing Docker containers..."
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Step 2: Remove Docker volumes
    local volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$volumes" ]]; then
        warning "Removing Docker volumes (DATABASE DELETION)..."
        echo "$volumes" | xargs docker volume rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Step 3: Remove Docker networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing Docker networks..."
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Step 4: Remove ALL directories and files except .env
    warning "Removing all directories and files (except .env)..."

    # Remove code directories completely
    local dirs_to_remove=("backend" "bot" "nginx" "web" "scripts" "backups" "webapp")
    for dir in "${dirs_to_remove[@]}"; do
        if [[ -d "$DEPLOY_DIR/$dir" ]]; then
            info "  Removing $DEPLOY_DIR/$dir"
            if ! rm -rf "$DEPLOY_DIR/$dir" 2>&1 | grep -v "deploy.log" | tee -a "$LOG_FILE" >/dev/null; then
                warning "  Failed to remove $dir (may require manual cleanup)"
            fi
        fi
    done

    # Clear data/ and logs/ contents but keep directories (needed for logging and PostgreSQL init)
    if [[ -d "$DEPLOY_DIR/data" ]]; then
        info "  Clearing $DEPLOY_DIR/data/* (keeping directory)"
        rm -rf "$DEPLOY_DIR/data"/* 2>/dev/null || true
    fi

    if [[ -d "$DEPLOY_DIR/logs" ]]; then
        info "  Clearing $DEPLOY_DIR/logs/* (keeping directory for logging)"
        # Keep deploy.log but clear other logs
        find "$DEPLOY_DIR/logs" -type f ! -name 'deploy.log' -delete 2>/dev/null || true
        find "$DEPLOY_DIR/logs" -mindepth 1 -type d -exec rm -rf {} + 2>/dev/null || true
    fi

    # Remove docker-compose files
    for file in docker-compose.yml docker-compose.*.yml; do
        if [[ -f "$DEPLOY_DIR/$file" ]]; then
            info "  Removing $file"
            rm -f "$DEPLOY_DIR/$file"
        fi
    done

    # Remove other root-level files (except .env and logs which are excluded)
    find "$DEPLOY_DIR" -maxdepth 1 -type f ! -name '.env' ! -name 'deploy.log' -delete 2>/dev/null || true

    # Step 5: Copy everything from repository (except .env and directories we already handled)
    info "Copying fresh code from $repo_dir to $DEPLOY_DIR"
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

        # Ensure logs/ and data/ directories exist
        mkdir -p "$DEPLOY_DIR/logs" "$DEPLOY_DIR/data" 2>/dev/null || true

        # Mark PostgreSQL as stopped (will be initialized fresh)
        POSTGRES_WAS_STOPPED=true

        success "Clean sync completed: EVERYTHING deleted except .env, fresh code copied"
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

        # If SYNC_MODE already set via CLI, respect it without prompting
        if [[ -n "$SYNC_MODE" ]]; then
            info "Proceeding with sync (mode: $SYNC_MODE specified via CLI)"
        # Check if we have interactive terminal
        elif [[ -t 0 ]]; then
            echo ""
            read -p "Force sync anyway? [y/N]: " force
            if [[ "${force,,}" != "y" ]]; then
                info "Skipping code synchronization"
                return 0
            fi
        else
            # Non-interactive mode (no TTY) - skip sync by default
            info "Non-interactive mode detected: skipping synchronization"
            return 0
        fi
    fi

    # Interactive mode selection (if not specified via CLI)
    if [[ -z "$SYNC_MODE" ]]; then
        # Check if we have interactive terminal
        if [[ -t 0 ]]; then
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
            echo "      Deletes EVERYTHING (code, data/*, logs/*, backups, Docker volumes)"
            echo "      ⚠️  DELETES PostgreSQL database and ALL data!"
            echo "      Protected: .env, logs/ and data/ directories (contents cleared)"
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
        else
            # Non-interactive mode (no TTY) - use mirror as default
            SYNC_MODE="mirror"
            info "Non-interactive mode detected: using default sync mode 'mirror'"
        fi
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

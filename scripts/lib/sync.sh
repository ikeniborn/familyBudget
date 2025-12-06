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

# Validate repository path for security
# Prevents path traversal and other malicious paths
# Args:
#   $1 - Path to validate
# Returns:
#   0 - Valid path
#   1 - Invalid path
validate_repo_path() {
    local path="$1"

    # SECURITY: Check for path traversal attempts
    if [[ "$path" == *".."* ]]; then
        error "Path traversal detected: path contains '..'"
        return 1
    fi

    # SECURITY: Path must be absolute
    if [[ "$path" != /* ]]; then
        error "Path must be absolute (start with /)"
        return 1
    fi

    # SECURITY: Disallow dangerous paths
    case "$path" in
        /|/bin|/sbin|/usr|/etc|/var|/tmp|/dev|/proc|/sys|/root)
            error "Cannot use system directory as repository: $path"
            return 1
            ;;
        /bin/*|/sbin/*|/usr/*|/etc/*|/dev/*|/proc/*|/sys/*)
            error "Cannot use system directory as repository: $path"
            return 1
            ;;
    esac

    # Path must exist and be a directory
    if [[ ! -d "$path" ]]; then
        error "Path does not exist or is not a directory: $path"
        return 1
    fi

    return 0
}

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
                # SECURITY: Validate path before using
                if ! validate_repo_path "$repo_path"; then
                    exit 1
                fi
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
            # SECURITY: Validate path before using
            if ! validate_repo_path "$repo_path"; then
                exit 1
            fi
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
    # IMPORTANT: .npm-isolated/ and .migration_checksums excluded (live in /opt/budget only, not copied)
    # CRITICAL: node_modules/ excluded (only .npm-isolated/node_modules should exist in production)
    local changes=$(rsync -avnc \
        --exclude='.env' \
        --exclude='node_modules/' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='sql/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='.npm-isolated/' \
        --exclude='.migration_checksums' \
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

    # PRE-SYNC CHECK: Verify npm environment before mirror sync (critical with --delete)
    if [[ -d "$DEPLOY_DIR/.npm-isolated/node_modules" ]]; then
        local pkg_count
        pkg_count=$(find "$DEPLOY_DIR/.npm-isolated/node_modules" -maxdepth 1 -type d ! -name ".*" | wc -l)
        info "Pre-sync: npm environment detected ($pkg_count packages)"
        info "Will be PROTECTED by --filter='protect .npm-isolated/'"
    else
        warning "Pre-sync: npm environment NOT found at $DEPLOY_DIR/.npm-isolated/"
        warning "If this is first deployment, run install.sh after sync"
    fi
    echo ""

    # Show preview of changes
    # IMPORTANT: .npm-isolated/ and .migration_checksums PROTECTED from deletion (production-only)
    # Uses --filter='protect' to prevent rsync --delete from removing them
    # CRITICAL: node_modules/ excluded (only .npm-isolated/node_modules should exist in production)
    info "Preview of changes (first 20 files):"
    rsync -avnc \
        --filter='protect .npm-isolated/' \
        --filter='protect .migration_checksums' \
        --exclude='.env' \
        --exclude='node_modules/' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='sql/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='.npm-isolated/' \
        --exclude='.migration_checksums' \
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
    info "Proceeding with mirror sync (auto-confirmed)..."

    # Perform sync
    # CRITICAL FIX (2025-11-08): Protect .npm-isolated/ from deletion
    # CRITICAL FIX (2025-11-12): Protect .migration_checksums from deletion
    # CRITICAL FIX (2025-11-21): Exclude node_modules/ from sync (only .npm-isolated/node_modules exists in production)
    # Problem: rsync --delete removes files from destination not in source
    # Solution: --filter='protect' prevents deletion even with --delete flag
    # Protected files live ONLY in production (/opt/budget), NOT in repository:
    #   - .npm-isolated/ (233 npm packages for build)
    #   - .migration_checksums (MD5 checksums for migration change detection)
    if rsync -avc --delete \
        --filter='protect .npm-isolated/' \
        --filter='protect .migration_checksums' \
        --exclude='.env' \
        --exclude='node_modules/' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='sql/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='.npm-isolated/' \
        --exclude='.migration_checksums' \
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

        # POST-SYNC VERIFICATION: Ensure npm environment was NOT deleted
        if [[ ! -d "$DEPLOY_DIR/.npm-isolated/node_modules" ]]; then
            error "CRITICAL: npm environment DELETED during mirror sync!"
            error "This indicates --filter='protect' is NOT working correctly"
            error "Please report this as a bug with rsync version: $(rsync --version | head -1)"
            return 1
        else
            success "Post-sync: npm environment preserved successfully"
        fi

        # Ensure required directories exist
        info "Creating required directories..."
        mkdir -p "$DEPLOY_DIR/logs" "$DEPLOY_DIR/data" "$DEPLOY_DIR/backups" 2>/dev/null || true
        chmod 755 "$DEPLOY_DIR/backups" 2>/dev/null || true

        # Set executable permissions for all shell scripts
        # This ensures backup.sh and other scripts can be executed by cron
        info "Setting executable permissions for shell scripts..."
        find "$DEPLOY_DIR/scripts" -type f -name "*.sh" -exec chmod 755 {} \;
        success "Shell scripts permissions updated"

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
    # IMPORTANT: .npm-isolated/ and .migration_checksums excluded (production-only, not synced)
    # CRITICAL: node_modules/ excluded (only .npm-isolated/node_modules should exist in production)
    info "Preview of changes (first 20 files):"
    rsync -avnc \
        --exclude='.env' \
        --exclude='node_modules/' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='sql/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='.npm-isolated/' \
        --exclude='.migration_checksums' \
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
    info "Proceeding with update sync (auto-confirmed)..."

    # 1. Perform rsync (update/add files)
    # IMPORTANT: .npm-isolated/ and .migration_checksums excluded (production-only directories/files)
    # CRITICAL: node_modules/ excluded (only .npm-isolated/node_modules should exist in production)
    info "Step 1/2: Syncing new and modified files..."
    if ! rsync -avc \
        --exclude='.env' \
        --exclude='node_modules/' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='backups/' \
        --exclude='.git/' \
        --exclude='sql/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='.npm-isolated/' \
        --exclude='.migration_checksums' \
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
        ! -path "./node_modules/*" \
        ! -path "./data/*" \
        ! -path "./logs/*" \
        ! -path "./backups/*" \
        ! -path "./sql/*" \
        ! -name "*.pyc" \
        ! -path "./__pycache__/*" \
        ! -path "./.npm-isolated/*" \
        ! -name ".migration_checksums" \
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
    # IMPORTANT: Exclude .npm-isolated/* and .migration_checksums from cleanup (production-only)
    # CRITICAL: Exclude node_modules/* from cleanup (should not exist, but safeguard)
    (cd "$DEPLOY_DIR" && find . -type f \
        ! -path "./.git/*" \
        ! -path "./.env" \
        ! -path "./node_modules/*" \
        ! -path "./data/*" \
        ! -path "./logs/*" \
        ! -path "./backups/*" \
        ! -path "./sql/*" \
        ! -name "*.pyc" \
        ! -path "./__pycache__/*" \
        ! -path "./.npm-isolated/*" \
        ! -name ".migration_checksums" \
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

    # Ensure required directories exist
    info "Creating required directories..."
    mkdir -p "$DEPLOY_DIR/logs" "$DEPLOY_DIR/data" "$DEPLOY_DIR/backups" 2>/dev/null || true
    chmod 755 "$DEPLOY_DIR/backups" 2>/dev/null || true

    # Set executable permissions for all shell scripts
    # This ensures backup.sh and other scripts can be executed by cron
    info "Setting executable permissions for shell scripts..."
    find "$DEPLOY_DIR/scripts" -type f -name "*.sh" -exec chmod 755 {} \;
    success "Shell scripts permissions updated"

    success "Code synced: updated/added files, deleted $deleted_count orphaned files"
    return 0
}

# Sync code using clean mode (full cleanup + copy)
sync_clean() {
    local repo_dir=$1

    warning "Clean sync: DELETES EVERYTHING in $DEPLOY_DIR except protected files"
    warning "⚠️  This will DELETE:"
    warning "  - All code (backend/, bot/, nginx/, frontend/, scripts/)"
    warning "  - All data (data/* including PostgreSQL database)"
    warning "  - All logs (logs/* except current deploy.log)"
    warning "  - All backups (backups/)"
    warning "  - All Docker volumes and containers"
    echo ""
    warning "Protected (NOT deleted):"
    warning "  - .env file"
    warning "  - .npm-isolated/ (production npm environment)"
    warning "  - .migration_checksums (migration change detection)"
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
    local dirs_to_remove=("backend" "bot" "nginx" "frontend" "scripts" "backups")
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
    # IMPORTANT: .npm-isolated/ and .migration_checksums excluded (will be managed separately in production)
    # CRITICAL: node_modules/ excluded (only .npm-isolated/node_modules should exist in production)
    info "Copying fresh code from $repo_dir to $DEPLOY_DIR"
    if rsync -av \
        --exclude='.env' \
        --exclude='node_modules/' \
        --exclude='data/' \
        --exclude='logs/' \
        --exclude='.git/' \
        --exclude='sql/' \
        --exclude='__pycache__/' \
        --exclude='*.pyc' \
        --exclude='.npm-isolated/' \
        --exclude='.migration_checksums' \
        "$repo_dir/" "$DEPLOY_DIR/" >> "$LOG_FILE" 2>&1; then

        # Ensure logs/, data/, and backups/ directories exist
        mkdir -p "$DEPLOY_DIR/logs" "$DEPLOY_DIR/data" "$DEPLOY_DIR/backups" 2>/dev/null || true

        # Set proper permissions for backups directory
        # 755 allows root to write (backup.sh) and containers to read (health checks)
        chmod 755 "$DEPLOY_DIR/backups" 2>/dev/null || true

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
            echo "      Protected: .env, .npm-isolated/, .migration_checksums, backups/, data/, logs/"
            echo ""
            echo "  [2] Update only (rsync)"
            echo "      Updates existing + adds new files"
            echo "      Old files NOT deleted (may leave artifacts)"
            echo ""
            echo "  [3] Clean + copy (DANGEROUS!)"
            echo "      Deletes EVERYTHING (code, data/*, logs/*, backups, Docker volumes)"
            echo "      ⚠️  DELETES PostgreSQL database and ALL data!"
            echo "      Protected: .env, .npm-isolated/, .migration_checksums, logs/ and data/ directories (contents cleared)"
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

    # ARCHITECTURE NOTE (2025-11-08):
    # Production-only files live in /opt/budget (NOT synchronized from repository):
    #   1. .npm-isolated/ - npm packages (233 packages, ~100-200MB)
    #   2. .migration_checksums - MD5 checksums for migration change detection
    #
    # These are excluded in all rsync commands above. This provides:
    #   - Faster deploys (~100-200MB not copied)
    #   - No permission issues during sync
    #   - Clear separation: source code in repo, build tools + state in production
    #   - Persistent migration change detection across deployments
    #
    # To set up npm environment: run install.sh (creates /opt/budget/.npm-isolated)

    # Verify npm environment exists in production directory
    if [[ -d "/opt/budget/.npm-isolated/node_modules" ]]; then
        local package_count
        package_count=$(find "/opt/budget/.npm-isolated/node_modules" -maxdepth 1 -type d ! -name ".*" | wc -l)
        info "Production npm environment verified: /opt/budget/.npm-isolated/ ($package_count packages)"
        info "Ready for build (NOT copied via rsync - production-only directory)"
    else
        warning "Production npm environment not found: /opt/budget/.npm-isolated/"
        warning "Run install.sh to set up npm dependencies in production directory"
        warning "Build process may fail without npm environment"
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

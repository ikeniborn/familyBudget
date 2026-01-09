#!/bin/bash
#
# version.sh - Application Version Management
#
# This module provides functions for semantic versioning (SemVer) management
# during deployment. It handles automatic version incrementing and updating
# version across all relevant files.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/version.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR, SCRIPT_DIR)
#   - utils.sh (for logging functions)
#

# =============================================================================
# VERSION CONFIGURATION
# =============================================================================

# Version file (single source of truth)
VERSION_FILE="${SCRIPT_DIR:-$(pwd)}/VERSION"

# Files to update with version
declare -a VERSION_FILES=(
    "package.json"
    ".env"
)

# Files that require Docker image rebuild when changed
declare -a REBUILD_TRIGGER_FILES=(
    # Docker build triggers
    "backend/Dockerfile"
    "bot/Dockerfile"
    "backend/requirements.txt"
    "bot/requirements.txt"
    "docker-compose.yml"

    # Frontend build triggers (v7.0+ ES modules architecture)
    "package.json"                          # npm dependencies
    "vite.config.ts"                        # Vite build configuration
    "build-all.js"                          # Build orchestration script
    "frontend/web/static/js/lists-bundle.ts"  # Lists module entry point
    "frontend/shared/static/js/budgetShared.ts"  # Shared bundle entry point
)

# Version bump type (set by command line)
VERSION_BUMP_TYPE=""  # major|minor|patch|none (empty = minor by default)
VERSION_EXPLICIT=""   # Explicit version to set (e.g., "5.2.0")

# =============================================================================
# VERSION PARSING FUNCTIONS
# =============================================================================

# Read current version from VERSION file
# Returns: version string (e.g., "5.1.2")
get_current_version() {
    local version_file="${1:-$VERSION_FILE}"

    if [[ ! -f "$version_file" ]]; then
        echo "1.0.0"  # Default if VERSION file doesn't exist
        return 0
    fi

    # Read first line, strip whitespace
    local version
    version=$(head -n 1 "$version_file" | tr -d '[:space:]')

    # Validate format (X.Y.Z)
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        warning "Invalid version format in $version_file: $version"
        echo "1.0.0"
        return 1
    fi

    echo "$version"
}

# Parse version into components
# Args: version (e.g., "5.1.2")
# Returns: sets MAJOR, MINOR, PATCH variables
parse_version() {
    local version="$1"

    if [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        PATCH="${BASH_REMATCH[3]}"
        return 0
    else
        error "Invalid version format: $version"
        return 1
    fi
}

# =============================================================================
# VERSION INCREMENT FUNCTIONS
# =============================================================================

# Increment version based on bump type
# Args: current_version, bump_type (major|minor|patch)
# Returns: new version string
increment_version() {
    local current_version="$1"
    local bump_type="${2:-minor}"

    local MAJOR MINOR PATCH
    parse_version "$current_version" || return 1

    case "$bump_type" in
        major)
            MAJOR=$((MAJOR + 1))
            MINOR=0
            PATCH=0
            ;;
        minor)
            MINOR=$((MINOR + 1))
            PATCH=0
            ;;
        patch)
            PATCH=$((PATCH + 1))
            ;;
        none)
            # No increment
            ;;
        *)
            error "Unknown bump type: $bump_type"
            return 1
            ;;
    esac

    echo "${MAJOR}.${MINOR}.${PATCH}"
}

# =============================================================================
# VERSION UPDATE FUNCTIONS
# =============================================================================

# Update VERSION file
# Args: new_version
update_version_file() {
    local new_version="$1"
    local version_file="${2:-$VERSION_FILE}"

    echo "$new_version" > "$version_file"
    info "Updated VERSION file: $new_version"
}

# Update package.json version
# Args: new_version, package_json_path
update_package_json() {
    local new_version="$1"
    local package_json="${2:-${SCRIPT_DIR}/package.json}"

    if [[ ! -f "$package_json" ]]; then
        warning "package.json not found: $package_json"
        return 1
    fi

    # Use sed to update version (handles any current version format)
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$new_version\"/" "$package_json"

    if [[ $? -eq 0 ]]; then
        info "Updated package.json: $new_version"
        return 0
    else
        warning "Failed to update package.json"
        return 1
    fi
}

# Update .env VERSION variable
# Args: new_version, env_file_path
update_env_version() {
    local new_version="$1"
    local env_file="${2:-${DEPLOY_DIR}/.env}"

    if [[ ! -f "$env_file" ]]; then
        warning ".env not found: $env_file"
        return 1
    fi

    # Check if VERSION variable exists
    if grep -q "^VERSION=" "$env_file"; then
        # Update existing VERSION
        sed -i "s/^VERSION=.*/VERSION=$new_version/" "$env_file"
    else
        # Add VERSION variable
        echo "" >> "$env_file"
        echo "# Application version (auto-updated by deploy.sh)" >> "$env_file"
        echo "VERSION=$new_version" >> "$env_file"
    fi

    if [[ $? -eq 0 ]]; then
        info "Updated .env VERSION: $new_version"
        return 0
    else
        warning "Failed to update .env VERSION"
        return 1
    fi
}

# Update all version files in DEPLOYMENT DIRECTORY ONLY
# IMPORTANT: This function ONLY updates files in /opt/budget (DEPLOY_DIR)
# Repository files (~/familyBudget) are NEVER modified to keep git clean
# Args: new_version
update_all_version_files() {
    local new_version="$1"

    info "Updating version to $new_version in all files..."

    # Update VERSION file in DEPLOY_DIR only (NOT in repository!)
    update_version_file "$new_version" "${DEPLOY_DIR}/VERSION"

    # Update package.json in DEPLOY_DIR only (NOT in repository!)
    update_package_json "$new_version" "${DEPLOY_DIR}/package.json"

    # Update .env in deployment directory (if exists)
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        update_env_version "$new_version" "$DEPLOY_DIR/.env"
    fi

    success "Version updated to $new_version"
}

# =============================================================================
# REBUILD DETECTION FUNCTIONS
# =============================================================================

# File to store checksums of trigger files used in last successful Docker build
# This prevents the bug where:
#   1. Sync copies new files to /opt/budget
#   2. Build fails or is skipped
#   3. Next deploy compares repo vs deploy (now identical) → "no rebuild needed"
#   4. But Docker image still has OLD dependencies!
DOCKER_BUILD_CHECKSUMS_FILE="${DEPLOY_DIR}/.docker_build_checksums"

# Calculate checksums for all rebuild trigger files
# Args: repo_dir
# Returns: sorted list of "checksum filename" pairs
calculate_trigger_checksums() {
    local repo_dir="${1:-$SCRIPT_DIR}"
    local checksums=""

    for trigger_file in "${REBUILD_TRIGGER_FILES[@]}"; do
        local full_path="${repo_dir}/${trigger_file}"
        if [[ -f "$full_path" ]]; then
            local checksum
            checksum=$(md5sum "$full_path" 2>/dev/null | cut -d' ' -f1)
            checksums+="${checksum}  ${trigger_file}"$'\n'
        fi
    done

    echo "$checksums" | sort
}

# Save checksums after successful Docker build
# Call this AFTER Docker images are successfully built
save_docker_build_checksums() {
    local repo_dir="${1:-$SCRIPT_DIR}"
    local checksums

    checksums=$(calculate_trigger_checksums "$repo_dir")

    if [[ -z "$checksums" ]]; then
        warning "No trigger files found to save checksums"
        return 1
    fi

    echo "$checksums" > "$DOCKER_BUILD_CHECKSUMS_FILE"
    info "Saved Docker build checksums for $(echo "$checksums" | grep -c .) trigger files"
    return 0
}

# Load checksums from last successful build
load_docker_build_checksums() {
    if [[ -f "$DOCKER_BUILD_CHECKSUMS_FILE" ]]; then
        cat "$DOCKER_BUILD_CHECKSUMS_FILE"
    else
        echo ""  # No previous build checksums
    fi
}

# Check if frontend assets need to be rebuilt (npm run build)
# Checks TypeScript/JavaScript source files in frontend directories
# v7.0+ ES modules architecture: checks .ts/.tsx files
# Args: repo_dir
# Returns: 0 if rebuild needed, 1 if not needed
needs_frontend_rebuild() {
    local repo_dir="${1:-$SCRIPT_DIR}"
    local frontend_checksum_file="${DEPLOY_DIR}/.frontend_build_checksums"

    # Always rebuild if no previous checksums
    if [[ ! -f "$frontend_checksum_file" ]]; then
        info "No previous frontend build checksums - rebuild required"
        return 0
    fi

    # Calculate checksums for frontend source files
    # Include: .ts, .tsx files in frontend/ and build configuration files
    local current_checksums
    current_checksums=$(
        find "$repo_dir/frontend" -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | sort | xargs md5sum 2>/dev/null
        md5sum "$repo_dir/package.json" "$repo_dir/vite.config.ts" "$repo_dir/build-all.js" 2>/dev/null
    )

    local previous_checksums
    previous_checksums=$(cat "$frontend_checksum_file")

    if [[ "$current_checksums" != "$previous_checksums" ]]; then
        # Find changed files (simplified - just show count)
        local changed_count
        changed_count=$(diff <(echo "$previous_checksums") <(echo "$current_checksums") 2>/dev/null | grep -c "^[<>]" || echo "unknown")
        info "Frontend source files changed: ~$changed_count files"
        info "npm build required"
        return 0
    fi

    info "No frontend source files changed since last build"
    return 1
}

# Save frontend build checksums after successful npm build
save_frontend_build_checksums() {
    local repo_dir="${1:-$SCRIPT_DIR}"
    local frontend_checksum_file="${DEPLOY_DIR}/.frontend_build_checksums"

    local checksums
    checksums=$(
        find "$repo_dir/frontend" -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | sort | xargs md5sum 2>/dev/null
        md5sum "$repo_dir/package.json" "$repo_dir/vite.config.ts" "$repo_dir/build-all.js" 2>/dev/null
    )

    echo "$checksums" > "$frontend_checksum_file"
    info "Saved frontend build checksums"
}

# Check if Docker images need to be rebuilt
# Compares current trigger files against checksums from LAST SUCCESSFUL BUILD
# (not against deploy directory, which may have been synced without rebuild)
# Args: repo_dir
# Returns: 0 if rebuild needed, 1 if not needed
needs_docker_rebuild() {
    local repo_dir="${1:-$SCRIPT_DIR}"

    # If no previous build checksums, always rebuild
    if [[ ! -f "$DOCKER_BUILD_CHECKSUMS_FILE" ]]; then
        info "No previous Docker build checksums found - rebuild required"
        return 0
    fi

    # Load previous build checksums
    local previous_checksums
    previous_checksums=$(load_docker_build_checksums)

    if [[ -z "$previous_checksums" ]]; then
        info "Empty Docker build checksums - rebuild required"
        return 0
    fi

    # Calculate current checksums
    local current_checksums
    current_checksums=$(calculate_trigger_checksums "$repo_dir")

    # Compare checksums
    if [[ "$previous_checksums" != "$current_checksums" ]]; then
        # Find which files changed
        local changed_files
        changed_files=$(diff <(echo "$previous_checksums") <(echo "$current_checksums") 2>/dev/null | grep "^[<>]" | sed 's/^[<>] //' | awk '{print $2}' | sort -u)

        if [[ -n "$changed_files" ]]; then
            info "Trigger files changed since last build:"
            echo "$changed_files" | while read -r file; do
                info "  - $file"
            done
        fi
        info "Docker rebuild required"
        return 0
    fi

    info "No rebuild trigger files changed since last successful build"
    return 1
}

# Save last deployed version
# Args: version
save_deployed_version() {
    local version="$1"
    echo "$version" > "$DEPLOY_DIR/.last_deployed_version"
    info "Saved deployed version: $version"
}

# =============================================================================
# MAIN VERSION MANAGEMENT FUNCTION
# =============================================================================

# Process version bump and update all files
# IMPORTANT: This function must be called AFTER sync_code_to_deploy()
# because it reads and updates version files in DEPLOY_DIR only
# This is the main entry point called from deploy.sh
# Returns: Sets and exports CURRENT_VERSION, NEW_VERSION, DOCKER_REBUILD_NEEDED variables
process_version_bump() {
    step "Version Management"

    # Get current version from DEPLOY_DIR (after sync)
    CURRENT_VERSION=$(get_current_version "${DEPLOY_DIR}/VERSION")
    info "Current version: $CURRENT_VERSION"

    # Determine new version
    if [[ -n "$VERSION_EXPLICIT" ]]; then
        # Use explicitly set version
        NEW_VERSION="$VERSION_EXPLICIT"
        info "Using explicit version: $NEW_VERSION"
    elif [[ "$VERSION_BUMP_TYPE" == "none" ]]; then
        # No version bump requested
        NEW_VERSION="$CURRENT_VERSION"
        info "Version bump skipped (--no-version)"
    else
        # Auto-increment version
        local bump_type="${VERSION_BUMP_TYPE:-minor}"
        NEW_VERSION=$(increment_version "$CURRENT_VERSION" "$bump_type")
        info "Bumping $bump_type version: $CURRENT_VERSION → $NEW_VERSION"
    fi

    # Update version files in DEPLOY_DIR only (NOT in repository!)
    if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
        update_all_version_files "$NEW_VERSION"
    fi

    # Check if Docker rebuild needed (comparing DEPLOY_DIR with saved checksums)
    DOCKER_REBUILD_NEEDED=false
    if needs_docker_rebuild "$DEPLOY_DIR"; then
        DOCKER_REBUILD_NEEDED=true
        info "Docker images will be rebuilt"
    else
        info "Docker images will NOT be rebuilt (no trigger files changed)"
    fi

    # Export variables for use in other scripts (services.sh, etc.)
    export CURRENT_VERSION
    export NEW_VERSION
    export VERSION="$NEW_VERSION"
    export DOCKER_REBUILD_NEEDED

    success "Version: $NEW_VERSION (rebuild: $DOCKER_REBUILD_NEEDED)"
}

# =============================================================================
# VERSION DISPLAY FUNCTIONS
# =============================================================================

# Display version information
show_version_info() {
    local repo_dir="${1:-$SCRIPT_DIR}"

    local current_version
    current_version=$(get_current_version "${repo_dir}/VERSION")

    local deployed_version=""
    if [[ -f "$DEPLOY_DIR/.last_deployed_version" ]]; then
        deployed_version=$(cat "$DEPLOY_DIR/.last_deployed_version")
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    print_message "$CYAN" "  Version Information"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  Repository version:  $current_version"
    if [[ -n "$deployed_version" ]]; then
        echo "  Deployed version:    $deployed_version"
    else
        echo "  Deployed version:    (not deployed yet)"
    fi
    echo ""
}

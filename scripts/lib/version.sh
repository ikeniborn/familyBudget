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
    "backend/Dockerfile"
    "bot/Dockerfile"
    "backend/requirements.txt"
    "bot/requirements.txt"
    "docker-compose.yml"
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

# Update all version files
# Args: new_version, repo_dir
update_all_version_files() {
    local new_version="$1"
    local repo_dir="${2:-$SCRIPT_DIR}"

    info "Updating version to $new_version in all files..."

    # Update VERSION file (in repo)
    update_version_file "$new_version" "${repo_dir}/VERSION"

    # Update package.json (in repo)
    update_package_json "$new_version" "${repo_dir}/package.json"

    # Update .env in deployment directory (if exists)
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        update_env_version "$new_version" "$DEPLOY_DIR/.env"
    fi

    success "Version updated to $new_version"
}

# =============================================================================
# REBUILD DETECTION FUNCTIONS
# =============================================================================

# Check if Docker images need to be rebuilt
# Args: repo_dir
# Returns: 0 if rebuild needed, 1 if not needed
needs_docker_rebuild() {
    local repo_dir="${1:-$SCRIPT_DIR}"

    # If no previous deployment, always rebuild
    if [[ ! -f "$DEPLOY_DIR/.last_deployed_version" ]]; then
        info "First deployment - Docker rebuild required"
        return 0
    fi

    # Get list of changed files since last deployment
    local last_version
    last_version=$(cat "$DEPLOY_DIR/.last_deployed_version" 2>/dev/null || echo "")

    if [[ -z "$last_version" ]]; then
        info "No previous version found - Docker rebuild required"
        return 0
    fi

    # Check if any rebuild trigger files changed
    for trigger_file in "${REBUILD_TRIGGER_FILES[@]}"; do
        local full_path="${repo_dir}/${trigger_file}"
        local deploy_path="${DEPLOY_DIR}/${trigger_file}"

        if [[ -f "$full_path" ]]; then
            # Compare with deployed version
            if [[ ! -f "$deploy_path" ]]; then
                info "New file detected: $trigger_file - Docker rebuild required"
                return 0
            fi

            # Compare checksums
            local repo_checksum deploy_checksum
            repo_checksum=$(md5sum "$full_path" 2>/dev/null | cut -d' ' -f1)
            deploy_checksum=$(md5sum "$deploy_path" 2>/dev/null | cut -d' ' -f1)

            if [[ "$repo_checksum" != "$deploy_checksum" ]]; then
                info "Changed: $trigger_file - Docker rebuild required"
                return 0
            fi
        fi
    done

    info "No rebuild trigger files changed - Docker rebuild not required"
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
# This is the main entry point called from deploy.sh
# Args: repo_dir
# Returns: Sets and exports CURRENT_VERSION, NEW_VERSION, DOCKER_REBUILD_NEEDED variables
process_version_bump() {
    local repo_dir="${1:-$SCRIPT_DIR}"

    step "Version Management"

    # Get current version
    CURRENT_VERSION=$(get_current_version "${repo_dir}/VERSION")
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

    # Update version files if version changed
    if [[ "$NEW_VERSION" != "$CURRENT_VERSION" ]]; then
        update_all_version_files "$NEW_VERSION" "$repo_dir"
    fi

    # Check if Docker rebuild needed
    DOCKER_REBUILD_NEEDED=false
    if needs_docker_rebuild "$repo_dir"; then
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

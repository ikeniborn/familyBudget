#!/bin/bash
#
# Registry Functions - Container Registry Integration
#
# This module provides functions for pulling Docker images from GitHub Container Registry
# instead of building them locally.
#
# Dependencies: config.sh, utils.sh
#
# Functions:
# - pull_from_registry() - Pull Docker images from ghcr.io
# - determine_image_tag() - Determine image tag from VERSION or git hash
# - validate_registry_images() - Validate that images exist in registry
#

# Registry configuration
REGISTRY_URL="${REGISTRY_URL:-ghcr.io}"
REGISTRY_OWNER="${REGISTRY_OWNER:-ikeniborn}"

# Pull Docker images from container registry
# Usage: pull_from_registry [service...]
# If no services specified, pulls all services based on DEPLOYMENT_PROFILE
pull_from_registry() {
    local services=("$@")

    # Determine services to pull based on deployment profile if not specified
    if [[ ${#services[@]} -eq 0 ]]; then
        # Load .env to get DEPLOYMENT_PROFILE
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            set -a
            source "$DEPLOY_DIR/.env" 2>/dev/null || true
            set +a
        fi

        # Registry-first architecture: Pull ALL 5 custom images
        # PostgreSQL, Redis, Nginx use custom images with embedded configs
        services=("backend" "postgresql" "redis")
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            services+=("bot" "nginx")
        fi
    fi

    info "Pulling Docker images from registry..."
    info "Registry: $REGISTRY_URL/$REGISTRY_OWNER"
    echo ""

    # Check if IMAGE_VERSIONS.json exists (contains individual versions per service)
    local image_versions_file="$DEPLOY_DIR/IMAGE_VERSIONS.json"
    local use_image_versions=false
    if [[ -f "$image_versions_file" ]]; then
        use_image_versions=true
        info "Using IMAGE_VERSIONS.json for per-service versioning"
    else
        warning "IMAGE_VERSIONS.json not found, falling back to single VERSION"
    fi

    # Pull images for each service
    local pull_failed=false
    for service in "${services[@]}"; do
        # Determine image tag for this service
        local image_tag
        if [[ "$use_image_versions" == "true" ]]; then
            # Read version from IMAGE_VERSIONS.json for this service
            image_tag=$(jq -r ".${service}.version // empty" "$image_versions_file" 2>/dev/null)
            if [[ -z "$image_tag" ]]; then
                warning "$service not found in IMAGE_VERSIONS.json, using fallback"
                image_tag=$(determine_image_tag)
            fi
        else
            # Fallback to single version from VERSION file
            image_tag=$(determine_image_tag)
        fi

        if [[ $? -ne 0 || -z "$image_tag" ]]; then
            error "Failed to determine image tag for $service"
            pull_failed=true
            continue
        fi

        local image_name="$REGISTRY_URL/$REGISTRY_OWNER/familybudget-$service:$image_tag"

        info "Pulling $service image (version: $image_tag)..."
        if docker pull "$image_name" >> "$LOG_FILE" 2>&1; then
            success "$service image pulled successfully"

            # Tag image for docker-compose compatibility
            # Docker Compose expects image name without registry/owner prefix
            if docker tag "$image_name" "familybudget-$service:latest" >> "$LOG_FILE" 2>&1; then
                debug "Tagged $image_name as familybudget-$service:latest"
            else
                warning "Failed to tag image for docker-compose"
            fi
        else
            error "Failed to pull $service image: $image_name"
            pull_failed=true
        fi
    done

    echo ""

    if [[ "$pull_failed" == "true" ]]; then
        return 1
    fi

    return 0
}

# Determine image tag from VERSION file or git hash
# Returns: Tag string (e.g., "6.6.0", "test", or short git hash)
determine_image_tag() {
    local tag=""

    # Priority 1: USER_IMAGE_TAG environment variable (manual override)
    if [[ -n "${USER_IMAGE_TAG:-}" ]]; then
        tag="$USER_IMAGE_TAG"
        debug "Using user-specified tag: $tag" >&2
        echo "$tag"
        return 0
    fi

    # Priority 2: Git branch name (from repository directory)
    if [[ -n "${REPO_DIR:-}" && -d "$REPO_DIR/.git" ]]; then
        local branch_name
        branch_name=$(cd "$REPO_DIR" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
        if [[ -n "$branch_name" && "$branch_name" != "HEAD" ]]; then
            tag="$branch_name"
            debug "Using git branch tag: $tag" >&2
            echo "$tag"
            return 0
        fi
    fi

    # Priority 3: VERSION file in deployment directory
    if [[ -f "$DEPLOY_DIR/VERSION" ]]; then
        tag=$(cat "$DEPLOY_DIR/VERSION" | tr -d '[:space:]')
        if [[ -n "$tag" ]]; then
            debug "Using VERSION file tag: $tag" >&2
            echo "$tag"
            return 0
        fi
    fi

    # Priority 4: Short git hash (from repository directory)
    if [[ -n "${REPO_DIR:-}" && -d "$REPO_DIR/.git" ]]; then
        tag=$(cd "$REPO_DIR" && git rev-parse --short HEAD 2>/dev/null)
        if [[ -n "$tag" ]]; then
            debug "Using git hash tag: $tag" >&2
            echo "$tag"
            return 0
        fi
    fi

    # Fallback: Use "latest" tag
    tag="latest"
    warning "Could not determine specific tag, using: $tag"
    echo "$tag"
    return 0
}

# Validate that required images exist in registry
# Usage: validate_registry_images [service...]
# Returns: 0 if all images exist, 1 otherwise
validate_registry_images() {
    local services=("$@")

    # Determine services to validate based on deployment profile if not specified
    if [[ ${#services[@]} -eq 0 ]]; then
        # Load .env to get DEPLOYMENT_PROFILE
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            set -a
            source "$DEPLOY_DIR/.env" 2>/dev/null || true
            set +a
        fi

        # Registry-first architecture: Validate ALL 5 custom images
        services=("backend" "postgresql" "redis")
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            services+=("bot" "nginx")
        fi
    fi

    info "Validating registry images..."
    info "Registry: $REGISTRY_URL/$REGISTRY_OWNER"
    echo ""

    # Check if IMAGE_VERSIONS.json exists (contains individual versions per service)
    local image_versions_file="$DEPLOY_DIR/IMAGE_VERSIONS.json"
    local use_image_versions=false
    if [[ -f "$image_versions_file" ]]; then
        use_image_versions=true
        info "Using IMAGE_VERSIONS.json for per-service versioning"
    else
        warning "IMAGE_VERSIONS.json not found, falling back to single VERSION"
    fi

    # Check each service image
    local validation_failed=false
    for service in "${services[@]}"; do
        # Determine image tag for this service
        local image_tag
        if [[ "$use_image_versions" == "true" ]]; then
            # Read version from IMAGE_VERSIONS.json for this service
            image_tag=$(jq -r ".${service}.version // empty" "$image_versions_file" 2>/dev/null)
            if [[ -z "$image_tag" ]]; then
                warning "$service not found in IMAGE_VERSIONS.json, using fallback"
                image_tag=$(determine_image_tag)
            fi
        else
            # Fallback to single version from VERSION file
            image_tag=$(determine_image_tag)
        fi

        if [[ $? -ne 0 || -z "$image_tag" ]]; then
            error "Failed to determine image tag for $service"
            validation_failed=true
            continue
        fi

        local image_name="$REGISTRY_URL/$REGISTRY_OWNER/familybudget-$service:$image_tag"

        info "Checking $service image (version: $image_tag): $image_name"

        # Use docker manifest inspect to check if image exists without pulling
        if docker manifest inspect "$image_name" > /dev/null 2>&1; then
            success "$service image exists in registry"
        else
            error "$service image NOT found in registry: $image_name"
            validation_failed=true
        fi
    done

    echo ""

    if [[ "$validation_failed" == "true" ]]; then
        error "Some images are missing from registry"
        info "Possible solutions:"
        info "  1. Push images to registry using CI/CD workflow"
        info "  2. Build images locally without --use-registry flag"
        info "  3. Check IMAGE_VERSIONS.json for correct per-service versions"
        return 1
    fi

    success "All required images exist in registry"
    return 0
}

# Log deployment to history file
# Usage: log_deployment_history <mode> <image_tag> <result>
# Arguments:
#   mode: "build" or "registry"
#   image_tag: Image tag used (e.g., "test", "6.6.0")
#   result: "success" or "failure"
log_deployment_history() {
    local mode="$1"
    local image_tag="$2"
    local result="$3"

    local history_file="$DEPLOY_DIR/logs/deployment-history.log"
    mkdir -p "$(dirname "$history_file")"

    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local user="${SUDO_USER:-$USER}"

    echo "[$timestamp] mode=$mode tag=$image_tag result=$result user=$user" >> "$history_file"

    # Keep only last 100 entries
    if [[ -f "$history_file" ]]; then
        tail -n 100 "$history_file" > "${history_file}.tmp" && mv "${history_file}.tmp" "$history_file"
    fi
}

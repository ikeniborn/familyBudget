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
        if docker image inspect "$image_name" > /dev/null 2>&1; then
            success "$service image already present locally (version: $image_tag)"
        elif docker pull "$image_name" >> "$LOG_FILE" 2>&1; then
            success "$service image pulled successfully (version: $image_tag)"
            # Перетегирование УДАЛЕНО - docker-compose использует ghcr.io образы напрямую
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
# Check image existence via GHCR HTTP API with OCI Accept headers.
# Workaround for docker manifest inspect failing on OCI image indexes
# when daemon credentials/experimental flags are stale.
# Usage: check_image_via_api <service> <tag>
# Returns: 0 if manifest is reachable (HTTP 200), 1 otherwise
check_image_via_api() {
    local service="$1"
    local tag="$2"
    local repo="$REGISTRY_OWNER/familybudget-$service"
    local token

    token=$(curl -fsS "https://${REGISTRY_URL}/token?service=${REGISTRY_URL}&scope=repository:${repo}:pull" 2>/dev/null \
        | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')
    [[ -z "$token" ]] && return 1

    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Authorization: Bearer $token" \
        -H "Accept: application/vnd.docker.distribution.manifest.v2+json" \
        -H "Accept: application/vnd.oci.image.manifest.v1+json" \
        -H "Accept: application/vnd.oci.image.index.v1+json" \
        "https://${REGISTRY_URL}/v2/${repo}/manifests/${tag}")
    [[ "$code" == "200" ]]
}

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

        # Use docker manifest inspect to check if image exists without pulling.
        # Fallback to curl with OCI Accept headers — docker manifest inspect can
        # fail for OCI image indexes when the daemon's auth/feature flags lag.
        if docker manifest inspect "$image_name" > /dev/null 2>&1; then
            success "$service image exists in registry"
        elif check_image_via_api "$service" "$image_tag"; then
            success "$service image exists in registry (via API)"
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

# Generate .env file from IMAGE_VERSIONS.json for docker-compose
# Returns: 0 on success, 1 on error
generate_env_from_image_versions() {
    local image_versions_file="$DEPLOY_DIR/IMAGE_VERSIONS.json"
    local env_file="$DEPLOY_DIR/.env"

    if [[ ! -f "$image_versions_file" ]]; then
        error "IMAGE_VERSIONS.json not found: $image_versions_file"
        return 1
    fi

    if ! jq empty "$image_versions_file" 2>/dev/null; then
        error "IMAGE_VERSIONS.json is corrupted (invalid JSON)"
        return 1
    fi

    info "Generating .env file from IMAGE_VERSIONS.json..."

    # Read versions for each service
    local backend_ver=$(jq -r '.backend.version // "latest"' "$image_versions_file")
    local bot_ver=$(jq -r '.bot.version // "latest"' "$image_versions_file")
    local nginx_ver=$(jq -r '.nginx.version // "latest"' "$image_versions_file")
    local redis_ver=$(jq -r '.redis.version // "latest"' "$image_versions_file")
    local postgresql_ver=$(jq -r '.postgresql.version // "latest"' "$image_versions_file")

    # Append to .env (or update if exists)
    # Use temp file for atomic update
    local temp_env="${env_file}.tmp"

    # Copy existing .env, removing old version variables and their auto-generated comments
    if [[ -f "$env_file" ]]; then
        # Filter out version variables and their section comments (exit code 1 if no matches is OK)
        grep -v -E '^(BACKEND|BOT|NGINX|REDIS|POSTGRESQL)_VERSION=|^# Image versions \(auto-generated|^# Updated: [0-9]{4}-[0-9]{2}' "$env_file" > "$temp_env" 2>/dev/null || : > "$temp_env"
        # Remove trailing empty lines to prevent accumulation on each deploy
        if [[ -s "$temp_env" ]]; then
            awk 'NF{found=NR} {lines[NR]=$0} END{for(i=1;i<=found;i++) print lines[i]}' "$temp_env" > "${temp_env}.clean" && mv "${temp_env}.clean" "$temp_env"
        fi
    else
        touch "$temp_env"
    fi

    # Append version variables
    {
        echo ""
        echo "# Image versions (auto-generated from IMAGE_VERSIONS.json)"
        echo "# Updated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
        echo "BACKEND_VERSION=${backend_ver}"
        echo "BOT_VERSION=${bot_ver}"
        echo "NGINX_VERSION=${nginx_ver}"
        echo "REDIS_VERSION=${redis_ver}"
        echo "POSTGRESQL_VERSION=${postgresql_ver}"
    } >> "$temp_env"

    # Atomic move
    mv "$temp_env" "$env_file"
    chmod 600 "$env_file"  # Protect sensitive data

    success "Generated .env with versions:"
    info "  BACKEND_VERSION=${backend_ver}"
    info "  BOT_VERSION=${bot_ver}"
    info "  NGINX_VERSION=${nginx_ver}"
    info "  REDIS_VERSION=${redis_ver}"
    info "  POSTGRESQL_VERSION=${postgresql_ver}"
    echo ""

    return 0
}

# Compare running container images with pulled images from registry
# Sets NEEDS_*_RECREATE=true if running image differs from pulled image or container is unhealthy
# Returns: 0 on success, 1 on error
compare_running_vs_pulled_images() {
    local env_file="$DEPLOY_DIR/.env"
    local image_versions_file="$DEPLOY_DIR/IMAGE_VERSIONS.json"

    if [[ ! -f "$env_file" ]]; then
        error ".env file not found: $env_file"
        return 1
    fi

    if [[ ! -f "$image_versions_file" ]]; then
        error "IMAGE_VERSIONS.json not found: $image_versions_file"
        return 1
    fi

    info "Comparing running containers with pulled images..."

    # Load environment variables from .env
    set -a
    source "$env_file"
    set +a

    local services=("backend" "bot" "nginx")
    local recreate_count=0

    for service in "${services[@]}"; do
        local container_name="familybudget-${service}"
        local version_var="${service^^}_VERSION"
        local desired_version="${!version_var:-latest}"
        local desired_image="ghcr.io/ikeniborn/familybudget-${service}:${desired_version}"

        # Check if container exists
        if ! docker ps -a --format '{{.Names}}' | grep -q "^${container_name}$"; then
            info "  → ${service}: Container not found (will be created)"
            export "NEEDS_${service^^}_RECREATE=true"
            ((recreate_count++))
            continue
        fi

        # Get running container image
        local running_image=$(docker inspect "$container_name" --format '{{.Config.Image}}' 2>/dev/null)
        if [[ -z "$running_image" ]]; then
            warn "  → ${service}: Failed to get running image (will recreate)"
            export "NEEDS_${service^^}_RECREATE=true"
            ((recreate_count++))
            continue
        fi

        # Get running container health status
        local health_status=$(docker inspect "$container_name" --format '{{.State.Health.Status}}' 2>/dev/null || echo "none")

        # Get image IDs for comparison (more reliable than tag comparison)
        local running_image_id=$(docker inspect "$running_image" --format '{{.Id}}' 2>/dev/null | cut -d':' -f2 | cut -c1-12)
        local desired_image_id=$(docker inspect "$desired_image" --format '{{.Id}}' 2>/dev/null | cut -d':' -f2 | cut -c1-12)

        if [[ -z "$running_image_id" ]] || [[ -z "$desired_image_id" ]]; then
            warn "  → ${service}: Failed to get image IDs (will recreate)"
            export "NEEDS_${service^^}_RECREATE=true"
            ((recreate_count++))
            continue
        fi

        # Decision logic: recreate if images differ OR container unhealthy
        if [[ "$running_image_id" != "$desired_image_id" ]]; then
            info "  → ${service}: Image changed (${running_image_id} → ${desired_image_id})"
            export "NEEDS_${service^^}_RECREATE=true"
            ((recreate_count++))
        elif [[ "$health_status" == "unhealthy" ]]; then
            warn "  → ${service}: Container unhealthy (will recreate)"
            export "NEEDS_${service^^}_RECREATE=true"
            ((recreate_count++))
        else
            info "  ✓ ${service}: Up-to-date and healthy (${running_image_id})"
            export "NEEDS_${service^^}_RECREATE=false"
        fi
    done

    if [[ $recreate_count -gt 0 ]]; then
        info "Services requiring recreation: $recreate_count"
    else
        info "All services up-to-date and healthy"
    fi

    return 0
}

# Display deployment versions from IMAGE_VERSIONS.json
# Returns: 0 on success, 1 on error
display_deployment_versions() {
    local image_versions_file="$DEPLOY_DIR/IMAGE_VERSIONS.json"

    if [[ ! -f "$image_versions_file" ]]; then
        error "IMAGE_VERSIONS.json not found: $image_versions_file"
        return 1
    fi

    if ! jq empty "$image_versions_file" 2>/dev/null; then
        error "IMAGE_VERSIONS.json is corrupted (invalid JSON)"
        return 1
    fi

    info "Deployment Versions Summary:"
    echo ""

    # Table header
    printf "  %-12s %-10s %-10s %-20s\n" "Service" "Version" "Hash" "Last Modified"
    printf "  %-12s %-10s %-10s %-20s\n" "$(printf '%.0s-' {1..12})" "$(printf '%.0s-' {1..10})" "$(printf '%.0s-' {1..10})" "$(printf '%.0s-' {1..20})"

    # Read services dynamically from JSON
    local services=$(jq -r 'keys[]' "$image_versions_file" 2>/dev/null)
    local count=0

    while IFS= read -r service; do
        local version=$(jq -r ".${service}.version" "$image_versions_file" 2>/dev/null)
        local hash=$(jq -r ".${service}.hash" "$image_versions_file" 2>/dev/null)
        local modified=$(jq -r ".${service}.lastModified" "$image_versions_file" 2>/dev/null | cut -d'T' -f1)

        # Truncate hash to 10 characters for formatting
        if [[ ${#hash} -gt 10 ]]; then
            hash="${hash:0:10}"
        fi

        printf "  %-12s %-10s %-10s %-20s\n" "$service" "$version" "$hash" "$modified"
        ((count++))
    done <<< "$services"

    echo ""
    info "Total services: $count"
    echo ""

    return 0
}

# Confirm deployment versions interactively
# Returns: 0 if confirmed, 1 if declined
confirm_deployment_versions() {
    display_deployment_versions || return 1

    # Non-interactive mode
    if [[ ! -t 0 ]]; then
        info "Non-interactive mode: auto-confirming versions"
        return 0
    fi

    # Interactive prompt
    echo ""
    read -p "Deploy these versions? [Y/n]: " -r
    echo ""

    if [[ $REPLY =~ ^[Yy]?$ ]]; then
        success "Deployment versions confirmed"
        return 0
    else
        warning "Deployment cancelled by user"
        return 1
    fi
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

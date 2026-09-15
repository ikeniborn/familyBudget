#!/bin/bash
#
# services.sh - Service Management
#
# This module provides functions for managing Docker service lifecycle.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/services.sh
#
# Dependencies:
#   - config.sh (for CLEAN_DEPLOY, COMPOSE_PROFILE, MAX_WAIT_TIME, CHECK_INTERVAL)
#   - utils.sh (for logging, compose_cmd)
#

# Clear Python bytecode cache from mounted backend directory
# CRITICAL: Python caches .pyc files in __pycache__ which persist across container restarts
# because backend code is mounted as read-only from host (/opt/budget/backend:/app/backend:ro)
# Without clearing cache, Python may use old bytecode even after .py files are updated
clear_python_cache() {
    info "Clearing Python bytecode cache from backend directory..."

    local cache_count
    cache_count=$(find "$DEPLOY_DIR/backend" -type d -name "__pycache__" 2>/dev/null | wc -l)

    if [[ $cache_count -gt 0 ]]; then
        info "Found $cache_count __pycache__ directories, removing..."
        find "$DEPLOY_DIR/backend" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        success "Python bytecode cache cleared"
    else
        info "No Python cache found (already clean)"
    fi
}

# Stop existing services
stop_services() {
    info "Checking for running services..."

    local running_containers
    running_containers=$(compose_cmd ps -q 2>/dev/null || echo "")

    if [[ -n "$running_containers" ]]; then
        warning "Found running services, stopping..."
        compose_cmd down >> "$LOG_FILE" 2>&1 || true
        success "Services stopped"
    else
        info "No running services found"
    fi
}

# Start services
start_services() {
    step "Starting services..."

    # Load .env to get DEPLOYMENT_PROFILE
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a
    fi

    info "Starting services in detached mode (background)..."
    local start_result=0

    # CRITICAL: Clear Python bytecode cache before starting containers
    # This prevents old .pyc files from being used when .py files were updated
    clear_python_cache

    # Registry-first mode: Images already pulled from ghcr.io
    # No local build needed, just start containers
    local build_flag=""  # NEVER use --build in registry-first mode

    info "Using pre-pulled images from GitHub Container Registry"
    info "Images are ready to start (no build required)"

    # Check if PostgreSQL should be kept running (selective restart)
    if [[ "${POSTGRES_WAS_STOPPED:-true}" == "false" ]]; then
        info "Selective restart detected - PostgreSQL will keep running"
        info "Strategy: --no-recreate for postgres only, recreate backend/bot to clear Python cache"

        # Step 1: Keep PostgreSQL running with --no-recreate
        info "Starting postgres with --no-recreate..."
        compose_cmd up $build_flag -d --no-recreate postgres >> "$LOG_FILE" 2>&1
        start_result=$?

        if [[ $start_result -eq 0 ]]; then
            # Step 2: Recreate backend/bot/traefik (clears Python .pyc cache)
            info "Recreating backend/bot/traefik (fresh containers for cache invalidation)..."
            if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
                compose_cmd --profile full up $build_flag -d backend bot traefik >> "$LOG_FILE" 2>&1
                start_result=$?
            else
                compose_cmd up $build_flag -d backend >> "$LOG_FILE" 2>&1
                start_result=$?
            fi
        fi
    else
        # Full restart - recreate all containers
        info "Full restart - all containers will be recreated"

        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            compose_cmd --profile full up $build_flag -d >> "$LOG_FILE" 2>&1
            start_result=$?
        else
            compose_cmd up $build_flag -d >> "$LOG_FILE" 2>&1
            start_result=$?
        fi
    fi

        # Show detailed container status
        info "Checking container status..."
        echo "" | tee -a "$LOG_FILE"
        compose_cmd ps -a | tee -a "$LOG_FILE"
        echo "" | tee -a "$LOG_FILE"

        # Wait for containers to stabilize (give healthchecks time to run)
        info "Waiting for containers to stabilize (10 seconds)..."
        sleep 10

        # Check for unhealthy containers
        local unhealthy_containers=$(compose_cmd ps --format json 2>/dev/null | jq -r 'select(.Health == "unhealthy") | .Name' 2>/dev/null || echo "")

        if [[ -n "$unhealthy_containers" ]]; then
            warning "Found unhealthy containers:"
            echo "$unhealthy_containers" | tee -a "$LOG_FILE"

            # Show logs for each unhealthy container
            while IFS= read -r container; do
                if [[ -n "$container" ]]; then
                    warning "Showing logs for unhealthy container: $container"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
                    compose_cmd logs --tail=50 "${container#familybudget-}" 2>&1 | tee -a "$LOG_FILE"
                    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG_FILE"
                fi
            done <<< "$unhealthy_containers"
        fi

    if [[ $start_result -eq 0 ]]; then
        if [[ -n "$unhealthy_containers" ]]; then
            warning "Services started but some containers are unhealthy. Check logs above."
        else
            success "Services started successfully"

            # REMOVED (v9.0): Docker build checksums not needed in registry-first mode
            # Versions are determined by IMAGE_VERSIONS.json (generated in CI/CD)
            # No local builds = no checksums to track
        fi
    else
        error "Failed to start services. Check $LOG_FILE for details."
    fi
}

# Show service logs for debugging
# Usage: show_service_logs <service_name> [lines_count]
show_service_logs() {
    local service_name=$1
    local lines_count=${2:-50}

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 DIAGNOSTICS: $service_name"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Container status
    echo "▶ Container Status:"
    compose_cmd ps "$service_name" 2>&1 || echo "Failed to get container status"
    echo ""

    # Container details (health check, exit code, etc.)
    local container_id
    container_id=$(compose_cmd ps -q "$service_name" 2>/dev/null || echo "")

    if [[ -n "$container_id" ]]; then
        echo "▶ Container Details:"
        docker inspect "$container_id" --format='
  Status: {{.State.Status}}
  {{- if .State.Health}}
  Health: {{.State.Health.Status}}
  {{- end}}
  {{- if .State.ExitCode}}
  Exit Code: {{.State.ExitCode}}
  {{- end}}
  {{- if .State.Error}}
  Error: {{.State.Error}}
  {{- end}}
  Started At: {{.State.StartedAt}}
  {{- if .State.FinishedAt}}
  Finished At: {{.State.FinishedAt}}
  {{- end}}' 2>&1 || echo "Failed to inspect container"
        echo ""

        # Healthcheck log (if exists)
        local health_log
        health_log=$(docker inspect "$container_id" --format='{{range .State.Health.Log}}{{.Output}}{{end}}' 2>/dev/null || echo "")
        if [[ -n "$health_log" ]]; then
            echo "▶ Health Check Log:"
            echo "$health_log" | head -10
            echo ""
        fi
    fi

    # Recent logs
    echo "▶ Last $lines_count lines of logs:"
    echo "──────────────────────────────────────────────────────────────────────────"
    compose_cmd logs --tail="$lines_count" "$service_name" 2>&1 || echo "Failed to get logs"
    echo "──────────────────────────────────────────────────────────────────────────"
    echo ""

    # Recommendations
    echo "💡 Troubleshooting Steps:"
    echo "  1. Check logs above for error messages"
    echo "  2. Verify .env file has correct configuration"
    echo "  3. Check if required ports are available:"
    echo "     ss -tulnp | grep -E ':(80|443|8000|5432)'"
    echo "  4. View full logs: cd $DEPLOY_DIR && docker compose logs -f $service_name"
    echo "  5. Restart service: cd $DEPLOY_DIR && docker compose restart $service_name"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Wait for service to be healthy
wait_for_service() {
    local service_name=$1
    local max_wait=$2
    local elapsed=0

    info "Waiting for $service_name to be healthy (max ${max_wait}s)..."

    while [[ $elapsed -lt $max_wait ]]; do
        local status=$(get_service_status "$service_name")

        case "$status" in
            "healthy")
                success "$service_name is healthy (${elapsed}s)"
                return 0
                ;;
            "running")
                success "$service_name is running (${elapsed}s)"
                return 0
                ;;
            "starting")
                echo -n "."
                ;;
            "unhealthy")
                # Container is unhealthy - show logs immediately
                echo ""
                warning "$service_name is unhealthy after ${elapsed}s"
                show_service_logs "$service_name" 100
                error "$service_name is unhealthy. Check diagnostics above."
                ;;
            *)
                # Unknown status - continue waiting but show warning
                warning "$service_name status: $status"
                ;;
        esac

        sleep "$CHECK_INTERVAL"
        elapsed=$((elapsed + CHECK_INTERVAL))
    done

    # Timeout reached - show logs for debugging
    echo ""
    warning "$service_name failed to become healthy within ${max_wait}s"
    show_service_logs "$service_name" 100
    error "$service_name failed health check. Check diagnostics above."
}

# Wait for all services
wait_for_services() {
    step "Waiting for services to become healthy..."

    # Get list of running services
    local services
    services=$(compose_cmd ps --services 2>/dev/null || echo "")

    if [[ -z "$services" ]]; then
        error "No services found. Deployment may have failed."
    fi

    # Wait for each service
    for service in $services; do
        wait_for_service "$service" "$MAX_WAIT_TIME"
    done

    echo ""
    success "All services are healthy"
}

# Verify all services final status
# Shows summary and detailed diagnostics for unhealthy services
verify_all_services() {
    step "Verifying final deployment status..."

    # Get list of running services
    local services
    services=$(compose_cmd ps --services 2>/dev/null || echo "")

    if [[ -z "$services" ]]; then
        error "No services found"
    fi

    local healthy_count=0
    local unhealthy_count=0
    local unhealthy_services=()

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 SERVICES HEALTH STATUS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Check each service
    for service in $services; do
        local status=$(get_service_status "$service")

        case "$status" in
            "healthy")
                echo "  ✓ $service: healthy"
                healthy_count=$((healthy_count + 1))
                ;;
            "running")
                echo "  ✓ $service: running (no healthcheck)"
                healthy_count=$((healthy_count + 1))
                ;;
            "unhealthy")
                echo "  ✗ $service: UNHEALTHY"
                unhealthy_count=$((unhealthy_count + 1))
                unhealthy_services+=("$service")
                ;;
            *)
                echo "  ⚠ $service: $status"
                unhealthy_count=$((unhealthy_count + 1))
                unhealthy_services+=("$service")
                ;;
        esac
    done

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Summary: $healthy_count healthy, $unhealthy_count unhealthy"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Show diagnostics for unhealthy services
    if [[ $unhealthy_count -gt 0 ]]; then
        warning "Found $unhealthy_count unhealthy service(s). Showing diagnostics..."
        echo ""

        for service in "${unhealthy_services[@]}"; do
            show_service_logs "$service" 100
        done

        error "Deployment completed with errors. $unhealthy_count service(s) are unhealthy."
    else
        success "All services are healthy"
    fi
}

# Install systemd service for auto-restart on boot
# This ensures containers start automatically after server reboot
# and repairs PostgreSQL directories before startup
install_systemd_service() {
    step "Installing systemd service for auto-restart..."

    local service_src="$DEPLOY_DIR/scripts/familybudget.service"
    local service_dst="/etc/systemd/system/familybudget.service"

    # Check if service file exists in deployment
    if [[ ! -f "$service_src" ]]; then
        warning "Systemd service file not found: $service_src"
        warning "Containers will NOT auto-start after server reboot"
        return 0
    fi

    # Check if already installed and up-to-date
    if [[ -f "$service_dst" ]]; then
        if diff -q "$service_src" "$service_dst" > /dev/null 2>&1; then
            info "Systemd service already installed and up-to-date"
            # Ensure it's enabled
            if ! systemctl is-enabled familybudget.service > /dev/null 2>&1; then
                systemctl enable familybudget.service >> "$LOG_FILE" 2>&1
                success "Systemd service enabled"
            fi
            return 0
        fi
        info "Updating systemd service..."
    fi

    # Install service file
    cp "$service_src" "$service_dst" || {
        error "Failed to install systemd service"
        return 1
    }

    # Reload systemd daemon
    systemctl daemon-reload >> "$LOG_FILE" 2>&1 || {
        error "Failed to reload systemd daemon"
        return 1
    }

    # Enable service
    systemctl enable familybudget.service >> "$LOG_FILE" 2>&1 || {
        error "Failed to enable systemd service"
        return 1
    }

    success "Systemd service installed and enabled"
    info "Containers will auto-start after server reboot"
}

# Start services in phases to avoid race conditions
# Phase 1: Start only PostgreSQL
start_postgres_only() {
    step "Starting PostgreSQL (Phase 1/2)"

    # Smart restart: determine recreate strategy based on changes
    local recreate_flag=""
    local recreate_reason=""

    if [[ "${NEEDS_POSTGRES_RECREATE:-false}" == "true" ]]; then
        recreate_flag="--force-recreate"
        recreate_reason="migrations/config changed"
    elif [[ "${NEEDS_FULL_RESTART:-false}" == "true" ]]; then
        recreate_flag="--force-recreate"
        recreate_reason="docker-compose.yml global changes"
    else
        recreate_flag="--no-recreate"
        recreate_reason="no changes detected"
    fi

    if [[ "$recreate_flag" == "--force-recreate" ]]; then
        info "PostgreSQL will be recreated ($recreate_reason)"
    else
        info "PostgreSQL will be kept running ($recreate_reason)"
    fi

    info "Starting postgres container..."
    local start_result=0

    # Registry-first mode: Use pre-pulled images (no --build)
    compose_cmd up -d $recreate_flag postgres >> "$LOG_FILE" 2>&1
    start_result=$?

    if [[ $start_result -eq 0 ]]; then
        success "PostgreSQL container started"

        # Wait for PostgreSQL to become healthy
        info "Waiting for PostgreSQL to be ready..."
        if wait_for_service "postgres" 60; then
            success "PostgreSQL is healthy and ready"
            return 0
        else
            error "PostgreSQL failed to become healthy"
            return 1
        fi
    else
        error "Failed to start PostgreSQL container. Check $LOG_FILE for details."
        return 1
    fi
}

# Phase 1.2: Start Redis container only (dependency for backend)
# Redis must be healthy before backend can start (backend depends_on redis with service_healthy)
start_redis_only() {
    step "Starting Redis (Phase 1.2/3)"

    # Smart restart: determine recreate strategy based on changes
    local recreate_flag=""
    local recreate_reason=""

    if [[ "${NEEDS_REDIS_RECREATE:-false}" == "true" ]]; then
        recreate_flag="--force-recreate"
        recreate_reason="config/code changed"
    elif [[ "${NEEDS_FULL_RESTART:-false}" == "true" ]]; then
        recreate_flag="--force-recreate"
        recreate_reason="docker-compose.yml global changes"
    else
        recreate_flag="--no-recreate"
        recreate_reason="no changes detected"
    fi

    if [[ "$recreate_flag" == "--force-recreate" ]]; then
        info "Redis will be recreated ($recreate_reason)"
    else
        info "Redis will be kept running ($recreate_reason)"
    fi

    info "Starting redis container..."
    local start_result=0

    # Registry-first mode: Use pre-pulled images (no --build)
    compose_cmd up -d $recreate_flag redis >> "$LOG_FILE" 2>&1
    start_result=$?

    if [[ $start_result -eq 0 ]]; then
        success "Redis container started"

        # Wait for Redis to become healthy
        info "Waiting for Redis to be ready..."
        if wait_for_service "redis" 30; then
            success "Redis is healthy and ready"
            return 0
        else
            error "Redis failed to become healthy within 30s"
            return 1
        fi
    else
        error "Failed to start Redis container. Check $LOG_FILE for details."
        return 1
    fi
}

# Phase 1.5: Start backend container only (for migrations)
# Backend container starts but application doesn't listen on port yet
# This allows running migrations via 'docker compose exec backend'
start_backend_only() {
    step "Starting Backend Container (Phase 1.5/3)"

    info "Starting backend container for migrations..."
    local start_result=0

    # Registry-first mode: Use pre-pulled images (no --build)
    compose_cmd up -d backend >> "$LOG_FILE" 2>&1
    start_result=$?

    if [[ $start_result -eq 0 ]]; then
        success "Backend container started"

        # Wait for container to be running (but not necessarily healthy)
        info "Waiting for backend container to be ready..."
        local max_wait=30
        local elapsed=0
        while [[ $elapsed -lt $max_wait ]]; do
            if docker ps --filter "name=familybudget-backend" --filter "status=running" -q 2>/dev/null | grep -q .; then
                success "Backend container is running"
                return 0
            fi
            sleep 2
            elapsed=$((elapsed + 2))
        done

        error "Backend container failed to start within ${max_wait}s"
        return 1
    else
        error "Failed to start backend container. Check $LOG_FILE for details."
        return 1
    fi
}

# Clean up stuck or orphan containers that could cause naming conflicts
# This prevents "container name already in use" errors during deployment
cleanup_stuck_containers() {
    local project_name="familybudget"

    # Find containers with prefixed names (e.g., "abc123_familybudget-backend")
    # These are orphan containers created when docker-compose gets interrupted
    local orphan_containers
    orphan_containers=$(docker ps -a --format '{{.ID}} {{.Names}}' 2>/dev/null | \
        grep -E "_${project_name}-" | awk '{print $1}' || true)

    if [[ -n "$orphan_containers" ]]; then
        info "Removing orphan containers with prefixed names..."
        for container_id in $orphan_containers; do
            local container_name
            container_name=$(docker inspect --format '{{.Name}}' "$container_id" 2>/dev/null | sed 's/^\///')
            docker rm -f "$container_id" >> "$LOG_FILE" 2>&1 || true
            info "  Removed: $container_name"
        done
    fi

    # Find containers in "Created" state (stuck during creation)
    local created_containers
    created_containers=$(docker ps -a --filter "name=${project_name}" --filter "status=created" \
        --format '{{.ID}}' 2>/dev/null || true)

    if [[ -n "$created_containers" ]]; then
        info "Removing stuck containers in 'Created' state..."
        for container_id in $created_containers; do
            local container_name
            container_name=$(docker inspect --format '{{.Name}}' "$container_id" 2>/dev/null | sed 's/^\///')
            docker rm -f "$container_id" >> "$LOG_FILE" 2>&1 || true
            info "  Removed: $container_name"
        done
    fi
}

# Phase 2: Start application services (backend, bot, Traefik)
start_application_services() {
    step "Starting Application Services (Phase 2/2)"

    # Load .env to get DEPLOYMENT_PROFILE
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a
    fi

    info "Registry-first mode: Using pre-pulled images from ghcr.io"
    info "Starting backend/bot/traefik containers..."
    local start_result=0
    local build_flag=""  # Registry-first mode: never use --build

    # Clean up any stuck or orphan containers before starting
    # This prevents "container name already in use" errors
    cleanup_stuck_containers

    # =========================================================================
    # FULL RESTART MODE: Override selective restart if global changes detected
    # =========================================================================
    if [[ "${NEEDS_FULL_RESTART:-false}" == "true" ]]; then
        warning "Full restart mode enabled - all services will be recreated"
        warning "Reason: docker-compose.yml global changes (volumes/networks)"
        echo ""

        # Force recreate all services
        export NEEDS_BACKEND_RECREATE=true
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            export NEEDS_BOT_RECREATE=true
            export NEEDS_TRAEFIK_RECREATE=true
        fi

        info "All application services will be recreated"
        echo ""
    fi

    # Smart restart: selectively recreate containers based on changed files
    # Uses flags set by analyze_sync_changes() in sync.sh:
    # - NEEDS_POSTGRES_RECREATE: Migrations changed
    # - NEEDS_REDIS_RECREATE: Redis code/config changed
    # - NEEDS_BACKEND_RECREATE: Jinja2 templates, static files, Python code changed
    # - NEEDS_BOT_RECREATE: Bot Python code changed
    # - NEEDS_TRAEFIK_RECREATE: Traefik config changed
    # - NEEDS_FULL_RESTART: docker-compose.yml global changes

    info "Smart restart mode enabled:"
    info "  Backend recreate: ${NEEDS_BACKEND_RECREATE:-false}"
    if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
        info "  Bot recreate:     ${NEEDS_BOT_RECREATE:-false}"
        info "  Traefik recreate: ${NEEDS_TRAEFIK_RECREATE:-false}"
    fi
    echo ""

    # Strategy: Recreate only services with changes, keep others running
    # This is MUCH faster than full recreate (2-3 sec vs 10-15 sec per service)
    # and clears Python/Jinja2 cache only where needed

    local services_to_recreate=()
    local services_to_check=()

    # Determine which services need recreation
    if [[ "${NEEDS_BACKEND_RECREATE:-false}" == "true" ]]; then
        services_to_recreate+=("backend")
        info "✓ Backend will be recreated (code/templates changed)"
    else
        services_to_check+=("backend")
        info "  Backend will be kept running (no changes)"
    fi

    if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
        if [[ "${NEEDS_BOT_RECREATE:-false}" == "true" ]]; then
            services_to_recreate+=("bot")
            info "✓ Bot will be recreated (code changed)"
        else
            services_to_check+=("bot")
            info "  Bot will be kept running (no changes)"
        fi

        if [[ "${NEEDS_TRAEFIK_RECREATE:-false}" == "true" ]]; then
            services_to_recreate+=("traefik")
            info "✓ Traefik will be recreated (config changed)"
        else
            services_to_check+=("traefik")
            info "  Traefik will be kept running (no changes)"
        fi
    fi
    echo ""

    # Step 1: Recreate services with changes (--force-recreate)
    if [[ ${#services_to_recreate[@]} -gt 0 ]]; then
        info "Recreating ${#services_to_recreate[@]} service(s): ${services_to_recreate[*]}"
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            compose_cmd --profile full up $build_flag -d --force-recreate --remove-orphans "${services_to_recreate[@]}" >> "$LOG_FILE" 2>&1
            start_result=$?
        else
            compose_cmd up $build_flag -d --force-recreate --remove-orphans "${services_to_recreate[@]}" >> "$LOG_FILE" 2>&1
            start_result=$?
        fi

        if [[ $start_result -ne 0 ]]; then
            error "Failed to recreate services. Check $LOG_FILE for details."
            return 1
        fi
        success "Services recreated successfully"

    else
        info "No services need recreation (code unchanged)"
        start_result=0
    fi

    # Step 2: Ensure unchanged services are running (--no-recreate)
    # This doesn't rebuild or recreate, just ensures container is up
    if [[ ${#services_to_check[@]} -gt 0 ]]; then
        info "Ensuring ${#services_to_check[@]} service(s) are running: ${services_to_check[*]}"
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            compose_cmd --profile full up -d --no-recreate "${services_to_check[@]}" >> "$LOG_FILE" 2>&1
            local check_result=$?
        else
            compose_cmd up -d --no-recreate "${services_to_check[@]}" >> "$LOG_FILE" 2>&1
            local check_result=$?
        fi

        if [[ $check_result -ne 0 ]]; then
            warning "Some services may not be running. Check $LOG_FILE for details."
        else
            success "All services verified running"
        fi
    fi

    # Show container status
    info "Checking container status..."
    echo "" | tee -a "$LOG_FILE"
    compose_cmd ps -a | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"

    # Wait for containers to stabilize
    info "Waiting for containers to stabilize (10 seconds)..."
    sleep 10

    if [[ $start_result -eq 0 ]]; then
        success "Application services started successfully"

        # REMOVED (v9.0): Docker build checksums not needed in registry-first mode
        # Versions are determined by IMAGE_VERSIONS.json (generated in CI/CD)
        # No local builds = no checksums to track
        return 0
    else
        error "Failed to start application services. Check $LOG_FILE for details."
        return 1
    fi
}

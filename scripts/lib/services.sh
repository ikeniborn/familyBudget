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

    # Determine build strategy based on DOCKER_REBUILD_NEEDED
    # DOCKER_REBUILD_NEEDED is set by version.sh:process_version_bump()
    #
    # CRITICAL FIX (2025-12-08): When trigger files change (requirements.txt, Dockerfile),
    # we MUST use --no-cache to force fresh pip install. Docker's layer cache can
    # incorrectly reuse old layers even when file content changed.
    #
    # Without --no-cache: Docker may use cached pip install layer → missing new dependencies
    # With --no-cache: Forces fresh pip install → all dependencies correctly installed
    #
    # FIX (2025-12-12): ALWAYS use --build to detect source code changes (backend/app/, bot/)
    # Docker layer cache makes this fast when nothing changed, but ensures code updates
    # are picked up even when Dockerfile/requirements.txt didn't change
    local needs_fresh_build=false
    local build_flag="--build"

    if [[ "${DOCKER_REBUILD_NEEDED:-true}" == "true" ]]; then
        needs_fresh_build=true
        info "Docker images will be rebuilt with --no-cache (trigger files changed)"
        info "This ensures new dependencies are correctly installed"
    else
        info "Docker images will be rebuilt with layer cache (source code may have changed)"
        info "Layer cache makes rebuild fast when unchanged"
    fi

    # If fresh build needed (trigger files changed), build with --no-cache first
    # This ensures new dependencies (requirements.txt) are correctly installed
    if [[ "$needs_fresh_build" == "true" ]]; then
        info "Building Docker images with --no-cache (dependency files changed)..."
        echo ""

        # Determine which services to build based on profile
        local services_to_build="backend"
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            services_to_build="backend bot"
        fi

        for service in $services_to_build; do
            info "Building $service with --no-cache..."
            if compose_cmd build --no-cache "$service" >> "$LOG_FILE" 2>&1; then
                success "$service built successfully (fresh install of dependencies)"
            else
                error "Failed to build $service with --no-cache"
                error "Check $LOG_FILE for details"
                return 1
            fi
        done
        echo ""
    fi

    # Check if PostgreSQL should be kept running (selective restart)
    if [[ "${POSTGRES_WAS_STOPPED:-true}" == "false" ]]; then
        info "Selective restart detected - PostgreSQL will keep running"
        info "Strategy: --no-recreate for postgres only, recreate backend/bot to clear Python cache"

        # Step 1: Keep PostgreSQL running with --no-recreate
        info "Starting postgres with --no-recreate..."
        compose_cmd up $build_flag -d --no-recreate postgres >> "$LOG_FILE" 2>&1
        start_result=$?

        if [[ $start_result -eq 0 ]]; then
            # Step 2: Recreate backend/bot/nginx (clears Python .pyc cache)
            info "Recreating backend/bot/nginx (fresh containers for cache invalidation)..."
            if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
                compose_cmd --profile full up $build_flag -d backend bot nginx >> "$LOG_FILE" 2>&1
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

            # Save Docker build checksums ONLY after successful start with rebuild
            # This ensures next deploy will correctly detect if trigger files changed
            # Save when either: --build flag used OR --no-cache build was performed
            if [[ "$build_flag" == "--build" ]] || [[ "$needs_fresh_build" == "true" ]]; then
                info "Saving Docker build checksums for future rebuild detection..."
                if save_docker_build_checksums "$SCRIPT_DIR"; then
                    success "Docker build checksums saved"
                else
                    warning "Failed to save Docker build checksums"
                fi
            fi
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

    info "Starting postgres container..."
    local start_result=0

    # Always use --build to ensure latest image
    compose_cmd up --build -d postgres >> "$LOG_FILE" 2>&1
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

# Phase 1.5: Start backend container only (for migrations)
# Backend container starts but application doesn't listen on port yet
# This allows running migrations via 'docker compose exec backend'
start_backend_only() {
    step "Starting Backend Container (Phase 1.5/3)"

    info "Starting backend container for migrations..."
    local start_result=0

    # Always use --build to ensure latest image
    compose_cmd up --build -d backend >> "$LOG_FILE" 2>&1
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

# Phase 2: Start application services (backend, bot, nginx)
start_application_services() {
    step "Starting Application Services (Phase 2/2)"

    # Load .env to get DEPLOYMENT_PROFILE
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a
    fi

    info "Starting backend/bot/nginx containers..."
    local start_result=0

    # Determine build strategy based on DOCKER_REBUILD_NEEDED
    local needs_fresh_build=false
    local build_flag="--build"

    if [[ "${DOCKER_REBUILD_NEEDED:-true}" == "true" ]]; then
        needs_fresh_build=true
        info "Docker images will be rebuilt with --no-cache (trigger files changed)"
    else
        info "Docker images will be rebuilt with layer cache (source code may have changed)"
    fi

    # If fresh build needed, build with --no-cache first
    if [[ "$needs_fresh_build" == "true" ]]; then
        info "Building Docker images with --no-cache..."
        echo ""

        local services_to_build="backend"
        if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            services_to_build="backend bot"
        fi

        for service in $services_to_build; do
            info "Building $service with --no-cache..."
            if compose_cmd build --no-cache "$service" >> "$LOG_FILE" 2>&1; then
                success "$service built successfully"
            else
                error "Failed to build $service with --no-cache"
                return 1
            fi
        done
        echo ""
    fi

    # Clean up any stuck or orphan containers before starting
    # This prevents "container name already in use" errors
    cleanup_stuck_containers

    # Start backend/bot/nginx (postgres already running)
    # Use --remove-orphans to clean up any leftover containers from previous deployments
    if [[ "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
        compose_cmd --profile full up $build_flag -d --remove-orphans backend bot nginx >> "$LOG_FILE" 2>&1
        start_result=$?
    else
        compose_cmd up $build_flag -d --remove-orphans backend >> "$LOG_FILE" 2>&1
        start_result=$?
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

        # Save Docker build checksums after successful start
        if [[ "$build_flag" == "--build" ]] || [[ "$needs_fresh_build" == "true" ]]; then
            info "Saving Docker build checksums..."
            if save_docker_build_checksums "$SCRIPT_DIR"; then
                success "Docker build checksums saved"
            fi
        fi
        return 0
    else
        error "Failed to start application services. Check $LOG_FILE for details."
        return 1
    fi
}

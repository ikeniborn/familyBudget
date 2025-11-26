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

# Clean deployment (remove volumes)
clean_deployment() {
    if [[ "$CLEAN_DEPLOY" == "true" ]]; then
        warning "Clean deployment requested - this will DELETE ALL DATA!"
        echo ""
        read -p "Are you sure you want to delete all data? (type 'yes' to confirm): " -r
        echo ""

        if [[ $REPLY != "yes" ]]; then
            error "Clean deployment cancelled by user"
        fi

        info "Removing volumes (DATA DELETION)..."
        compose_cmd down -v >> "$LOG_FILE" 2>&1 || true

        # Remove PostgreSQL data
        if [[ -d "$DEPLOY_DIR/data/postgres" ]]; then
            warning "Removing PostgreSQL data directory..."
            sudo rm -rf "$DEPLOY_DIR/data/postgres"/* >> "$LOG_FILE" 2>&1 || true
        fi

        success "Clean deployment completed (ALL DATA DELETED)"
    fi
}

# Start services
start_services() {
    step "Starting services..."

    if [[ "$DETACH_MODE" == "true" ]]; then
        info "Starting services in detached mode (background)..."
        local start_result=0

        # Check if PostgreSQL should be kept running (selective restart)
        if [[ "${POSTGRES_WAS_STOPPED:-true}" == "false" ]]; then
            info "Selective restart detected - PostgreSQL will keep running"
            info "Using --no-recreate to prevent container recreation"

            # Strategy: Use --no-recreate for ALL services (including postgres)
            # Docker Compose will decide which containers to recreate based on:
            # - Image changes (new build)
            # - Configuration changes (docker-compose.yml)
            # - Volume/network changes
            # --no-recreate prevents recreation even if image changed
            if [[ -n "$COMPOSE_PROFILE" ]]; then
                compose_cmd --profile "$COMPOSE_PROFILE" up --build -d --no-recreate >> "$LOG_FILE" 2>&1
                start_result=$?
            else
                compose_cmd up --build -d --no-recreate >> "$LOG_FILE" 2>&1
                start_result=$?
            fi
        else
            # Full restart - recreate all containers
            info "Full restart - all containers will be recreated"

            if [[ -n "$COMPOSE_PROFILE" ]]; then
                compose_cmd --profile "$COMPOSE_PROFILE" up --build -d >> "$LOG_FILE" 2>&1
                start_result=$?
            else
                compose_cmd up --build -d >> "$LOG_FILE" 2>&1
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
            fi
        else
            error "Failed to start services. Check $LOG_FILE for details."
        fi
    else
        info "Starting services in foreground mode..."
        if [[ -n "$COMPOSE_PROFILE" ]]; then
            compose_cmd --profile "$COMPOSE_PROFILE" up --build
        else
            compose_cmd up --build
        fi
        return 0
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

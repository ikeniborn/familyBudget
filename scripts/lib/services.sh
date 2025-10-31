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

    local compose_args=""
    if [[ -n "$COMPOSE_PROFILE" ]]; then
        compose_args="--profile $COMPOSE_PROFILE"
    fi

    if [[ "$DETACH_MODE" == "true" ]]; then
        info "Starting services in detached mode (background)..."
        compose_cmd up --build -d $compose_args >> "$LOG_FILE" 2>&1
    else
        info "Starting services in foreground mode..."
        compose_cmd up --build $compose_args
        return 0
    fi

    if [[ $? -eq 0 ]]; then
        success "Services started successfully"
    else
        error "Failed to start services. Check $LOG_FILE for details."
    fi
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
            *)
                warning "$service_name status: $status"
                ;;
        esac

        sleep "$CHECK_INTERVAL"
        elapsed=$((elapsed + CHECK_INTERVAL))
    done

    echo ""
    error "$service_name failed to become healthy within ${max_wait}s"
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

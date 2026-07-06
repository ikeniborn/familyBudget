#!/bin/bash
#
# status.sh - Service Status Reporting
#
# This module provides functions for checking and displaying
# the status of deployed services.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/status.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR, color constants)
#   - utils.sh (for compose_cmd, print_message)
#

# =============================================================================
# SERVICE STATUS FUNCTIONS
# =============================================================================

# Get service status
# Usage: get_service_status backend
# Returns: healthy|running|starting|unhealthy|not_running
get_service_status() {
    local service=$1

    local container_id
    container_id=$(compose_cmd ps -q "$service" 2>/dev/null || echo "")

    if [[ -z "$container_id" ]]; then
        echo "not_running"
        return
    fi

    local health_status
    health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo "none")

    if [[ "$health_status" == "none" ]]; then
        local running_status
        running_status=$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || echo "not_running")
        echo "$running_status"
    else
        echo "$health_status"
    fi
}

# =============================================================================
# STATUS DISPLAY
# =============================================================================

# Print deployment status
print_status() {
    echo ""
    echo "========================================================================"
    print_message "$GREEN" "           Family Budget - Deployment Status"
    echo "========================================================================"
    echo ""

    # Services status
    echo "Services:"
    local services
    services=$(compose_cmd ps --services 2>/dev/null || echo "")

    if [[ -z "$services" ]]; then
        print_message "$RED" "  ✗ No services running"
        return
    fi

    for service in $services; do
        local status
        status=$(get_service_status "$service")

        case "$status" in
            "healthy")
                print_message "$GREEN" "  ✓ $service: healthy"
                ;;
            "running")
                print_message "$GREEN" "  ✓ $service: running"
                ;;
            "starting")
                print_message "$YELLOW" "  ⏳ $service: starting"
                ;;
            "unhealthy")
                print_message "$RED" "  ✗ $service: unhealthy"
                ;;
            *)
                print_message "$RED" "  ✗ $service: $status"
                ;;
        esac
    done

    echo ""

    # Access URLs
    echo "Access URLs:"

    # Source .env to get ports
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local backend_port="${BACKEND_PORT:-8000}"
    local http_port="${HTTP_PORT:-80}"
    local https_port="${HTTPS_PORT:-443}"
    local domain="${DOMAIN:-localhost}"

    # Backend URL
    if compose_cmd ps -q backend >/dev/null 2>&1; then
        if [[ "$domain" == "localhost" ]]; then
            print_message "$CYAN" "  Backend:     http://localhost:$backend_port"
        else
            print_message "$CYAN" "  Backend:     http://$domain:$backend_port"
        fi
    fi

    # Traefik URLs
    if compose_cmd ps -q traefik >/dev/null 2>&1; then
        if [[ "$domain" == "localhost" ]]; then
            print_message "$CYAN" "  HTTP:        http://localhost:$http_port"
            if [[ "$https_port" != "443" ]]; then
                print_message "$CYAN" "  HTTPS:       https://localhost:$https_port"
            else
                print_message "$CYAN" "  HTTPS:       https://localhost"
            fi
        else
            print_message "$CYAN" "  HTTP:        http://$domain"
            print_message "$CYAN" "  HTTPS:       https://$domain"
        fi
    fi

    echo ""

    # Useful commands
    echo "Useful commands:"
    echo "  View logs:           docker compose logs -f"
    echo "  View service logs:   docker compose logs -f <service>"
    echo "  Restart service:     docker compose restart <service>"
    echo "  Stop all:            docker compose down"
    echo "  Service status:      docker compose ps"
    echo ""

    # Log file location
    echo "Logs: $LOG_FILE"
    echo "========================================================================"
}

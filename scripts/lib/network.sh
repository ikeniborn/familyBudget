#!/bin/bash
#
# scripts/lib/network.sh - Network and port management functions
#
# This module handles network-related operations:
# - Port availability checking
# - Conflict resolution for HTTP/HTTPS ports
# - Generic conflict resolution for HTTP/HTTPS ports
#
# Dependencies: config.sh, utils.sh, docker.sh (is_our_docker_container)
#
# Usage:
#   source scripts/lib/network.sh
#   check_port_available 80 "HTTP"
#
# Part of Phase 3 refactoring (network functions extracted from deploy.sh)
#

# =============================================================================
# PORT CHECKING FUNCTIONS
# =============================================================================

# Check if port is available
# Args:
#   $1: port number
#   $2: service name (for display)
# Returns:
#   0 if port is available or belongs to our docker-compose
#   exits on user cancellation
check_port_available() {
    local port=$1
    local service_name=$2

    # Check if port is in use
    local process_info=""
    if command_exists lsof; then
        process_info=$(sudo lsof -i :"$port" -t 2>/dev/null || true)
    elif command_exists netstat; then
        process_info=$(sudo netstat -tulpn 2>/dev/null | grep ":$port " | awk '{print $7}' || true)
    else
        warning "Cannot check port availability (lsof/netstat not found)"
        return 0
    fi

    if [[ -n "$process_info" ]]; then
        warning "Port $port is already in use!"
        echo ""
        echo "Process using port $port:"
        if command_exists lsof; then
            sudo lsof -i :"$port" 2>/dev/null || true
        else
            sudo netstat -tulpn 2>/dev/null | grep ":$port " || true
        fi
        echo ""

        # Check if this is our own docker-compose service
        if is_our_docker_container "$port"; then
            info "Port $port is used by our docker-compose service - will be restarted during deployment"
            return 0
        fi

        # Detect if process is certbot
        local process_name=""
        local is_certbot=false

        if command_exists lsof; then
            # Get process name from lsof output
            process_name=$(sudo lsof -i :"$port" 2>/dev/null | grep -v "COMMAND" | awk '{print $1}' | head -1 || true)
        fi

        if [[ "$process_name" == "certbot" ]] || sudo lsof -i :"$port" 2>/dev/null | grep -q certbot; then
            is_certbot=true
        fi

        # Certbot is no longer managed by deploy.sh. Traefik owns ACME.
        if [[ "$is_certbot" == "true" ]]; then
            warning "Certbot is currently using port $port."
            warning "Traefik needs exclusive access to ports 80/443 for HTTP-01 challenges and HTTPS traffic."
            warning "Stop or disable host certbot outside deploy, then rerun deployment."
            echo ""

            if [[ ! -t 0 ]]; then
                error "Non-interactive deploy cannot resolve certbot port conflict safely. Stop certbot manually and rerun deploy."
                return 1
            fi
        fi

        # Standard handling for any process using the port.
        warning "This will prevent $service_name from starting."
        echo ""

        # Non-interactive mode (no TTY) - automatically stop non-certbot process
        if [[ ! -t 0 ]]; then
            info "Non-interactive mode: automatically stopping process on port $port"
            choice="1"
        else
            # Interactive mode - ask user
            echo "Опции:"
            echo "  [1] Остановить процесс и продолжить"
            echo "  [2] Изменить порт в .env файле"
            echo "  [3] Отменить деплой"
            echo ""

            read -p "Выберите [1-3]: " choice
            echo ""
        fi

        case $choice in
            1)
                info "Попытка остановить процесс на порту $port..."
                if [[ -n "$process_info" ]]; then
                    sudo kill -TERM $process_info 2>/dev/null || true
                    sleep 2

                    # Verify port is free
                    if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                        error "Не удалось освободить порт $port. Пожалуйста, остановите процесс вручную."
                    else
                        success "Порт $port теперь свободен"
                    fi
                fi
                ;;
            2)
                error "Пожалуйста, отредактируйте $DEPLOY_DIR/.env и измените ${service_name}_PORT, затем запустите deploy.sh снова"
                ;;
            3)
                error "Деплой отменён"
                ;;
            *)
                error "Неверный выбор"
                ;;
        esac
    fi
}

ensure_monitoring_network() {
    if ! docker network inspect monitoring >/dev/null 2>&1; then
        info "Creating external Docker network: monitoring"
        docker network create monitoring >> "$LOG_FILE" 2>&1
        success "External Docker network created: monitoring"
    else
        info "External Docker network already exists: monitoring"
    fi
}

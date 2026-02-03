#!/bin/bash
#
# scripts/lib/network.sh - Network and port management functions
#
# This module handles network-related operations:
# - Port availability checking
# - Conflict resolution for HTTP/HTTPS ports
# - Special handling for certbot conflicts
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

        # Special handling for certbot
        if [[ "$is_certbot" == "true" ]]; then
            warning "ОБНАРУЖЕН CERTBOT НА ХОСТЕ!"
            echo ""
            info "Проверка systemd сервисов certbot..."
            echo ""

            # Check certbot.service status
            if systemctl is-active --quiet certbot.service 2>/dev/null; then
                echo "  certbot.service: ${GREEN}active${NC}"
            else
                echo "  certbot.service: inactive"
            fi

            # Check certbot.timer status
            if systemctl is-active --quiet certbot.timer 2>/dev/null; then
                echo "  certbot.timer: ${GREEN}active${NC}"
            else
                echo "  certbot.timer: inactive"
            fi

            echo ""
            warning "ВАЖНО: Этот деплой использует контейнеризованный certbot."
            warning "Host certbot конфликтует с портом $port, необходимым для nginx/SSL."
            echo ""
            info "Рекомендация: Остановить host certbot и использовать контейнерную версию."
            echo ""

            # Non-interactive mode (no TTY) - automatically stop certbot temporarily
            if [[ ! -t 0 ]]; then
                info "Non-interactive mode: automatically stopping host certbot (option 1)"
                choice="1"
            else
                # Interactive mode - ask user
                echo "Опции:"
                echo "  [1] Остановить host certbot (временно) и продолжить деплой (рекомендуется)"
                echo "  [2] Отключить host certbot навсегда и продолжить"
                echo "  [3] Отменить деплой"
                echo ""

                read -p "Выберите [1-3]: " choice
                echo ""
            fi

            case $choice in
                1)
                    info "Остановка certbot.service и certbot.timer..."
                    sudo systemctl stop certbot.service 2>/dev/null || true
                    sudo systemctl stop certbot.timer 2>/dev/null || true
                    sleep 2

                    # Verify port is free
                    if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                        warning "systemctl stop не освободил порт. Процесс certbot запущен вне systemd."
                        echo ""

                        # Get PIDs still holding the port
                        local remaining_pids=$(sudo lsof -i :"$port" -t 2>/dev/null || true)

                        if [[ -n "$remaining_pids" ]]; then
                            info "Попытка завершить процесс certbot (PID: $remaining_pids)..."

                            # Try graceful SIGTERM first
                            sudo kill -TERM $remaining_pids 2>/dev/null || true
                            sleep 3

                            # Check if still running
                            if sudo lsof -i :"$port" >/dev/null 2>&1; then
                                warning "Процесс не завершился. Принудительное завершение (SIGKILL)..."
                                sudo kill -9 $remaining_pids 2>/dev/null || true
                                sleep 2
                            fi

                            # Final verification
                            if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                                error "Не удалось освободить порт $port. Процесс certbot всё ещё запущен. Попробуйте вручную: sudo kill -9 $remaining_pids"
                            else
                                success "Host certbot остановлен."
                                info "Контейнеризованный certbot возьмёт на себя управление SSL сертификатами."
                                echo ""
                                warning "ПРИМЕЧАНИЕ: certbot.timer может автоматически запуститься при следующей перезагрузке."
                                info "Для постоянного отключения выберите опцию [2] при следующем деплое."
                            fi
                        fi
                    else
                        success "Host certbot остановлен."
                        info "Контейнеризованный certbot возьмёт на себя управление SSL сертификатами."
                        echo ""
                        warning "ПРИМЕЧАНИЕ: certbot.timer может автоматически запуститься при следующей перезагрузке."
                        info "Для постоянного отключения выберите опцию [2] при следующем деплое."
                    fi
                    ;;
                2)
                    info "Отключение certbot.service и certbot.timer навсегда..."
                    sudo systemctl stop certbot.service 2>/dev/null || true
                    sudo systemctl stop certbot.timer 2>/dev/null || true
                    sudo systemctl disable certbot.service 2>/dev/null || true
                    sudo systemctl disable certbot.timer 2>/dev/null || true
                    sleep 2

                    # Verify port is free
                    if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                        warning "systemctl stop не освободил порт. Процесс certbot запущен вне systemd."
                        echo ""

                        # Get PIDs still holding the port
                        local remaining_pids=$(sudo lsof -i :"$port" -t 2>/dev/null || true)

                        if [[ -n "$remaining_pids" ]]; then
                            info "Попытка завершить процесс certbot (PID: $remaining_pids)..."

                            # Try graceful SIGTERM first
                            sudo kill -TERM $remaining_pids 2>/dev/null || true
                            sleep 3

                            # Check if still running
                            if sudo lsof -i :"$port" >/dev/null 2>&1; then
                                warning "Процесс не завершился. Принудительное завершение (SIGKILL)..."
                                sudo kill -9 $remaining_pids 2>/dev/null || true
                                sleep 2
                            fi

                            # Final verification
                            if command_exists lsof && sudo lsof -i :"$port" >/dev/null 2>&1; then
                                error "Не удалось освободить порт $port. Процесс certbot всё ещё запущен. Попробуйте вручную: sudo kill -9 $remaining_pids"
                            else
                                success "Host certbot отключён навсегда."
                                info "Контейнеризованный certbot будет управлять SSL сертификатами."
                            fi
                        fi
                    else
                        success "Host certbot отключён навсегда."
                        info "Контейнеризованный certbot будет управлять SSL сертификатами."
                    fi
                    ;;
                3)
                    error "Деплой отменён пользователем"
                    ;;
                *)
                    error "Неверный выбор"
                    ;;
            esac
        else
            # Standard handling for non-certbot processes
            warning "This will prevent $service_name from starting."
            echo ""

            # Non-interactive mode (no TTY) - automatically stop process
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
                        sudo kill -9 $process_info 2>/dev/null || true
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
    fi
}

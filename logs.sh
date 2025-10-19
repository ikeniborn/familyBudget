#!/bin/bash
#
# Family Budget - Log Collection & System Diagnostics Script
#
# Этот скрипт собирает логи и статус всех сервисов для диагностики
# после выполнения setup.sh и deploy.sh
#
# Usage:
#   ./logs.sh [OPTIONS]
#
# Options:
#   -h, --help              Показать справку
#   -s, --save              Сохранить вывод в файл (logs/diagnostics_YYYYMMDD_HHMMSS.txt)
#   -t, --tail LINES        Количество строк логов для каждого сервиса (default: 50)
#   -f, --follow SERVICE    Follow logs для конкретного сервиса (live tail)
#   -q, --quick             Быстрая проверка (только статус, без логов)
#
# Examples:
#   ./logs.sh                      # Показать все логи и статус
#   ./logs.sh --save               # Сохранить в файл
#   ./logs.sh --tail 100           # Показать 100 строк логов
#   ./logs.sh --follow backend     # Live tail для backend
#   ./logs.sh --quick              # Только статус сервисов
#
# Author: Family Budget Team
# Version: 1.0.0
# Date: 2025-10-19
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# =============================================================================
# CONFIGURATION
# =============================================================================

DEPLOY_DIR="/opt/budget"
PROJECT_NAME="familybudget"
LOG_DIR="$DEPLOY_DIR/logs"
DIAGNOSTICS_DIR="$LOG_DIR/diagnostics"

# Default options
SAVE_TO_FILE=false
TAIL_LINES=50
FOLLOW_SERVICE=""
QUICK_MODE=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Box drawing characters
BOX_HORIZONTAL="━"
BOX_VERTICAL="┃"
BOX_TOP_LEFT="┏"
BOX_TOP_RIGHT="┓"
BOX_BOTTOM_LEFT="┗"
BOX_BOTTOM_RIGHT="┛"
BOX_T_RIGHT="┣"
BOX_T_LEFT="┫"

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Print colored message
print_color() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Print section header
print_header() {
    local text="$1"
    local width=80
    local padding=$(( (width - ${#text} - 2) / 2 ))

    echo
    print_color "$CYAN" "$(printf '%*s' $width | tr ' ' "$BOX_HORIZONTAL")"
    print_color "$CYAN" "$(printf '%*s' $padding)${WHITE} $text ${CYAN}$(printf '%*s' $padding | tr ' ' ' ')"
    print_color "$CYAN" "$(printf '%*s' $width | tr ' ' "$BOX_HORIZONTAL")"
    echo
}

# Print sub-header
print_subheader() {
    local text="$1"
    echo
    print_color "$BLUE" "▸ $text"
    print_color "$BLUE" "$(printf '%*s' 78 | tr ' ' '─')"
}

# Print status line
print_status() {
    local label="$1"
    local status="$2"
    local color="$3"

    printf "  %-40s " "$label"
    print_color "$color" "$status"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running in deployment directory
check_deploy_dir() {
    if [ ! -d "$DEPLOY_DIR" ]; then
        print_color "$RED" "ERROR: Deployment directory not found: $DEPLOY_DIR"
        print_color "$YELLOW" "Run setup.sh first to create deployment structure"
        exit 1
    fi
}

# =============================================================================
# DIAGNOSTIC FUNCTIONS
# =============================================================================

# Collect system information
collect_system_info() {
    print_header "SYSTEM INFORMATION"

    print_subheader "Server Details"
    print_status "Hostname:" "$(hostname)" "$WHITE"
    print_status "OS:" "$(lsb_release -d | cut -f2)" "$WHITE"
    print_status "Kernel:" "$(uname -r)" "$WHITE"
    print_status "Architecture:" "$(uname -m)" "$WHITE"
    print_status "Uptime:" "$(uptime -p)" "$WHITE"

    print_subheader "Resource Usage"

    # CPU
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    if (( $(echo "$cpu_usage > 80" | bc -l) )); then
        print_status "CPU Usage:" "${cpu_usage}%" "$RED"
    elif (( $(echo "$cpu_usage > 50" | bc -l) )); then
        print_status "CPU Usage:" "${cpu_usage}%" "$YELLOW"
    else
        print_status "CPU Usage:" "${cpu_usage}%" "$GREEN"
    fi

    # Memory
    local mem_info=$(free -m | awk 'NR==2{printf "Used: %sMB / Total: %sMB (%.1f%%)", $3,$2,$3*100/$2}')
    local mem_percent=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
    if (( mem_percent > 80 )); then
        print_status "Memory:" "$mem_info" "$RED"
    elif (( mem_percent > 60 )); then
        print_status "Memory:" "$mem_info" "$YELLOW"
    else
        print_status "Memory:" "$mem_info" "$GREEN"
    fi

    # Disk
    local disk_usage=$(df -h "$DEPLOY_DIR" | awk 'NR==2{print $5}' | sed 's/%//')
    local disk_info=$(df -h "$DEPLOY_DIR" | awk 'NR==2{printf "Used: %s / Total: %s (%s)", $3,$2,$5}')
    if (( disk_usage > 80 )); then
        print_status "Disk (${DEPLOY_DIR}):" "$disk_info" "$RED"
    elif (( disk_usage > 60 )); then
        print_status "Disk (${DEPLOY_DIR}):" "$disk_info" "$YELLOW"
    else
        print_status "Disk (${DEPLOY_DIR}):" "$disk_info" "$GREEN"
    fi

    # Load average
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | xargs)
    print_status "Load Average:" "$load_avg" "$WHITE"
}

# Collect Docker status
collect_docker_status() {
    print_header "DOCKER CONTAINERS"

    if ! command_exists docker; then
        print_color "$RED" "  Docker not installed!"
        return
    fi

    if ! docker ps >/dev/null 2>&1; then
        print_color "$RED" "  Docker daemon not running!"
        return
    fi

    print_subheader "Container Status"

    # Get all containers for this project
    local containers=$(docker ps -a --filter "name=${PROJECT_NAME}" --format "{{.Names}}")

    if [ -z "$containers" ]; then
        print_color "$YELLOW" "  No containers found for project: $PROJECT_NAME"
        return
    fi

    # Display container status
    echo
    printf "  %-30s %-15s %-15s %-20s\n" "CONTAINER" "STATUS" "HEALTH" "UPTIME"
    printf "  %s\n" "$(printf '%*s' 78 | tr ' ' '─')"

    for container in $containers; do
        local status=$(docker inspect -f '{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
        local health=$(docker inspect -f '{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        local uptime=$(docker inspect -f '{{.State.StartedAt}}' "$container" 2>/dev/null | xargs -I{} date -d {} +"%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "unknown")

        # Color based on status
        local status_color="$WHITE"
        case "$status" in
            "running") status_color="$GREEN" ;;
            "exited") status_color="$RED" ;;
            "paused") status_color="$YELLOW" ;;
            "restarting") status_color="$YELLOW" ;;
        esac

        # Color based on health
        local health_color="$WHITE"
        case "$health" in
            "healthy") health_color="$GREEN" ;;
            "unhealthy") health_color="$RED" ;;
            "starting") health_color="$YELLOW" ;;
        esac

        printf "  %-30s " "$container"
        print_color "$status_color" "$(printf '%-15s' "$status")" | tr -d '\n'
        print_color "$health_color" "$(printf '%-15s' "$health")" | tr -d '\n'
        printf "%-20s\n" "$uptime"
    done

    echo

    # Docker stats (CPU, Memory)
    print_subheader "Resource Usage (Containers)"
    echo
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" \
        $(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}") 2>/dev/null || \
        print_color "$YELLOW" "  Unable to get container stats"
}

# Check services health
check_services_health() {
    print_header "SERVICES HEALTH CHECKS"

    print_subheader "Backend API"

    # Check backend health
    local backend_url="http://localhost:8000"

    if curl -f -s "${backend_url}/health" >/dev/null 2>&1; then
        print_status "API Health (/health):" "✓ OK" "$GREEN"
    else
        print_status "API Health (/health):" "✗ FAILED" "$RED"
    fi

    if curl -f -s "${backend_url}/ping" >/dev/null 2>&1; then
        print_status "API Ping (/ping):" "✓ OK" "$GREEN"
    else
        print_status "API Ping (/ping):" "✗ FAILED" "$RED"
    fi

    # Detailed health check
    local health_detailed=$(curl -s "${backend_url}/health/detailed" 2>/dev/null)
    if [ -n "$health_detailed" ]; then
        print_status "Detailed Health:" "✓ Available" "$GREEN"
        echo
        echo "$health_detailed" | python3 -m json.tool 2>/dev/null | sed 's/^/    /' || echo "    $health_detailed"
    else
        print_status "Detailed Health:" "✗ Not Available" "$RED"
    fi

    echo
    print_subheader "Database"

    # Check PostgreSQL
    if docker exec "${PROJECT_NAME}-postgres-1" pg_isready -U familybudget >/dev/null 2>&1; then
        print_status "PostgreSQL Status:" "✓ Ready" "$GREEN"
    else
        print_status "PostgreSQL Status:" "✗ Not Ready" "$RED"
    fi

    # Connection pool info (if backend is running)
    local db_health=$(curl -s "${backend_url}/health/detailed" 2>/dev/null | grep -o '"database":[^}]*}')
    if [ -n "$db_health" ]; then
        echo "    $db_health"
    fi
}

# Collect firewall status
collect_firewall_status() {
    print_header "FIREWALL STATUS (UFW)"

    if ! command_exists ufw; then
        print_color "$YELLOW" "  UFW not installed"
        return
    fi

    if ! sudo ufw status >/dev/null 2>&1; then
        print_color "$RED" "  Cannot access UFW (requires sudo)"
        return
    fi

    local ufw_status=$(sudo ufw status | head -1)

    if echo "$ufw_status" | grep -q "inactive"; then
        print_status "UFW Status:" "✗ INACTIVE" "$RED"
    elif echo "$ufw_status" | grep -q "active"; then
        print_status "UFW Status:" "✓ ACTIVE" "$GREEN"
    else
        print_status "UFW Status:" "UNKNOWN" "$YELLOW"
    fi

    echo
    print_subheader "Firewall Rules"
    echo
    sudo ufw status numbered | sed 's/^/    /'
}

# Collect service logs
collect_service_logs() {
    local service="$1"
    local lines="$2"

    print_subheader "Logs: $service (last $lines lines)"

    if docker logs --tail "$lines" "${PROJECT_NAME}-${service}-1" 2>&1; then
        :
    else
        print_color "$RED" "  Failed to get logs for $service"
    fi
}

# Collect all logs
collect_all_logs() {
    print_header "SERVICE LOGS"

    local services=("postgres" "backend" "bot" "nginx")

    for service in "${services[@]}"; do
        if docker ps --filter "name=${PROJECT_NAME}-${service}-1" --format "{{.Names}}" | grep -q "${PROJECT_NAME}-${service}-1"; then
            echo
            collect_service_logs "$service" "$TAIL_LINES"
        else
            print_subheader "Logs: $service"
            print_color "$YELLOW" "  Container not running"
        fi
    done
}

# Collect deployment logs
collect_deployment_logs() {
    print_header "DEPLOYMENT LOGS"

    print_subheader "Setup Log"
    if [ -f "$LOG_DIR/setup.log" ]; then
        tail -n 30 "$LOG_DIR/setup.log" | sed 's/^/    /'
    else
        print_color "$YELLOW" "  Setup log not found: $LOG_DIR/setup.log"
    fi

    echo
    print_subheader "Deploy Log"
    if [ -f "$LOG_DIR/deploy.log" ]; then
        tail -n 30 "$LOG_DIR/deploy.log" | sed 's/^/    /'
    else
        print_color "$YELLOW" "  Deploy log not found: $LOG_DIR/deploy.log"
    fi
}

# Check recent errors
check_recent_errors() {
    print_header "RECENT ERRORS & WARNINGS"

    local services=("backend" "bot" "postgres" "nginx")
    local error_count=0

    for service in "${services[@]}"; do
        if docker ps --filter "name=${PROJECT_NAME}-${service}-1" --format "{{.Names}}" | grep -q "${PROJECT_NAME}-${service}-1"; then
            print_subheader "$service errors"

            local errors=$(docker logs --tail 200 "${PROJECT_NAME}-${service}-1" 2>&1 | grep -i "error\|exception\|failed\|critical" | tail -n 10)

            if [ -n "$errors" ]; then
                echo "$errors" | sed 's/^/    /' | head -n 10
                error_count=$((error_count + 1))
            else
                print_color "$GREEN" "    No recent errors"
            fi
            echo
        fi
    done

    if [ $error_count -gt 0 ]; then
        print_color "$YELLOW" "⚠ Found errors in $error_count service(s). Review logs above."
    else
        print_color "$GREEN" "✓ No recent errors found in any service"
    fi
}

# =============================================================================
# MAIN FUNCTION
# =============================================================================

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                grep "^#" "$0" | grep -v "^#!/" | sed 's/^# //' | sed 's/^#//'
                exit 0
                ;;
            -s|--save)
                SAVE_TO_FILE=true
                shift
                ;;
            -t|--tail)
                TAIL_LINES="$2"
                shift 2
                ;;
            -f|--follow)
                FOLLOW_SERVICE="$2"
                shift 2
                ;;
            -q|--quick)
                QUICK_MODE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
}

# Follow logs for a specific service
follow_logs() {
    local service="$1"

    print_color "$CYAN" "Following logs for: $service (Ctrl+C to stop)"
    echo

    docker logs -f --tail 50 "${PROJECT_NAME}-${service}-1" 2>&1
}

# Main execution
main() {
    parse_args "$@"

    # Change to deployment directory if it exists
    if [ -d "$DEPLOY_DIR" ]; then
        cd "$DEPLOY_DIR" || true
    fi

    # Handle follow mode
    if [ -n "$FOLLOW_SERVICE" ]; then
        follow_logs "$FOLLOW_SERVICE"
        exit 0
    fi

    # Create diagnostics directory
    mkdir -p "$DIAGNOSTICS_DIR"

    # Generate timestamp for log file
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local log_file="$DIAGNOSTICS_DIR/diagnostics_${timestamp}.txt"

    # Main diagnostic collection
    {
        print_color "$MAGENTA" "╔══════════════════════════════════════════════════════════════════════════════╗"
        print_color "$MAGENTA" "║                                                                              ║"
        print_color "$MAGENTA" "║              FAMILY BUDGET - SYSTEM DIAGNOSTICS & LOG COLLECTION             ║"
        print_color "$MAGENTA" "║                                                                              ║"
        print_color "$MAGENTA" "╚══════════════════════════════════════════════════════════════════════════════╝"
        echo
        print_color "$WHITE" "Generated: $(date '+%Y-%m-%d %H:%M:%S')"
        print_color "$WHITE" "Deployment: $DEPLOY_DIR"
        echo

        # System info
        collect_system_info

        # Docker status
        collect_docker_status

        # Services health
        check_services_health

        # Firewall
        collect_firewall_status

        if [ "$QUICK_MODE" = false ]; then
            # Recent errors
            check_recent_errors

            # Service logs
            collect_all_logs

            # Deployment logs
            collect_deployment_logs
        fi

        # Summary
        print_header "DIAGNOSTIC SUMMARY"
        print_color "$WHITE" "  Timestamp:     $(date '+%Y-%m-%d %H:%M:%S')"
        print_color "$WHITE" "  Deployment:    $DEPLOY_DIR"
        print_color "$WHITE" "  Mode:          $([ "$QUICK_MODE" = true ] && echo "Quick" || echo "Full")"
        if [ "$SAVE_TO_FILE" = true ]; then
            print_color "$WHITE" "  Saved to:      $log_file"
        fi
        echo

    } | if [ "$SAVE_TO_FILE" = true ]; then
        tee "$log_file"

        echo
        print_color "$GREEN" "✓ Diagnostics saved to: $log_file"
        print_color "$CYAN" "  View with: less $log_file"
        print_color "$CYAN" "  Or:        cat $log_file"
    else
        cat
    fi
}

# Run main function
main "$@"

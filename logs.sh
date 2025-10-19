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
# Version: 1.1.0
# Date: 2025-10-19
#
# Changelog v1.1.0:
#   - Fixed container name detection (removed hardcoded -1 suffix)
#   - Replaced Unicode box characters with ASCII for better compatibility
#   - Removed /ping endpoint check (not implemented)
#   - Added /ready endpoint check
#   - Fixed PostgreSQL health check
#   - Added database size reporting
#   - Added network ports analysis (ss/netstat)
#   - Improved diagnostic summary with container stats
#   - Better error handling for missing containers
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

# Box drawing characters (ASCII-safe)
BOX_HORIZONTAL="="
BOX_VERTICAL="|"
BOX_TOP_LEFT="+"
BOX_TOP_RIGHT="+"
BOX_BOTTOM_LEFT="+"
BOX_BOTTOM_RIGHT="+"
BOX_T_RIGHT="+"
BOX_T_LEFT="+"

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
    print_color "$BLUE" "> $text"
    print_color "$BLUE" "$(printf '%*s' 78 | tr ' ' '-')"
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

        # Get basic health info
        local health_data=$(curl -s "${backend_url}/health" 2>/dev/null)
        if [ -n "$health_data" ]; then
            echo
            echo "$health_data" | python3 -m json.tool 2>/dev/null | sed 's/^/    /' || echo "    $health_data"
        fi
    else
        print_status "API Health (/health):" "✗ FAILED" "$RED"
    fi

    # Check /ready endpoint
    if curl -f -s "${backend_url}/ready" >/dev/null 2>&1; then
        print_status "API Ready (/ready):" "✓ OK" "$GREEN"
    else
        print_status "API Ready (/ready):" "✗ FAILED" "$RED"
    fi

    echo
    print_subheader "Database"

    # Check PostgreSQL - find container dynamically
    local postgres_container=$(docker ps --filter "name=${PROJECT_NAME}-postgres" --format "{{.Names}}" | head -1)

    if [ -n "$postgres_container" ]; then
        if docker exec "$postgres_container" pg_isready -U familybudget >/dev/null 2>&1; then
            print_status "PostgreSQL Status:" "✓ Ready" "$GREEN"

            # Get database size
            local db_size=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "SELECT pg_size_pretty(pg_database_size('familybudget'));" 2>/dev/null | xargs)
            if [ -n "$db_size" ]; then
                print_status "Database Size:" "$db_size" "$WHITE"
            fi
        else
            print_status "PostgreSQL Status:" "✗ Not Ready" "$RED"
        fi
    else
        print_status "PostgreSQL Status:" "✗ Container not found" "$RED"
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

# Collect network ports information
collect_network_ports() {
    print_header "NETWORK PORTS"

    print_subheader "Listening Ports (ss)"

    if ! command_exists ss; then
        print_color "$YELLOW" "  ss command not available, trying netstat..."

        if command_exists netstat; then
            echo
            printf "  %-10s %-25s %-25s %-s\n" "PROTO" "LOCAL ADDRESS" "PEER ADDRESS" "PROCESS"
            printf "  %s\n" "$(printf '%*s' 78 | tr ' ' '-')"
            sudo netstat -tulpn | grep LISTEN | awk '{printf "  %-10s %-25s %-25s %s\n", $1, $4, $5, $7}' | sed 's|/| |'
        else
            print_color "$RED" "  Neither ss nor netstat available"
        fi
        return
    fi

    echo
    printf "  %-10s %-6s %-25s %-25s %-s\n" "PROTO" "STATE" "LOCAL ADDRESS" "PEER ADDRESS" "PROCESS"
    printf "  %s\n" "$(printf '%*s' 78 | tr ' ' '-')"

    # Get listening ports with process info
    sudo ss -tulpn | grep LISTEN | while IFS= read -r line; do
        proto=$(echo "$line" | awk '{print $1}')
        state=$(echo "$line" | awk '{print $2}')
        local_addr=$(echo "$line" | awk '{print $5}')
        peer_addr=$(echo "$line" | awk '{print $6}')
        process=$(echo "$line" | awk '{print $7}' | sed 's/users:(("//' | sed 's/")).*//' | cut -d'"' -f2)

        # Highlight critical ports
        local color="$WHITE"
        if echo "$local_addr" | grep -q ":80\|:443\|:8000"; then
            color="$GREEN"
        elif echo "$local_addr" | grep -q ":5432"; then
            color="$YELLOW"
        fi

        print_color "$color" "  $(printf '%-10s %-6s %-25s %-25s %s' "$proto" "$state" "$local_addr" "$peer_addr" "$process")"
    done

    echo
    print_subheader "Expected Services"

    # Check expected ports
    local expected_ports=(
        "80:HTTP (Nginx)"
        "443:HTTPS (Nginx)"
        "8000:Backend API"
        "5432:PostgreSQL"
    )

    for port_info in "${expected_ports[@]}"; do
        IFS=':' read -r port desc <<< "$port_info"

        if sudo ss -tulpn | grep -q ":${port} "; then
            print_status "  Port $port ($desc):" "✓ LISTENING" "$GREEN"
        else
            print_status "  Port $port ($desc):" "✗ NOT LISTENING" "$YELLOW"
        fi
    done

    echo
    print_subheader "Docker Published Ports"

    # Get Docker container ports
    if docker ps >/dev/null 2>&1; then
        echo
        printf "  %-30s %-40s\n" "CONTAINER" "PORTS"
        printf "  %s\n" "$(printf '%*s' 78 | tr ' ' '-')"

        docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}\t{{.Ports}}" | while IFS=$'\t' read -r name ports; do
            if [ -n "$ports" ]; then
                printf "  %-30s %s\n" "$name" "$ports"
            else
                printf "  %-30s %s\n" "$name" "(no published ports)"
            fi
        done
    else
        print_color "$YELLOW" "  Docker not accessible"
    fi
}

# Collect service logs
collect_service_logs() {
    local service="$1"
    local lines="$2"

    print_subheader "Logs: $service (last $lines lines)"

    # Find container dynamically
    local container_name=$(docker ps -a --filter "name=${PROJECT_NAME}-${service}" --format "{{.Names}}" | head -1)

    if [ -n "$container_name" ]; then
        if docker logs --tail "$lines" "$container_name" 2>&1; then
            :
        else
            print_color "$RED" "  Failed to get logs for $container_name"
        fi
    else
        print_color "$YELLOW" "  Container not found for service: $service"
    fi
}

# Collect all logs
collect_all_logs() {
    print_header "SERVICE LOGS"

    local services=("postgres" "backend" "bot" "nginx")

    for service in "${services[@]}"; do
        # Find container dynamically
        local container_name=$(docker ps --filter "name=${PROJECT_NAME}-${service}" --format "{{.Names}}" | head -1)

        if [ -n "$container_name" ]; then
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
        # Find container dynamically
        local container_name=$(docker ps --filter "name=${PROJECT_NAME}-${service}" --format "{{.Names}}" | head -1)

        if [ -n "$container_name" ]; then
            print_subheader "$service errors"

            local errors=$(docker logs --tail 200 "$container_name" 2>&1 | grep -i "error\|exception\|failed\|critical" | tail -n 10)

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

    # Find container dynamically
    local container_name=$(docker ps --filter "name=${PROJECT_NAME}-${service}" --format "{{.Names}}" | head -1)

    if [ -n "$container_name" ]; then
        print_color "$CYAN" "Following logs for: $container_name (Ctrl+C to stop)"
        echo
        docker logs -f --tail 50 "$container_name" 2>&1
    else
        print_color "$RED" "ERROR: Container not found for service: $service"
        print_color "$YELLOW" "Available containers:"
        docker ps --filter "name=${PROJECT_NAME}" --format "  - {{.Names}}"
        exit 1
    fi
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
        print_color "$MAGENTA" "================================================================================"
        print_color "$MAGENTA" "|                                                                              |"
        print_color "$MAGENTA" "|              FAMILY BUDGET - SYSTEM DIAGNOSTICS & LOG COLLECTION             |"
        print_color "$MAGENTA" "|                                                                              |"
        print_color "$MAGENTA" "================================================================================"
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

        # Network ports
        collect_network_ports

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

        # Count running/healthy containers
        local total_containers=$(docker ps -a --filter "name=${PROJECT_NAME}" --format "{{.Names}}" | wc -l)
        local running_containers=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}" | wc -l)
        local healthy_containers=$(docker ps --filter "name=${PROJECT_NAME}" --filter "health=healthy" --format "{{.Names}}" | wc -l)

        # System metrics
        local mem_percent=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
        local disk_usage=$(df -h "$DEPLOY_DIR" | awk 'NR==2{print $5}' | sed 's/%//')
        local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)

        # Health status colors
        local container_color="$GREEN"
        [ "$running_containers" -lt "$total_containers" ] && container_color="$YELLOW"

        local health_color="$GREEN"
        [ "$healthy_containers" -lt "$running_containers" ] && health_color="$YELLOW"

        echo
        print_color "$CYAN" "  SYSTEM STATUS"
        print_status "    Timestamp:" "$(date '+%Y-%m-%d %H:%M:%S')" "$WHITE"
        print_status "    Deployment:" "$DEPLOY_DIR" "$WHITE"
        print_status "    Mode:" "$([ "$QUICK_MODE" = true ] && echo "Quick" || echo "Full")" "$WHITE"

        echo
        print_color "$CYAN" "  CONTAINERS"
        print_status "    Total:" "$total_containers containers" "$WHITE"
        print_status "    Running:" "$running_containers / $total_containers" "$container_color"
        print_status "    Healthy:" "$healthy_containers / $running_containers" "$health_color"

        echo
        print_color "$CYAN" "  RESOURCES"
        [ "$cpu_usage" = "" ] && cpu_usage="N/A" || cpu_usage="${cpu_usage}%"
        [ "$mem_percent" = "" ] && mem_percent="N/A" || mem_percent="${mem_percent}%"
        [ "$disk_usage" = "" ] && disk_usage="N/A" || disk_usage="${disk_usage}%"

        local cpu_color="$GREEN"
        [ "${cpu_usage%\%}" != "N/A" ] && (( $(echo "${cpu_usage%\%} > 80" | bc -l 2>/dev/null || echo 0) )) && cpu_color="$RED"

        local mem_color="$GREEN"
        [ "$mem_percent" != "N/A" ] && (( mem_percent > 80 )) && mem_color="$RED"
        [ "$mem_percent" != "N/A" ] && (( mem_percent > 60 )) && (( mem_percent <= 80 )) && mem_color="$YELLOW"

        local disk_color="$GREEN"
        [ "$disk_usage" != "N/A" ] && (( disk_usage > 80 )) && disk_color="$RED"
        [ "$disk_usage" != "N/A" ] && (( disk_usage > 60 )) && (( disk_usage <= 80 )) && disk_color="$YELLOW"

        print_status "    CPU Usage:" "$cpu_usage" "$cpu_color"
        print_status "    Memory Usage:" "$mem_percent" "$mem_color"
        print_status "    Disk Usage:" "$disk_usage" "$disk_color"

        if [ "$SAVE_TO_FILE" = true ]; then
            echo
            print_color "$CYAN" "  OUTPUT"
            print_status "    Saved to:" "$log_file" "$GREEN"
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

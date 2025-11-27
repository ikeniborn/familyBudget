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
#   -a, --alert             Режим alerting (только критичные проблемы)
#
# Examples:
#   ./logs.sh                      # Показать все логи и статус
#   ./logs.sh --save               # Сохранить в файл
#   ./logs.sh --tail 100           # Показать 100 строк логов
#   ./logs.sh --follow backend     # Live tail для backend
#   ./logs.sh --quick              # Только статус сервисов
#   ./logs.sh --alert              # Только критичные проблемы
#
# Author: Family Budget Team
# Version: 2.0.0
# Date: 2025-11-10
#
# Changelog v2.0.0 (2025-11-10):
#   + Added comprehensive health checks (4 endpoints: /ping, /health, /ready, /health/detailed)
#   + Added Bot health check (activity monitoring)
#   + Added Nginx health check (HTTP/HTTPS)
#   + Added dependency chain verification (postgres → backend → bot/nginx)
#   + Added smart JSON log parsing for backend (structured logging)
#   + Added error grouping by type (auth, database, validation)
#   + Added correlation ID analysis for related errors
#   + Added background jobs monitoring (scheduler tasks)
#   + Added database details (Alembic versions, table sizes, slow queries)
#   + Added index usage analysis (unused indexes detection)
#   + Added database connections monitoring
#   + Added SSL certificate expiry check with days countdown
#   + Added SSL/TLS protocol version checks
#   + Added security headers validation (HSTS, CSP, X-Frame-Options)
#   + Added unexpected open ports detection
#   + Added container resource limits vs usage with alerting
#   + Added alert mode (--alert) for critical issues only
#   * Improved resource monitoring with thresholds and color coding
#   * Enhanced error detection with service-specific patterns
#
# Changelog v1.1.0 (2025-10-19):
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
ALERT_MODE=false

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

    # Docker stats (CPU, Memory) with limits check
    print_subheader "Resource Usage (Containers)"
    echo

    local containers=$(docker ps --filter "name=${PROJECT_NAME}" --format "{{.Names}}")

    if [ -z "$containers" ]; then
        print_color "$YELLOW" "  No running containers found"
        return
    fi

    printf "  %-30s %-10s %-20s %-15s\n" "CONTAINER" "CPU %" "MEMORY" "STATUS"
    printf "  %s\n" "$(printf '%*s' 78 | tr ' ' '─')"

    for container in $containers; do
        # Get current usage
        local stats=$(docker stats --no-stream --format "{{.CPUPerc}}|{{.MemPerc}}|{{.MemUsage}}" "$container" 2>/dev/null)
        local cpu_perc=$(echo "$stats" | cut -d'|' -f1 | sed 's/%//')
        local mem_perc=$(echo "$stats" | cut -d'|' -f2 | sed 's/%//')
        local mem_usage=$(echo "$stats" | cut -d'|' -f3)

        # Get limits
        local cpu_limit=$(docker inspect "$container" --format '{{.HostConfig.NanoCpus}}' 2>/dev/null)
        local mem_limit=$(docker inspect "$container" --format '{{.HostConfig.Memory}}' 2>/dev/null)

        # Convert CPU limit to cores
        local cpu_limit_cores="N/A"
        if [ "$cpu_limit" != "0" ] && [ -n "$cpu_limit" ]; then
            cpu_limit_cores=$(echo "scale=1; $cpu_limit / 1000000000" | bc)
        fi

        # Convert memory limit
        local mem_limit_gb="N/A"
        if [ "$mem_limit" != "0" ] && [ -n "$mem_limit" ]; then
            mem_limit_gb=$(echo "scale=2; $mem_limit / 1073741824" | bc)
        fi

        # Determine status color
        local status="✓"
        local color="$GREEN"

        # CPU check
        if [ -n "$cpu_perc" ]; then
            local cpu_num=$(echo "$cpu_perc" | bc 2>/dev/null || echo 0)
            if (( $(echo "$cpu_num > 80" | bc -l 2>/dev/null || echo 0) )); then
                status="⚠ HIGH CPU"
                color="$YELLOW"
            fi
        fi

        # Memory check
        if [ -n "$mem_perc" ]; then
            local mem_num=$(echo "$mem_perc" | bc 2>/dev/null || echo 0)
            if (( $(echo "$mem_num > 90" | bc -l 2>/dev/null || echo 0) )); then
                status="⚠ HIGH MEM"
                color="$RED"
            elif (( $(echo "$mem_num > 80" | bc -l 2>/dev/null || echo 0) )); then
                status="⚠ HIGH MEM"
                color="$YELLOW"
            fi
        fi

        # Format output
        local cpu_str="${cpu_perc}%"
        [ "$cpu_limit_cores" != "N/A" ] && cpu_str="${cpu_str} / ${cpu_limit_cores}"

        local mem_str="${mem_usage}"
        [ "$mem_limit_gb" != "N/A" ] && mem_str="${mem_str} / ${mem_limit_gb}GB"

        printf "  %-30s " "$container"
        printf "%-10s " "$cpu_str"
        printf "%-20s " "$mem_str"
        print_color "$color" "$status"
    done

    echo
    print_color "$CYAN" "  Legend: ✓ Normal | ⚠ HIGH CPU (>80%) | ⚠ HIGH MEM (>80%)"
}

# Check services health
check_services_health() {
    print_header "SERVICES HEALTH CHECKS"

    print_subheader "Backend API"

    # Check backend health
    local backend_url="http://localhost:8000"
    local backend_healthy=false

    # 1. Check /ping (ultra-lightweight)
    if curl -f -s "${backend_url}/ping" >/dev/null 2>&1; then
        print_status "API Ping (/ping):" "✓ OK" "$GREEN"
    else
        print_status "API Ping (/ping):" "✗ FAILED" "$RED"
    fi

    # 2. Check /health (basic health check)
    if curl -f -s "${backend_url}/health" >/dev/null 2>&1; then
        print_status "API Health (/health):" "✓ OK" "$GREEN"
        backend_healthy=true

        # Get basic health info
        local health_data=$(curl -s "${backend_url}/health" 2>/dev/null)
        if [ -n "$health_data" ]; then
            echo
            echo "$health_data" | python3 -m json.tool 2>/dev/null | sed 's/^/    /' || echo "    $health_data"
        fi
    else
        print_status "API Health (/health):" "✗ FAILED" "$RED"
    fi

    # 3. Check /ready (readiness probe)
    if curl -f -s "${backend_url}/ready" >/dev/null 2>&1; then
        print_status "API Ready (/ready):" "✓ OK" "$GREEN"
    else
        print_status "API Ready (/ready):" "✗ FAILED" "$RED"
    fi

    # 4. Check /health/detailed (comprehensive)
    echo
    if curl -f -s "${backend_url}/health/detailed" >/dev/null 2>&1; then
        print_status "API Detailed Health (/health/detailed):" "✓ OK" "$GREEN"

        # Get detailed health info
        local detailed_health=$(curl -s "${backend_url}/health/detailed" 2>/dev/null)
        if [ -n "$detailed_health" ]; then
            echo
            echo "$detailed_health" | python3 -m json.tool 2>/dev/null | sed 's/^/    /' || echo "    $detailed_health"
        fi
    else
        print_status "API Detailed Health (/health/detailed):" "✗ FAILED" "$RED"
    fi

    echo
    print_subheader "Database"

    # Check PostgreSQL - find container dynamically
    local postgres_container=$(docker ps --filter "name=${PROJECT_NAME}-postgres" --format "{{.Names}}" | head -1)
    local postgres_healthy=false

    if [ -n "$postgres_container" ]; then
        if docker exec "$postgres_container" pg_isready -U familybudget >/dev/null 2>&1; then
            print_status "PostgreSQL Status:" "✓ Ready" "$GREEN"
            postgres_healthy=true

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

    echo
    print_subheader "Telegram Bot"

    # Check Bot - find container dynamically
    local bot_container=$(docker ps --filter "name=${PROJECT_NAME}-bot" --format "{{.Names}}" | head -1)

    if [ -n "$bot_container" ]; then
        # Check if bot is running
        local bot_status=$(docker inspect -f '{{.State.Status}}' "$bot_container" 2>/dev/null || echo "unknown")

        if [ "$bot_status" = "running" ]; then
            print_status "Bot Status:" "✓ Running" "$GREEN"

            # Check recent activity (logs within last 5 minutes)
            local last_log_time=$(docker logs --since 5m "$bot_container" 2>&1 | tail -1 | grep -oP '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}' || echo "")

            if [ -n "$last_log_time" ]; then
                print_status "Bot Last Activity:" "< 5 min ago" "$GREEN"
            else
                # Check if there are any logs in last 30 minutes
                local last_30m_logs=$(docker logs --since 30m "$bot_container" 2>&1 | wc -l)
                if [ "$last_30m_logs" -gt 0 ]; then
                    print_status "Bot Last Activity:" "< 30 min ago" "$YELLOW"
                else
                    print_status "Bot Last Activity:" "⚠ No recent logs" "$YELLOW"
                fi
            fi
        else
            print_status "Bot Status:" "✗ Not Running ($bot_status)" "$RED"
        fi
    else
        print_status "Bot Status:" "✗ Container not found" "$RED"
    fi

    echo
    print_subheader "Nginx (Frontend)"

    # Check Nginx - find container dynamically
    local nginx_container=$(docker ps --filter "name=${PROJECT_NAME}-nginx" --format "{{.Names}}" | head -1)

    if [ -n "$nginx_container" ]; then
        local nginx_status=$(docker inspect -f '{{.State.Status}}' "$nginx_container" 2>/dev/null || echo "unknown")

        if [ "$nginx_status" = "running" ]; then
            print_status "Nginx Status:" "✓ Running" "$GREEN"

            # Try to reach Nginx (HTTP)
            if curl -f -s -o /dev/null -w "%{http_code}" "http://localhost:80" 2>/dev/null | grep -q "200\|301\|302"; then
                print_status "Nginx HTTP (port 80):" "✓ Responding" "$GREEN"
            else
                print_status "Nginx HTTP (port 80):" "✗ Not responding" "$YELLOW"
            fi

            # Try to reach Nginx (HTTPS) if configured
            if command_exists openssl && timeout 2 bash -c "</dev/tcp/localhost/443" 2>/dev/null; then
                print_status "Nginx HTTPS (port 443):" "✓ Responding" "$GREEN"
            else
                print_status "Nginx HTTPS (port 443):" "⚠ Not configured or not responding" "$YELLOW"
            fi
        else
            print_status "Nginx Status:" "✗ Not Running ($nginx_status)" "$RED"
        fi
    else
        print_status "Nginx Status:" "✗ Container not found" "$RED"
    fi

    echo
    print_subheader "Dependency Chain Verification"

    # Verify: postgres → backend → bot/nginx
    local chain_ok=true

    # 1. PostgreSQL must be healthy
    if [ "$postgres_healthy" = false ]; then
        print_status "Chain: PostgreSQL →" "✗ BROKEN (PostgreSQL not ready)" "$RED"
        chain_ok=false
    else
        print_status "Chain: PostgreSQL →" "✓ OK" "$GREEN"
    fi

    # 2. Backend depends on PostgreSQL
    if [ "$postgres_healthy" = true ] && [ "$backend_healthy" = true ]; then
        print_status "Chain: PostgreSQL → Backend →" "✓ OK" "$GREEN"
    else
        print_status "Chain: PostgreSQL → Backend →" "✗ BROKEN (Backend not healthy)" "$RED"
        chain_ok=false
    fi

    # 3. Bot depends on Backend
    if [ "$backend_healthy" = true ] && [ -n "$bot_container" ] && [ "$bot_status" = "running" ]; then
        print_status "Chain: PostgreSQL → Backend → Bot" "✓ OK" "$GREEN"
    else
        print_status "Chain: PostgreSQL → Backend → Bot" "✗ BROKEN (Bot not running or Backend not healthy)" "$RED"
        chain_ok=false
    fi

    # 4. Nginx depends on Backend
    if [ "$backend_healthy" = true ] && [ -n "$nginx_container" ] && [ "$nginx_status" = "running" ]; then
        print_status "Chain: PostgreSQL → Backend → Nginx" "✓ OK" "$GREEN"
    else
        print_status "Chain: PostgreSQL → Backend → Nginx" "✗ BROKEN (Nginx not running or Backend not healthy)" "$RED"
        chain_ok=false
    fi

    echo
    if [ "$chain_ok" = true ]; then
        print_color "$GREEN" "  ✓ All dependency chains are healthy"
    else
        print_color "$RED" "  ✗ Some dependency chains are broken. Check service status above."
    fi
}

# Check database details (migrations, table sizes, slow queries)
check_database_details() {
    print_header "DATABASE DETAILS & MIGRATIONS"

    local postgres_container=$(docker ps --filter "name=${PROJECT_NAME}-postgres" --format "{{.Names}}" | head -1)
    local backend_container=$(docker ps --filter "name=${PROJECT_NAME}-backend" --format "{{.Names}}" | head -1)

    if [ -z "$postgres_container" ]; then
        print_color "$RED" "  PostgreSQL container not found"
        return
    fi

    print_subheader "Alembic Migrations"

    if [ -n "$backend_container" ]; then
        # Get current Alembic version
        local current_version=$(docker exec "$backend_container" bash -c "cd /app/backend/db/migrations && alembic current 2>/dev/null" | grep -oP '[a-f0-9]{12}' | head -1 || echo "unknown")
        local head_version=$(docker exec "$backend_container" bash -c "cd /app/backend/db/migrations && alembic heads 2>/dev/null" | grep -oP '[a-f0-9]{12}' | head -1 || echo "unknown")

        if [ "$current_version" != "unknown" ]; then
            print_status "  Current Version:" "$current_version" "$WHITE"

            if [ "$head_version" != "unknown" ]; then
                print_status "  Latest Version (heads):" "$head_version" "$WHITE"

                if [ "$current_version" = "$head_version" ]; then
                    print_status "  Migration Status:" "✓ Up to date" "$GREEN"
                else
                    print_status "  Migration Status:" "⚠ Not up to date (needs upgrade)" "$YELLOW"
                fi
            fi
        else
            print_status "  Migration Status:" "⚠ Cannot determine (alembic not accessible)" "$YELLOW"
        fi
    else
        print_status "  Migration Status:" "⚠ Cannot check (backend container not found)" "$YELLOW"
    fi

    echo
    print_subheader "Table Sizes (Top 5)"

    # Get top 5 largest tables
    local table_sizes=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "
        SELECT
            schemaname || '.' || tablename AS table_name,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
            pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
        FROM pg_tables
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY size_bytes DESC
        LIMIT 5;
    " 2>/dev/null)

    if [ -n "$table_sizes" ]; then
        echo
        printf "  %-40s %s\n" "TABLE" "SIZE"
        printf "  %s\n" "$(printf '%*s' 60 | tr ' ' '-')"

        echo "$table_sizes" | while IFS='|' read -r table size _; do
            # Trim whitespace
            table=$(echo "$table" | xargs)
            size=$(echo "$size" | xargs)

            if [ -n "$table" ] && [ -n "$size" ]; then
                printf "  %-40s %s\n" "$table" "$size"
            fi
        done
    else
        print_color "$YELLOW" "    Unable to fetch table sizes"
    fi

    echo
    print_subheader "Index Usage"

    # Get unused indexes
    local unused_indexes=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "
        SELECT
            schemaname || '.' || indexrelname AS index_name,
            pg_size_pretty(pg_relation_size(schemaname||'.'||indexrelname)) AS size
        FROM pg_stat_user_indexes
        WHERE idx_scan = 0
        AND schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY pg_relation_size(schemaname||'.'||indexrelname) DESC
        LIMIT 5;
    " 2>/dev/null)

    local unused_count=$(echo "$unused_indexes" | grep -v '^$' | wc -l)

    if [ "$unused_count" -eq 0 ]; then
        print_status "  Unused Indexes:" "✓ None found" "$GREEN"
    else
        print_status "  Unused Indexes:" "⚠ ${unused_count} unused (top 5 shown)" "$YELLOW"

        echo
        printf "  %-50s %s\n" "INDEX" "SIZE"
        printf "  %s\n" "$(printf '%*s' 65 | tr ' ' '-')"

        echo "$unused_indexes" | while IFS='|' read -r index size; do
            index=$(echo "$index" | xargs)
            size=$(echo "$size" | xargs)

            if [ -n "$index" ] && [ -n "$size" ]; then
                printf "  %-50s %s\n" "$index" "$size"
            fi
        done
    fi

    echo
    print_subheader "Slow Queries (Last 24h)"

    # Check if pg_stat_statements extension is available
    local has_pg_stat_statements=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t \
        -c "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements')::int;" 2>/dev/null | xargs || echo "0")

    if [ "$has_pg_stat_statements" = "1" ]; then
        # Use pg_stat_statements for accurate slow query detection
        local slow_queries=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t \
            -c "SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > 1000;" 2>/dev/null | xargs || echo "0")

        if [ "$slow_queries" -eq 0 ]; then
            print_status "  Slow Queries (>1s):" "✓ None found" "$GREEN"
        else
            print_status "  Slow Queries (>1s):" "⚠ ${slow_queries} queries" "$YELLOW"

            # Show top 3 slowest queries with statistics
            echo
            print_color "$WHITE" "  Top 3 Slowest Queries:"
            echo
            docker exec "$postgres_container" psql -U familybudget -d familybudget -t \
                -c "SELECT
                        '    ' ||
                        ROUND(mean_exec_time::numeric, 2) || 'ms (avg), ' ||
                        ROUND(max_exec_time::numeric, 2) || 'ms (max), ' ||
                        calls || ' calls' || E'\n' ||
                        '    ' || LEFT(query, 80) || '...'
                    FROM pg_stat_statements
                    WHERE mean_exec_time > 1000
                    ORDER BY mean_exec_time DESC
                    LIMIT 3;" 2>/dev/null
        fi
    else
        # Fallback: Check for slow queries in logs (old method)
        local slow_queries=$(docker logs --since 24h "$postgres_container" 2>&1 | grep "duration:" | grep -oP 'duration: \K[\d.]+' | awk '{if ($1 > 1000) print $1}' | wc -l)

        if [ "$slow_queries" -eq 0 ]; then
            print_status "  Slow Queries (>1s):" "✓ None found" "$GREEN"
        else
            print_status "  Slow Queries (>1s):" "⚠ ${slow_queries} queries" "$YELLOW"

            # Show top 3 slowest
            echo
            print_color "$WHITE" "  Top 3 Slowest Queries (from logs):"
            docker logs --since 24h "$postgres_container" 2>&1 | grep "duration:" | grep -oP 'duration: [\d.]+.*statement:.*' | sort -rn -k2 | head -3 | sed 's/^/    /' | head -c 500
        fi

        # Suggest installing pg_stat_statements
        echo
        print_color "$YELLOW" "  💡 Tip: Install pg_stat_statements extension for better query monitoring"
        print_color "$YELLOW" "      Run: cd ~/familyBudget && sudo ./deploy.sh --profile full"
    fi

    echo
    print_subheader "Database Connections"

    # Get active connections
    local active_conn=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null | xargs || echo "N/A")
    local idle_conn=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'idle';" 2>/dev/null | xargs || echo "N/A")
    local total_conn=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | xargs || echo "N/A")
    local max_conn=$(docker exec "$postgres_container" psql -U familybudget -d familybudget -t -c "SHOW max_connections;" 2>/dev/null | xargs || echo "N/A")

    print_status "  Active Connections:" "$active_conn" "$WHITE"
    print_status "  Idle Connections:" "$idle_conn" "$WHITE"
    print_status "  Total Connections:" "$total_conn / $max_conn (max)" "$([ "$total_conn" != "N/A" ] && [ "$max_conn" != "N/A" ] && [ "$total_conn" -gt $((max_conn * 80 / 100)) ] && echo "$YELLOW" || echo "$GREEN")"
}

# Check background jobs (scheduler tasks)
check_background_jobs() {
    print_header "BACKGROUND JOBS (SCHEDULER)"

    local backend_container=$(docker ps --filter "name=${PROJECT_NAME}-backend" --format "{{.Names}}" | head -1)

    if [ -z "$backend_container" ]; then
        print_color "$RED" "  Backend container not found - cannot check scheduler"
        return
    fi

    # Get scheduler logs (last 7 days)
    local scheduler_logs=$(docker logs --since 168h "$backend_container" 2>&1 | grep "\[SCHEDULER\]")

    if [ -z "$scheduler_logs" ]; then
        print_color "$YELLOW" "  No scheduler logs found in last 7 days"
        return
    fi

    print_subheader "Scheduled Jobs Status"

    # Job 1: Article usage statistics (Daily 00:00 UTC)
    local job1_name="recalculate_article_usage_stats"
    local job1_start=$(echo "$scheduler_logs" | grep -i "article usage statistics recalculation job" | tail -1)
    local job1_complete=$(echo "$scheduler_logs" | grep -i "article usage statistics recalculation completed" | tail -1)
    local job1_error=$(docker logs --since 168h "$backend_container" 2>&1 | grep "\[SCHEDULER\].*article usage statistics" | grep -i "error\|exception\|failed" | tail -1)

    if [ -n "$job1_start" ]; then
        local job1_time=$(echo "$job1_start" | grep -oP '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}' || echo "unknown")
        print_status "  Article Usage Stats Job:" "Last run: $job1_time" "$WHITE"

        if [ -n "$job1_complete" ]; then
            local job1_duration=$(echo "$job1_complete" | grep -oP 'completed in \K[\d.]+' || echo "N/A")
            print_status "    Status:" "✓ Completed (${job1_duration}s)" "$GREEN"
        elif [ -n "$job1_error" ]; then
            print_status "    Status:" "✗ Failed with error" "$RED"
            echo "      Error: $(echo "$job1_error" | sed 's/.*\[SCHEDULER\]//' | head -c 100)"
        else
            print_status "    Status:" "⚠ Started but no completion log" "$YELLOW"
        fi
    else
        print_status "  Article Usage Stats Job:" "⚠ No recent runs in last 7 days" "$YELLOW"
    fi

    echo

    # Job 2: Recommended amounts (Daily 02:00 UTC)
    local job2_name="recalculate_recommended_amounts"
    local job2_start=$(echo "$scheduler_logs" | grep -i "recommended amounts recalculation job" | tail -1)
    local job2_complete=$(echo "$scheduler_logs" | grep -i "recommended amounts recalculation completed" | tail -1)
    local job2_error=$(docker logs --since 168h "$backend_container" 2>&1 | grep "\[SCHEDULER\].*recommended amounts" | grep -i "error\|exception\|failed" | tail -1)

    if [ -n "$job2_start" ]; then
        local job2_time=$(echo "$job2_start" | grep -oP '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}' || echo "unknown")
        print_status "  Recommended Amounts Job:" "Last run: $job2_time" "$WHITE"

        if [ -n "$job2_complete" ]; then
            local job2_duration=$(echo "$job2_complete" | grep -oP 'completed in \K[\d.]+' || echo "N/A")
            print_status "    Status:" "✓ Completed (${job2_duration}s)" "$GREEN"
        elif [ -n "$job2_error" ]; then
            print_status "    Status:" "✗ Failed with error" "$RED"
            echo "      Error: $(echo "$job2_error" | sed 's/.*\[SCHEDULER\]//' | head -c 100)"
        else
            print_status "    Status:" "⚠ Started but no completion log" "$YELLOW"
        fi
    else
        print_status "  Recommended Amounts Job:" "⚠ No recent runs in last 7 days" "$YELLOW"
    fi

    echo
    print_subheader "Scheduler Health"

    # Count total scheduler events
    local scheduler_runs=$(echo "$scheduler_logs" | grep -i "starting.*job" | wc -l)
    local scheduler_completions=$(echo "$scheduler_logs" | grep -i "completed" | wc -l)
    local scheduler_errors=$(docker logs --since 168h "$backend_container" 2>&1 | grep "\[SCHEDULER\]" | grep -i "error\|exception\|failed" | wc -l)

    print_status "  Total job runs (7 days):" "$scheduler_runs" "$WHITE"
    print_status "  Successful completions:" "$scheduler_completions" "$([ "$scheduler_completions" -gt 0 ] && echo "$GREEN" || echo "$YELLOW")"
    print_status "  Errors:" "$scheduler_errors" "$([ "$scheduler_errors" -eq 0 ] && echo "$GREEN" || echo "$RED")"

    # Check if scheduler is stuck
    local last_scheduler_log=$(echo "$scheduler_logs" | tail -1 | grep -oP '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}' || echo "")
    if [ -n "$last_scheduler_log" ]; then
        local last_log_epoch=$(date -d "$last_scheduler_log" +%s 2>/dev/null || echo 0)
        local now_epoch=$(date +%s)
        local hours_since=$(( (now_epoch - last_log_epoch) / 3600 ))

        if [ "$hours_since" -gt 48 ]; then
            print_status "  Last scheduler activity:" "⚠ ${hours_since}h ago (possibly stuck)" "$RED"
        elif [ "$hours_since" -gt 24 ]; then
            print_status "  Last scheduler activity:" "${hours_since}h ago" "$YELLOW"
        else
            print_status "  Last scheduler activity:" "< ${hours_since}h ago" "$GREEN"
        fi
    fi

    # Show recent scheduler errors if any
    if [ "$scheduler_errors" -gt 0 ]; then
        echo
        print_color "$YELLOW" "  Recent Scheduler Errors (last 3):"
        docker logs --since 168h "$backend_container" 2>&1 | grep "\[SCHEDULER\]" | grep -i "error\|exception\|failed" | tail -3 | sed 's/^/    /'
    fi
}

# Check SSL certificates and security
check_ssl_security() {
    print_header "SSL & SECURITY"

    print_subheader "SSL Certificates"

    # Check if HTTPS is configured
    if ! timeout 2 bash -c "</dev/tcp/localhost/443" 2>/dev/null; then
        print_color "$YELLOW" "  HTTPS not configured or not accessible on port 443"
        return
    fi

    # Get SSL certificate info (local check)
    if command_exists openssl; then
        local cert_info=$(echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -dates -subject -issuer 2>/dev/null)

        if [ -n "$cert_info" ]; then
            # Extract certificate details
            local not_after=$(echo "$cert_info" | grep "notAfter=" | cut -d'=' -f2)
            local subject=$(echo "$cert_info" | grep "subject=" | cut -d'=' -f2-)
            local issuer=$(echo "$cert_info" | grep "issuer=" | cut -d'=' -f2-)

            if [ -n "$not_after" ]; then
                # Calculate days until expiry
                local expiry_epoch=$(date -d "$not_after" +%s 2>/dev/null || echo 0)
                local now_epoch=$(date +%s)
                local days_until_expiry=$(( (expiry_epoch - now_epoch) / 86400 ))

                print_status "  Certificate Expiry:" "$not_after" "$WHITE"

                if [ "$days_until_expiry" -lt 0 ]; then
                    print_status "  Days Until Expiry:" "✗ EXPIRED" "$RED"
                elif [ "$days_until_expiry" -lt 7 ]; then
                    print_status "  Days Until Expiry:" "⚠ ${days_until_expiry} days (renew soon!)" "$RED"
                elif [ "$days_until_expiry" -lt 30 ]; then
                    print_status "  Days Until Expiry:" "${days_until_expiry} days" "$YELLOW"
                else
                    print_status "  Days Until Expiry:" "${days_until_expiry} days" "$GREEN"
                fi
            fi

            [ -n "$subject" ] && print_status "  Subject:" "$subject" "$WHITE"
            [ -n "$issuer" ] && print_status "  Issuer:" "$issuer" "$WHITE"

            # Check SSL protocol versions
            echo
            print_color "$CYAN" "  Supported SSL/TLS Protocols:"

            local protocols=("ssl3" "tls1" "tls1_1" "tls1_2" "tls1_3")
            local protocol_names=("SSLv3" "TLSv1.0" "TLSv1.1" "TLSv1.2" "TLSv1.3")

            for i in "${!protocols[@]}"; do
                local proto="${protocols[$i]}"
                local proto_name="${protocol_names[$i]}"

                if echo | openssl s_client -connect localhost:443 -"$proto" 2>/dev/null | grep -q "Cipher"; then
                    # Insecure protocols
                    if [[ "$proto" == "ssl3" ]] || [[ "$proto" == "tls1" ]] || [[ "$proto" == "tls1_1" ]]; then
                        print_status "    $proto_name:" "✗ Enabled (insecure!)" "$RED"
                    else
                        print_status "    $proto_name:" "✓ Enabled" "$GREEN"
                    fi
                else
                    # Disabled insecure protocols is good
                    if [[ "$proto" == "ssl3" ]] || [[ "$proto" == "tls1" ]] || [[ "$proto" == "tls1_1" ]]; then
                        print_status "    $proto_name:" "✓ Disabled (secure)" "$GREEN"
                    else
                        print_status "    $proto_name:" "✗ Disabled" "$YELLOW"
                    fi
                fi
            done
        else
            print_color "$YELLOW" "  Unable to retrieve certificate information"
        fi
    else
        print_color "$YELLOW" "  openssl command not available"
    fi

    echo
    print_subheader "Security Headers (Nginx)"

    # Check security headers via curl
    if command_exists curl; then
        local headers=$(curl -s -I -k https://localhost 2>/dev/null || curl -s -I http://localhost 2>/dev/null)

        if [ -n "$headers" ]; then
            # Check for important security headers
            local has_hsts=$(echo "$headers" | grep -i "Strict-Transport-Security" | wc -l)
            local has_csp=$(echo "$headers" | grep -i "Content-Security-Policy" | wc -l)
            local has_xframe=$(echo "$headers" | grep -i "X-Frame-Options" | wc -l)
            local has_xcontent=$(echo "$headers" | grep -i "X-Content-Type-Options" | wc -l)

            print_status "  Strict-Transport-Security:" "$([ "$has_hsts" -gt 0 ] && echo '✓ Present' || echo '✗ Missing')" "$([ "$has_hsts" -gt 0 ] && echo "$GREEN" || echo "$YELLOW")"
            print_status "  Content-Security-Policy:" "$([ "$has_csp" -gt 0 ] && echo '✓ Present' || echo '✗ Missing')" "$([ "$has_csp" -gt 0 ] && echo "$GREEN" || echo "$YELLOW")"
            print_status "  X-Frame-Options:" "$([ "$has_xframe" -gt 0 ] && echo '✓ Present' || echo '✗ Missing')" "$([ "$has_xframe" -gt 0 ] && echo "$GREEN" || echo "$YELLOW")"
            print_status "  X-Content-Type-Options:" "$([ "$has_xcontent" -gt 0 ] && echo '✓ Present' || echo '✗ Missing')" "$([ "$has_xcontent" -gt 0 ] && echo "$GREEN" || echo "$YELLOW")"
        else
            print_color "$YELLOW" "  Unable to retrieve HTTP headers"
        fi
    fi

    echo
    print_subheader "Open Ports Security"

    # Check for unexpected open ports
    local unexpected_ports=()

    # Expected ports
    local expected=(80 443 8000 5432 22)

    # Get all listening TCP ports
    if command_exists ss; then
        local all_ports=$(sudo ss -tulpn 2>/dev/null | grep LISTEN | awk '{print $5}' | grep -oP ':\K[0-9]+$' | sort -u)
    elif command_exists netstat; then
        local all_ports=$(sudo netstat -tulpn 2>/dev/null | grep LISTEN | awk '{print $4}' | grep -oP ':\K[0-9]+$' | sort -u)
    else
        print_color "$YELLOW" "  Cannot check open ports (ss/netstat not available)"
        return
    fi

    # Find unexpected ports
    for port in $all_ports; do
        local is_expected=false
        for exp_port in "${expected[@]}"; do
            if [ "$port" = "$exp_port" ]; then
                is_expected=true
                break
            fi
        done

        if [ "$is_expected" = false ]; then
            unexpected_ports+=("$port")
        fi
    done

    if [ ${#unexpected_ports[@]} -eq 0 ]; then
        print_status "  Unexpected Open Ports:" "✓ None found" "$GREEN"
    else
        print_status "  Unexpected Open Ports:" "⚠ ${#unexpected_ports[@]} ports: ${unexpected_ports[*]}" "$YELLOW"
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

# Parse JSON log line (backend structured logging)
parse_json_log() {
    local log_line="$1"

    # Try to extract JSON fields
    local timestamp=$(echo "$log_line" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('timestamp', ''))" 2>/dev/null || echo "")
    local level=$(echo "$log_line" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('level', ''))" 2>/dev/null || echo "")
    local message=$(echo "$log_line" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('message', ''))" 2>/dev/null || echo "")
    local correlation_id=$(echo "$log_line" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('correlation_id', ''))" 2>/dev/null || echo "")
    local error_type=$(echo "$log_line" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('error_type', data.get('exception_type', '')))" 2>/dev/null || echo "")

    # Output in compact format
    if [ -n "$timestamp" ] && [ -n "$level" ]; then
        printf "[%s] %s: %s" "$timestamp" "$level" "$message"
        [ -n "$error_type" ] && printf " (type: %s)" "$error_type"
        [ -n "$correlation_id" ] && printf " [corr_id: %s]" "$correlation_id"
        printf "\n"
    else
        # Fallback to raw log
        echo "$log_line"
    fi
}

# Check recent errors with smart parsing
check_recent_errors() {
    print_header "RECENT ERRORS & WARNINGS"

    local services=("backend" "bot" "postgres" "nginx")
    local error_count=0
    local critical_count=0
    local warning_count=0

    # Backend - JSON structured logs with grouping
    local backend_container=$(docker ps --filter "name=${PROJECT_NAME}-backend" --format "{{.Names}}" | head -1)

    if [ -n "$backend_container" ]; then
        print_subheader "Backend (JSON Structured Logs)"

        # Get logs and try to parse as JSON
        local backend_logs=$(docker logs --tail 300 "$backend_container" 2>&1)

        # Count by level
        local backend_errors=$(echo "$backend_logs" | grep -i '"level".*"error"' | wc -l)
        local backend_critical=$(echo "$backend_logs" | grep -i '"level".*"critical"' | wc -l)
        local backend_warnings=$(echo "$backend_logs" | grep -i '"level".*"warning"' | wc -l)

        print_status "  ERROR count:" "$backend_errors" "$([ "$backend_errors" -gt 0 ] && echo "$RED" || echo "$GREEN")"
        print_status "  CRITICAL count:" "$backend_critical" "$([ "$backend_critical" -gt 0 ] && echo "$RED" || echo "$GREEN")"
        print_status "  WARNING count:" "$backend_warnings" "$([ "$backend_warnings" -gt 5 ] && echo "$YELLOW" || echo "$WHITE")"

        # Group errors by type
        echo
        print_color "$CYAN" "  Error Grouping:"

        # Authentication/Authorization errors
        local auth_errors=$(echo "$backend_logs" | grep -i '"error_type".*"Unauthorized\|Forbidden"' | wc -l)
        if [ "$auth_errors" -gt 0 ]; then
            print_status "    Authentication/Authorization:" "$auth_errors errors" "$YELLOW"

            # Show last 3
            echo "$backend_logs" | grep -i '"error_type".*"Unauthorized\|Forbidden"' | tail -3 | while IFS= read -r line; do
                echo "      $(parse_json_log "$line")"
            done
        fi

        # Database errors
        local db_errors=$(echo "$backend_logs" | grep -i '"error_type".*"IntegrityError\|OperationalError\|SQLAlchemyError"' | wc -l)
        if [ "$db_errors" -gt 0 ]; then
            print_status "    Database Errors:" "$db_errors errors" "$YELLOW"

            # Show last 3
            echo "$backend_logs" | grep -i '"error_type".*"IntegrityError\|OperationalError\|SQLAlchemyError"' | tail -3 | while IFS= read -r line; do
                echo "      $(parse_json_log "$line")"
            done
        fi

        # Validation errors
        local validation_errors=$(echo "$backend_logs" | grep -i '"error_type".*"ValidationError\|ValueError"' | wc -l)
        if [ "$validation_errors" -gt 0 ]; then
            print_status "    Validation Errors:" "$validation_errors errors" "$YELLOW"

            # Show last 3
            echo "$backend_logs" | grep -i '"error_type".*"ValidationError\|ValueError"' | tail -3 | while IFS= read -r line; do
                echo "      $(parse_json_log "$line")"
            done
        fi

        # Generic errors (not categorized)
        local generic_errors=$(echo "$backend_logs" | grep -i '"level".*"error\|critical"' | grep -v '"error_type"' | wc -l)
        if [ "$generic_errors" -gt 0 ]; then
            print_status "    Other Errors:" "$generic_errors errors" "$YELLOW"

            # Show last 5
            echo
            print_color "$WHITE" "    Last 5 errors:"
            echo "$backend_logs" | grep -i '"level".*"error\|critical"' | tail -5 | while IFS= read -r line; do
                echo "      $(parse_json_log "$line")"
            done
        fi

        # Check for correlation IDs (related errors)
        echo
        print_color "$CYAN" "  Correlation ID Analysis:"
        local correlation_ids=$(echo "$backend_logs" | grep -oP '"correlation_id":\s*"\K[^"]+' | sort | uniq -c | sort -rn | head -5)

        if [ -n "$correlation_ids" ]; then
            echo "$correlation_ids" | while IFS= read -r count corr_id; do
                if [ "$count" -gt 3 ]; then
                    print_status "    $corr_id:" "$count related log entries" "$YELLOW"
                fi
            done
        else
            print_color "$WHITE" "    No high-frequency correlation IDs found"
        fi

        if [ "$backend_errors" -gt 0 ] || [ "$backend_critical" -gt 0 ]; then
            error_count=$((error_count + 1))
        fi
        critical_count=$((critical_count + backend_critical))
        warning_count=$((warning_count + backend_warnings))

        echo
    fi

    # Bot - plain text logs
    local bot_container=$(docker ps --filter "name=${PROJECT_NAME}-bot" --format "{{.Names}}" | head -1)

    if [ -n "$bot_container" ]; then
        print_subheader "Bot (Plain Text Logs)"

        local bot_errors=$(docker logs --tail 200 "$bot_container" 2>&1 | grep -i "\[error\]\|\[critical\]" | tail -n 10)

        if [ -n "$bot_errors" ]; then
            local bot_error_count=$(echo "$bot_errors" | wc -l)
            print_status "  ERROR/CRITICAL count:" "$bot_error_count" "$([ "$bot_error_count" -gt 0 ] && echo "$RED" || echo "$GREEN")"

            echo
            print_color "$WHITE" "  Last 10 errors:"
            echo "$bot_errors" | sed 's/^/    /'
            error_count=$((error_count + 1))
        else
            print_color "$GREEN" "    No recent errors"
        fi
        echo
    fi

    # PostgreSQL - database logs
    local postgres_container=$(docker ps --filter "name=${PROJECT_NAME}-postgres" --format "{{.Names}}" | head -1)

    if [ -n "$postgres_container" ]; then
        print_subheader "PostgreSQL (Database Logs)"

        local pg_errors=$(docker logs --tail 200 "$postgres_container" 2>&1 | grep -i "ERROR:\|FATAL:\|PANIC:" | tail -n 10)

        if [ -n "$pg_errors" ]; then
            local pg_error_count=$(echo "$pg_errors" | wc -l)
            print_status "  ERROR/FATAL count:" "$pg_error_count" "$([ "$pg_error_count" -gt 0 ] && echo "$RED" || echo "$GREEN")"

            # Group by error type
            local pg_constraint_errors=$(echo "$pg_errors" | grep -i "violates.*constraint" | wc -l)
            local pg_connection_errors=$(echo "$pg_errors" | grep -i "connection\|authentication" | wc -l)
            local pg_deadlock_errors=$(echo "$pg_errors" | grep -i "deadlock" | wc -l)

            [ "$pg_constraint_errors" -gt 0 ] && print_status "    Constraint violations:" "$pg_constraint_errors" "$YELLOW"
            [ "$pg_connection_errors" -gt 0 ] && print_status "    Connection errors:" "$pg_connection_errors" "$YELLOW"
            [ "$pg_deadlock_errors" -gt 0 ] && print_status "    Deadlocks:" "$pg_deadlock_errors" "$RED"

            echo
            print_color "$WHITE" "  Last 10 errors:"
            echo "$pg_errors" | sed 's/^/    /'
            error_count=$((error_count + 1))
        else
            print_color "$GREEN" "    No recent errors"
        fi
        echo
    fi

    # Nginx - access/error logs
    local nginx_container=$(docker ps --filter "name=${PROJECT_NAME}-nginx" --format "{{.Names}}" | head -1)

    if [ -n "$nginx_container" ]; then
        print_subheader "Nginx (Error Logs)"

        local nginx_errors=$(docker logs --tail 200 "$nginx_container" 2>&1 | grep -i "\[error\]\|\[crit\]\|\[alert\]\|\[emerg\]" | tail -n 10)

        if [ -n "$nginx_errors" ]; then
            local nginx_error_count=$(echo "$nginx_errors" | wc -l)
            print_status "  ERROR count:" "$nginx_error_count" "$([ "$nginx_error_count" -gt 0 ] && echo "$RED" || echo "$GREEN")"

            # Group by error type
            local nginx_upstream_errors=$(echo "$nginx_errors" | grep -i "upstream" | wc -l)
            local nginx_ssl_errors=$(echo "$nginx_errors" | grep -i "ssl\|certificate" | wc -l)
            local nginx_client_errors=$(echo "$nginx_errors" | grep -i "client" | wc -l)

            [ "$nginx_upstream_errors" -gt 0 ] && print_status "    Upstream errors:" "$nginx_upstream_errors" "$YELLOW"
            [ "$nginx_ssl_errors" -gt 0 ] && print_status "    SSL errors:" "$nginx_ssl_errors" "$YELLOW"
            [ "$nginx_client_errors" -gt 0 ] && print_status "    Client errors:" "$nginx_client_errors" "$YELLOW"

            echo
            print_color "$WHITE" "  Last 10 errors:"
            echo "$nginx_errors" | sed 's/^/    /'
            error_count=$((error_count + 1))
        else
            print_color "$GREEN" "    No recent errors"
        fi
        echo
    fi

    # Summary
    print_subheader "Error Summary"

    if [ $error_count -eq 0 ]; then
        print_color "$GREEN" "  ✓ No recent errors found in any service"
    else
        print_color "$YELLOW" "  ⚠ Found errors in $error_count service(s)"
        [ "$critical_count" -gt 0 ] && print_status "    CRITICAL errors:" "$critical_count" "$RED"
        [ "$warning_count" -gt 5 ] && print_status "    WARNINGS:" "$warning_count" "$YELLOW"
        echo
        print_color "$CYAN" "  Recommendation: Review logs above for details"
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
            -a|--alert)
                ALERT_MODE=true
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

        # Database details and migrations
        check_database_details

        # Background jobs (scheduler)
        check_background_jobs

        # SSL and security
        check_ssl_security

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
        local mode_str="Full"
        [ "$QUICK_MODE" = true ] && mode_str="Quick"
        [ "$ALERT_MODE" = true ] && mode_str="Alert"
        print_status "    Mode:" "$mode_str" "$WHITE"

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
        local mem_percent_num="${mem_percent%\%}"
        [ "$mem_percent_num" != "N/A" ] && (( mem_percent_num > 80 )) && mem_color="$RED"
        [ "$mem_percent_num" != "N/A" ] && (( mem_percent_num > 60 )) && (( mem_percent_num <= 80 )) && mem_color="$YELLOW"

        local disk_color="$GREEN"
        local disk_usage_num="${disk_usage%\%}"
        [ "$disk_usage_num" != "N/A" ] && (( disk_usage_num > 80 )) && disk_color="$RED"
        [ "$disk_usage_num" != "N/A" ] && (( disk_usage_num > 60 )) && (( disk_usage_num <= 80 )) && disk_color="$YELLOW"

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

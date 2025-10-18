#!/bin/bash
################################################################################
# Family Budget - Phase 1 Critical Fixes
################################################################################
#
# Description:
#   Автоматическое применение критических исправлений из Фазы 1:
#   1. Применить миграцию 013 (t_f_refresh_token table)
#   2. Перезагрузить nginx (healthcheck fix)
#   3. Настроить UFW правила (PostgreSQL + HTTP/HTTPS)
#   4. Перезапустить backend и bot
#   5. Проверить результаты
#
# Usage:
#   # На production сервере (budget-dev.ikeniborn.ru)
#   cd /opt/budget
#   sudo ./scripts/fix_phase1_critical.sh
#
# Prerequisites:
#   - Файлы уже скопированы на сервер через ./setup.sh
#   - Docker compose работает
#   - .env файл настроен
#
# Exit Codes:
#   0 - Success
#   1 - General error
#   2 - Migration failed
#   3 - Container restart failed
#
################################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATION_FILE="backend/db/migrations/013_create_refresh_tokens_table.sql"
POSTGRES_ALLOWED_IP="${POSTGRES_ALLOWED_IP:-78.107.114.37}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Functions
# ============================================================================

log() {
    echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] ✓${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%H:%M:%S')] ✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%H:%M:%S')] ⚠${NC} $1"
}

print_banner() {
    echo ""
    echo "========================================"
    echo "  Family Budget - Phase 1 Critical Fixes"
    echo "========================================"
    echo ""
}

print_section() {
    echo ""
    echo "----------------------------------------"
    echo "  $1"
    echo "----------------------------------------"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This script must be run as root (use sudo)"
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found"
        exit 1
    fi

    if ! docker compose ps &> /dev/null; then
        log_error "Docker Compose not available"
        exit 1
    fi

    log_success "Docker environment ready"
}

check_postgres_running() {
    log "Checking PostgreSQL container..."

    if docker compose ps postgres | grep -q "Up"; then
        log_success "PostgreSQL container is running"
        return 0
    else
        log_error "PostgreSQL container is not running"
        log_error "Start it with: docker compose up -d postgres"
        exit 1
    fi
}

# ============================================================================
# Fix 1: Apply Migration 013
# ============================================================================

apply_migration_013() {
    print_section "FIX 1: Applying Migration 013"

    local migration_path="${PROJECT_ROOT}/${MIGRATION_FILE}"

    if [ ! -f "$migration_path" ]; then
        log_error "Migration file not found: $migration_path"
        log_error "Run ./setup.sh first to copy files to production"
        exit 2
    fi

    log "Checking if migration already applied..."

    # Check if table exists
    if docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token" &>/dev/null; then
        log_warning "Table t_f_refresh_token already exists"
        log_warning "Skipping migration (already applied)"
        return 0
    fi

    log "Applying migration: 013_create_refresh_tokens_table.sql"

    if docker compose exec -T postgres psql -U familybudget familybudget < "$migration_path"; then
        log_success "Migration 013 applied successfully"
    else
        log_error "Migration 013 failed"
        exit 2
    fi

    # Verify table created
    log "Verifying table creation..."

    if docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token" &>/dev/null; then
        log_success "Table t_f_refresh_token verified"
    else
        log_error "Table verification failed"
        exit 2
    fi

    # Verify indexes
    local index_count=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 't_f_refresh_token'" | tr -d ' ')

    log "Found $index_count indexes on t_f_refresh_token"

    if [ "$index_count" -ge 5 ]; then
        log_success "All indexes created"
    else
        log_warning "Expected 6 indexes, found $index_count"
    fi
}

# ============================================================================
# Fix 2: Reload Nginx Configuration
# ============================================================================

reload_nginx() {
    print_section "FIX 2: Reloading Nginx Configuration"

    log "Testing nginx configuration..."

    if docker compose exec nginx nginx -t 2>&1 | grep -q "successful"; then
        log_success "Nginx configuration is valid"
    else
        log_error "Nginx configuration test failed"
        docker compose exec nginx nginx -t
        exit 1
    fi

    log "Reloading nginx..."

    if docker compose exec nginx nginx -s reload; then
        log_success "Nginx reloaded successfully"
    else
        log_error "Nginx reload failed"
        exit 1
    fi

    # Wait for reload
    sleep 2

    # Test healthcheck endpoint
    log "Testing health check endpoint..."

    if curl -sf http://localhost/health >/dev/null; then
        log_success "Health check endpoint responds"
    else
        log_warning "Health check endpoint not responding (may need backend restart)"
    fi
}

# ============================================================================
# Fix 3: Configure UFW Firewall
# ============================================================================

configure_ufw() {
    print_section "FIX 3: Configuring UFW Firewall"

    if ! command -v ufw &> /dev/null; then
        log_warning "UFW not found, skipping firewall configuration"
        return 0
    fi

    # Check if UFW is enabled
    if ! ufw status | grep -q "Status: active"; then
        log_warning "UFW is not active, skipping firewall configuration"
        return 0
    fi

    log "Configuring UFW rules..."

    # Allow HTTP (port 80)
    log "Allowing HTTP (port 80)..."
    if ufw allow 80/tcp comment 'HTTP' &>/dev/null; then
        log_success "HTTP port 80 allowed"
    else
        log_warning "Failed to add HTTP rule (may already exist)"
    fi

    # Allow HTTPS (port 443)
    log "Allowing HTTPS (port 443)..."
    if ufw allow 443/tcp comment 'HTTPS' &>/dev/null; then
        log_success "HTTPS port 443 allowed"
    else
        log_warning "Failed to add HTTPS rule (may already exist)"
    fi

    # Allow PostgreSQL from specific IP
    log "Allowing PostgreSQL from ${POSTGRES_ALLOWED_IP}:5432..."
    if ufw allow from "$POSTGRES_ALLOWED_IP" to any port 5432 proto tcp comment 'PostgreSQL external access' &>/dev/null; then
        log_success "PostgreSQL access allowed for $POSTGRES_ALLOWED_IP"
    else
        log_warning "Failed to add PostgreSQL rule (may already exist)"
    fi

    # Show current status
    log "Current UFW status:"
    ufw status numbered | grep -E "5432|80|443" || log_warning "No matching rules found"
}

# ============================================================================
# Fix 4: Restart Backend and Bot Containers
# ============================================================================

restart_containers() {
    print_section "FIX 4: Restarting Backend and Bot Containers"

    log "Restarting backend container..."
    docker compose restart backend

    log "Restarting bot container..."
    docker compose restart bot

    log "Waiting for containers to start (10 seconds)..."
    sleep 10

    # Check container status
    log "Checking container status..."

    local backend_status=$(docker compose ps backend --format json | jq -r '.[0].Health // .[0].State')
    local bot_status=$(docker compose ps bot --format json | jq -r '.[0].Health // .[0].State')

    echo ""
    echo "Container Status:"
    echo "  backend: $backend_status"
    echo "  bot:     $bot_status"
    echo ""

    if [[ "$backend_status" == *"running"* ]] || [[ "$backend_status" == *"healthy"* ]]; then
        log_success "Backend container is running"
    else
        log_warning "Backend container may have issues"
    fi

    if [[ "$bot_status" == *"running"* ]] || [[ "$bot_status" == *"Up"* ]]; then
        log_success "Bot container is running"
    else
        log_warning "Bot container may have issues"
    fi
}

# ============================================================================
# Verification
# ============================================================================

verify_fixes() {
    print_section "VERIFICATION"

    echo ""
    echo "Checking critical tables..."

    local tables=("t_d_user" "t_d_article" "t_f_budget_fact" "t_f_refresh_token" "t_d_article_hierarchy")

    for table in "${tables[@]}"; do
        echo -n "  $table: "
        if docker compose exec -T postgres psql -U familybudget familybudget -c "\d $table" &>/dev/null; then
            echo -e "${GREEN}✓ EXISTS${NC}"
        else
            echo -e "${RED}✗ MISSING${NC}"
        fi
    done

    echo ""
    echo "Checking container health..."

    docker compose ps

    echo ""
    echo "Checking backend logs for errors..."

    local error_count=$(docker compose logs backend --tail=50 | grep -i "error" | grep -v "no errors" | wc -l)

    if [ "$error_count" -gt 0 ]; then
        log_warning "Found $error_count error lines in backend logs"
        echo "Recent errors:"
        docker compose logs backend --tail=50 | grep -i "error" | grep -v "no errors" | tail -5
    else
        log_success "No errors in recent backend logs"
    fi

    echo ""
    echo "Testing health endpoint..."

    if curl -sf http://localhost:8000/health | jq . 2>/dev/null; then
        log_success "Health endpoint responds"
    else
        log_error "Health endpoint not responding"
    fi
}

# ============================================================================
# Summary
# ============================================================================

print_summary() {
    echo ""
    echo "========================================"
    echo "  Phase 1 Fixes Summary"
    echo "========================================"
    echo ""
    echo "Fixes Applied:"
    echo "  ✓ Migration 013 (t_f_refresh_token table)"
    echo "  ✓ Nginx healthcheck configuration"
    echo "  ✓ UFW firewall rules (80, 443, 5432)"
    echo "  ✓ Backend and Bot containers restarted"
    echo ""
    echo "Next Steps:"
    echo "  1. Test Telegram Bot authorization: /start in Telegram"
    echo "  2. Check backend logs: docker compose logs backend -f"
    echo "  3. Test health endpoint: curl http://localhost:8000/health"
    echo "  4. Proceed to Phase 2 (Web Authorization)"
    echo ""
    echo "Documentation:"
    echo "  - docs/deployment/APPLY_MIGRATION_013.md"
    echo "  - docs/PROJECT_STATUS_REPORT.md"
    echo ""
    echo "========================================"
    echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    print_banner

    # Pre-flight checks
    check_root
    check_docker
    check_postgres_running

    # Apply fixes
    apply_migration_013
    reload_nginx
    configure_ufw
    restart_containers

    # Verify
    verify_fixes

    # Summary
    print_summary

    log_success "Phase 1 Critical Fixes completed successfully!"

    exit 0
}

# Run main
main "$@"

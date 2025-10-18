#!/bin/bash
#
# Family Budget - Deployment Script
#
# This script deploys the Family Budget application using Docker Compose:
# - Validates prerequisites (Docker, .env file)
# - Builds Docker images
# - Starts services
# - Waits for healthy status
# - Runs database migrations
# - Displays deployment status and URLs
#
# Usage:
#   ./deploy.sh [OPTIONS]
#
# Options:
#   -h, --help              Show this help message
#   -b, --build             Force rebuild of Docker images
#   -d, --detach            Run in detached mode (default)
#   -f, --foreground        Run in foreground (show logs)
#   -p, --profile PROFILE   Docker Compose profile (default: none, full: all services)
#   --no-migrate            Skip database migrations
#   --clean                 Clean deployment (remove volumes)
#
# Examples:
#   ./deploy.sh                    # Basic deployment (postgres + backend)
#   ./deploy.sh --profile full     # Full deployment (+ nginx + bot + certbot)
#   ./deploy.sh --build            # Rebuild images and deploy
#   ./deploy.sh --clean            # Clean deployment (removes data!)
#
# Author: Family Budget Team
# Version: 1.0.0
# Date: 2025-10-14
#

set -e  # Exit on error
set -u  # Exit on undefined variable

# =============================================================================
# CONFIGURATION
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="/opt/budget"  # Deployment directory (runtime files)
PROJECT_NAME="familybudget"
LOG_FILE="$DEPLOY_DIR/logs/deploy.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default options
BUILD_IMAGES=false
DETACH_MODE=true
RUN_MIGRATIONS=true
CLEAN_DEPLOY=false
COMPOSE_PROFILE=""

# Service health check configuration
MAX_WAIT_TIME=120  # Maximum wait time for services (seconds)
CHECK_INTERVAL=5   # Interval between health checks (seconds)

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

# Print colored message
print_message() {
    local color=$1
    shift
    echo -e "${color}$*${NC}"
}

# Print info message
info() {
    print_message "$BLUE" "[INFO] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [INFO] $*" >> "$LOG_FILE"
}

# Print success message
success() {
    print_message "$GREEN" "[SUCCESS] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [SUCCESS] $*" >> "$LOG_FILE"
}

# Print warning message
warning() {
    print_message "$YELLOW" "[WARNING] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [WARNING] $*" >> "$LOG_FILE"
}

# Print error message and exit
error() {
    print_message "$RED" "[ERROR] $*"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [ERROR] $*" >> "$LOG_FILE"
    exit 1
}

# Print step message
step() {
    print_message "$MAGENTA" "▶ $*"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check if running with root/sudo privileges
check_root_privileges() {
    if [[ $EUID -ne 0 ]]; then
        return 1
    fi
    return 0
}

# Print help message
print_help() {
    cat << EOF
Family Budget - Deployment Script

Usage:
  ./deploy.sh [OPTIONS]

Options:
  -h, --help              Show this help message
  -b, --build             Force rebuild of Docker images
  -d, --detach            Run in detached mode (default)
  -f, --foreground        Run in foreground (show logs)
  -p, --profile PROFILE   Docker Compose profile (default: none, full: all services)
  --no-migrate            Skip database migrations
  --clean                 Clean deployment (remove volumes) - WARNING: DELETES DATA!

Examples:
  ./deploy.sh                    # Basic deployment (postgres + backend)
  ./deploy.sh --profile full     # Full deployment (+ nginx + bot + certbot)
  ./deploy.sh --build            # Rebuild images and deploy
  ./deploy.sh --foreground       # Deploy and show logs

Profiles:
  none (default)   - PostgreSQL + Backend only
  full             - All services (PostgreSQL + Backend + Bot + Nginx + Certbot)

Prerequisites:
  - Docker and Docker Compose installed (run install.sh)
  - .env file configured (run setup.sh or copy from .env.example)
  - Proper directory structure (data/, backups/, logs/)

For more information, see TASK-060_COMPLETION.md
EOF
}

# =============================================================================
# VALIDATION FUNCTIONS
# =============================================================================

# Check prerequisites
check_prerequisites() {
    info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command_exists docker; then
        error "Docker is not installed. Please run install.sh first."
    fi

    # Check if Docker Compose is installed
    if ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is not installed. Please run install.sh first."
    fi

    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker daemon is not running. Please start Docker service."
    fi

    # Check if .env file exists
    if [[ ! -f "$DEPLOY_DIR/.env" ]]; then
        error ".env file not found in $DEPLOY_DIR. Please run setup.sh or copy from .env.example"
    fi

    # Check if docker-compose.yml exists
    if [[ ! -f "$DEPLOY_DIR/docker-compose.yml" ]]; then
        error "docker-compose.yml not found in $DEPLOY_DIR"
    fi

    # Check required directories
    local required_dirs=("data" "backups" "logs")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$DEPLOY_DIR/$dir" ]]; then
            warning "Directory $dir not found in $DEPLOY_DIR, creating..."
            mkdir -p "$DEPLOY_DIR/$dir"
        fi
    done

    success "Prerequisites check passed"
}

# Validate environment variables
validate_env() {
    info "Validating environment variables..."

    # Check if .env file is readable
    if [[ ! -r "$DEPLOY_DIR/.env" ]]; then
        error ".env file is not readable. Please check file permissions."
        echo ""
        echo "File: $DEPLOY_DIR/.env"
        echo "Current user: $(whoami)"
        echo ""
        echo "To fix:"
        echo "  1. Run deploy.sh as the same user who ran setup.sh"
        echo "  2. Or fix permissions: chmod 640 $DEPLOY_DIR/.env"
        echo "  3. Ensure you're in the docker group: groups | grep docker"
        exit 1
    fi

    # Source .env file
    set -a
    source "$DEPLOY_DIR/.env"
    set +a

    # Check required variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "JWT_SECRET"
        "TELEGRAM_BOT_TOKEN"
        "ADMIN_TELEGRAM_ID"
    )

    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            missing_vars+=("$var")
        fi
    done

    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
    fi

    # Check for default values that should be changed
    if [[ "$POSTGRES_PASSWORD" == "CHANGE_ME_STRONG_PASSWORD_HERE" ]]; then
        error "POSTGRES_PASSWORD is not set. Please configure .env file."
    fi

    if [[ "$JWT_SECRET" == "CHANGE_ME_GENERATE_WITH_OPENSSL" ]]; then
        error "JWT_SECRET is not set. Please configure .env file."
    fi

    success "Environment variables validated"
}

# =============================================================================
# NETWORK AND CLEANUP FUNCTIONS
# =============================================================================

# Cleanup containers and networks only (safe - keeps data)
cleanup_containers_networks() {
    info "Stopping and removing old containers and networks..."

    # Stop all familybudget containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Stopping containers: $containers"
        echo "$containers" | xargs docker stop >> "$LOG_FILE" 2>&1 || true
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
        success "Containers removed"
    fi

    # Remove all familybudget networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing networks: $networks"
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
        success "Networks removed"
    fi

    success "Safe cleanup completed (data volumes preserved)"
}

# Full cleanup - containers + networks + volumes (DELETES DATA!)
cleanup_full() {
    warning "Full cleanup will DELETE ALL DATA including database!"
    echo ""

    # Check for root privileges (required for PostgreSQL data deletion)
    if ! check_root_privileges; then
        error "Full cleanup requires root privileges to delete PostgreSQL data!"
        echo ""
        echo "Please run deploy.sh with sudo:"
        echo "  sudo $SCRIPT_DIR/deploy.sh [OPTIONS]"
        echo ""
        echo "Or manually delete PostgreSQL data after deployment:"
        echo "  sudo rm -rf $DEPLOY_DIR/data/postgres/*"
        echo ""
        exit 1
    fi

    read -p "Type 'DELETE' to confirm full cleanup: " confirm
    echo ""

    if [[ "$confirm" != "DELETE" ]]; then
        info "Full cleanup cancelled"
        return 0
    fi

    info "Performing full cleanup..."

    # Stop and remove containers
    local containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null || echo "")
    if [[ -n "$containers" ]]; then
        info "Stopping containers..."
        echo "$containers" | xargs docker stop >> "$LOG_FILE" 2>&1 || true
        info "Removing containers..."
        echo "$containers" | xargs docker rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove networks
    local networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$networks" ]]; then
        info "Removing networks..."
        echo "$networks" | xargs docker network rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove volumes
    local volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null || echo "")
    if [[ -n "$volumes" ]]; then
        warning "Removing volumes (DATA DELETION)..."
        echo "$volumes" | xargs docker volume rm >> "$LOG_FILE" 2>&1 || true
    fi

    # Remove data directories
    if [[ -d "$DEPLOY_DIR/data/postgres" ]]; then
        warning "Removing PostgreSQL data directory..."
        if ! sudo rm -rf "$DEPLOY_DIR/data/postgres"/* >> "$LOG_FILE" 2>&1; then
            error "Failed to remove PostgreSQL data directory. Check sudo privileges."
        fi
    fi

    success "Full cleanup completed (ALL DATA DELETED)"
}

# Check for old deployments and offer cleanup options
cleanup_old_deployment() {
    step "Checking for Old Deployments"

    # Count old artifacts
    local old_containers=$(docker ps -a --filter "name=familybudget" --format "{{.Names}}" 2>/dev/null | wc -l)
    local old_networks=$(docker network ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)
    local old_volumes=$(docker volume ls --filter "name=familybudget" --format "{{.Name}}" 2>/dev/null | wc -l)

    # If nothing found, skip
    if [[ $old_containers -eq 0 && $old_networks -eq 0 && $old_volumes -eq 0 ]]; then
        info "No old deployments found"
        return 0
    fi

    # Display findings
    warning "Found old deployment artifacts:"
    if [[ $old_containers -gt 0 ]]; then
        echo "  - Containers: $old_containers"
        docker ps -a --filter "name=familybudget" --format "    {{.Names}} ({{.Status}})" 2>/dev/null
    fi
    if [[ $old_networks -gt 0 ]]; then
        echo "  - Networks: $old_networks"
        docker network ls --filter "name=familybudget" --format "    {{.Name}}" 2>/dev/null
    fi
    if [[ $old_volumes -gt 0 ]]; then
        echo "  - Volumes: $old_volumes"
        docker volume ls --filter "name=familybudget" --format "    {{.Name}}" 2>/dev/null
    fi
    echo ""

    # Offer cleanup options
    warning "Old deployments may cause network conflicts!"
    echo "Choose cleanup action:"
    echo "  [1] Skip - deploy alongside old deployment (may cause subnet conflicts)"
    echo "  [2] Safe cleanup - stop & remove containers + networks (KEEPS data)"
    echo "  [3] Full cleanup - containers + networks + volumes (DELETES ALL DATA!)"
    echo "      ⚠️  Requires sudo/root privileges"
    echo ""

    read -p "Select [1-3]: " choice
    echo ""

    case $choice in
        1)
            info "Skipping cleanup (network conflicts may occur)"
            return 0
            ;;
        2)
            cleanup_containers_networks
            ;;
        3)
            cleanup_full
            ;;
        *)
            error "Invalid choice. Please select 1, 2, or 3."
            ;;
    esac
}

# Find free subnets in range 172.20-172.30
find_free_subnets() {
    info "Scanning Docker networks for used subnets..." >&2

    # Get all used subnets in 172.X.0.0/16 format
    local used_subnets=$(docker network ls --format "{{.Name}}" 2>/dev/null | while read net; do
        docker network inspect "$net" -f '{{range .IPAM.Config}}{{.Subnet}}{{end}}' 2>/dev/null
    done | grep -E '^172\.[0-9]+\.0\.0/16' | sort -u)

    if [[ -n "$used_subnets" ]]; then
        info "Used subnets in 172.X.0.0/16 range:" >&2
        echo "$used_subnets" | sed 's/^/  - /' >&2
        echo "" >&2
    fi

    # Find 2 free consecutive subnets in 172.20-172.30 range
    local free_internal=""
    local free_external=""

    for i in {20..30}; do
        local subnet="172.$i.0.0/16"
        if ! echo "$used_subnets" | grep -q "$subnet"; then
            if [[ -z "$free_internal" ]]; then
                free_internal="$subnet"
            elif [[ -z "$free_external" ]]; then
                free_external="$subnet"
                break
            fi
        fi
    done

    # Return found subnets (or empty if not found)
    echo "$free_internal|$free_external"
}

# Prompt for manual subnet input
prompt_manual_subnets() {
    warning "Manual subnet configuration"
    echo ""
    echo "Enter custom subnets (format: 172.X.0.0/16):"
    echo ""

    read -p "Internal network subnet [172.20.0.0/16]: " internal_subnet
    internal_subnet=${internal_subnet:-172.20.0.0/16}

    read -p "External network subnet [172.21.0.0/16]: " external_subnet
    external_subnet=${external_subnet:-172.21.0.0/16}

    echo ""
    info "Selected subnets:"
    echo "  Internal: $internal_subnet"
    echo "  External: $external_subnet"
    echo ""

    read -p "Confirm these subnets? [Y/n]: " confirm

    if [[ "${confirm,,}" == "n" ]]; then
        error "Subnet configuration cancelled by user"
    fi

    create_networks_override "$internal_subnet" "$external_subnet"
}

# Create docker-compose.networks.yml with specified subnets
create_networks_override() {
    local internal_subnet=$1
    local external_subnet=$2

    local networks_file="$DEPLOY_DIR/docker-compose.networks.yml"

    info "Creating network configuration: $networks_file"

    cat > "$networks_file" << EOF
# Docker Compose Networks Override - Auto-generated by deploy.sh
# Contains network subnet configuration to avoid conflicts
# DO NOT EDIT MANUALLY - regenerated on each deployment

networks:
  familybudget_internal:
    driver: bridge
    internal: true
    ipam:
      driver: default
      config:
        - subnet: $internal_subnet

  familybudget_external:
    driver: bridge
    ipam:
      driver: default
      config:
        - subnet: $external_subnet
EOF

    success "Network configuration created"
    info "  Internal subnet: $internal_subnet"
    info "  External subnet: $external_subnet"
    info "  Config file: $networks_file"
}

# Check and select available subnets
check_and_select_subnets() {
    step "Network Subnet Configuration"

    # Find free subnets
    local subnets=$(find_free_subnets)
    local free_internal=$(echo "$subnets" | cut -d'|' -f1)
    local free_external=$(echo "$subnets" | cut -d'|' -f2)

    # Check if we found 2 free subnets
    if [[ -z "$free_internal" || -z "$free_external" ]]; then
        error "Could not find 2 free subnets in range 172.20-172.30. Please use manual configuration."
    fi

    echo ""
    success "Available subnets detected:"
    echo "  Internal network: $free_internal"
    echo "  External network: $free_external"
    echo ""

    read -p "Use these subnets? [Y/n]: " use_auto
    echo ""

    if [[ "${use_auto,,}" == "n" ]]; then
        prompt_manual_subnets
    else
        create_networks_override "$free_internal" "$free_external"
    fi
}

# Check if port is available
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
            echo "Опции:"
            echo "  [1] Остановить host certbot (временно) и продолжить деплой (рекомендуется)"
            echo "  [2] Отключить host certbot навсегда и продолжить"
            echo "  [3] Отменить деплой"
            echo ""

            read -p "Выберите [1-3]: " choice
            echo ""

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
            echo "Опции:"
            echo "  [1] Остановить процесс и продолжить"
            echo "  [2] Изменить порт в .env файле"
            echo "  [3] Отменить деплой"
            echo ""

            read -p "Выберите [1-3]: " choice
            echo ""

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

# Helper function to run docker compose with all override files
compose_cmd() {
    local compose_files="-f docker-compose.yml"

    # Add PostgreSQL port override if exists (created by setup.sh)
    if [[ -f "$DEPLOY_DIR/docker-compose.override.yml" ]]; then
        compose_files="$compose_files -f docker-compose.override.yml"
    fi

    # Add network subnet override if exists (created by deploy.sh)
    if [[ -f "$DEPLOY_DIR/docker-compose.networks.yml" ]]; then
        compose_files="$compose_files -f docker-compose.networks.yml"
    fi

    # Change to deployment directory and execute docker compose with all override files
    (cd "$DEPLOY_DIR" && docker compose $compose_files "$@")
}

# =============================================================================
# DEPLOYMENT FUNCTIONS
# =============================================================================

# Build Docker images
build_images() {
    if [[ "$BUILD_IMAGES" == "true" ]]; then
        step "Building Docker images..."

        local build_args=""
        if [[ -n "$COMPOSE_PROFILE" ]]; then
            build_args="--profile $COMPOSE_PROFILE"
        fi

        if compose_cmd $build_args build >> "$LOG_FILE" 2>&1; then
            success "Docker images built successfully"
        else
            error "Failed to build Docker images. Check $LOG_FILE for details."
        fi
    else
        info "Skipping image build (use --build to force rebuild)"
    fi
}

# Stop existing services
stop_services() {
    info "Checking for running services..."

    local running_containers
    running_containers=$(compose_cmd ps -q 2>/dev/null || echo "")

    if [[ -n "$running_containers" ]]; then
        warning "Found running services, stopping..."

        if compose_cmd down >> "$LOG_FILE" 2>&1; then
            success "Services stopped"
        else
            warning "Failed to stop some services (continuing anyway)"
        fi
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

        if [[ "$REPLY" == "yes" ]]; then
            step "Removing volumes and data..."

            # Stop services
            compose_cmd down >> "$LOG_FILE" 2>&1 || true

            # Remove volumes
            if compose_cmd down -v >> "$LOG_FILE" 2>&1; then
                success "Volumes removed"
            else
                warning "Failed to remove some volumes"
            fi

            # Remove data directories
            if [[ -d "$DEPLOY_DIR/data/postgres" ]]; then
                warning "Removing PostgreSQL data directory..."
                if ! sudo rm -rf "$DEPLOY_DIR/data/postgres"/* >> "$LOG_FILE" 2>&1; then
                    error "Failed to remove PostgreSQL data directory. Check sudo privileges."
                fi
            fi
        else
            info "Clean deployment cancelled"
            CLEAN_DEPLOY=false
        fi
    fi
}

# Start services
start_services() {
    step "Starting services..."

    local compose_args=""
    if [[ -n "$COMPOSE_PROFILE" ]]; then
        compose_args="--profile $COMPOSE_PROFILE"
    fi

    local detach_flag=""
    if [[ "$DETACH_MODE" == "true" ]]; then
        detach_flag="-d"
    fi

    info "Running: docker compose $compose_args up $detach_flag"

    if compose_cmd $compose_args up $detach_flag >> "$LOG_FILE" 2>&1; then
        success "Services started"
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
        local health_status
        health_status=$(compose_cmd ps -q "$service_name" 2>/dev/null | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

        case "$health_status" in
            "healthy")
                success "$service_name is healthy"
                return 0
                ;;
            "starting")
                echo -n "."
                ;;
            "unhealthy")
                error "$service_name is unhealthy. Check logs: docker compose logs $service_name"
                ;;
            "none")
                # Service has no health check, check if it's running
                local running_status
                running_status=$(compose_cmd ps -q "$service_name" 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not_running")

                if [[ "$running_status" == "running" ]]; then
                    success "$service_name is running (no health check)"
                    return 0
                else
                    echo -n "."
                fi
                ;;
            *)
                echo -n "."
                ;;
        esac

        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
    done

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

# Run database migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        step "Running database migrations..."

        # Check if backend service is running
        if ! compose_cmd ps -q backend >/dev/null 2>&1; then
            warning "Backend service not running, skipping migrations"
            return 0
        fi

        # Check if alembic is configured
        if [[ ! -f "$DEPLOY_DIR/backend/alembic.ini" ]]; then
            warning "Alembic not configured, skipping migrations"
            return 0
        fi

        # Run migrations
        if compose_cmd exec -T backend alembic upgrade head >> "$LOG_FILE" 2>&1; then
            success "Database migrations completed"
        else
            warning "Database migrations failed (this may be expected for first deployment)"
        fi
    else
        info "Skipping database migrations (--no-migrate specified)"
    fi
}

# Clean up old nginx configuration markers (from previous deployments)
cleanup_nginx_markers() {
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/app.conf"

    # Check if nginx config exists
    if [[ ! -f "$nginx_conf" ]]; then
        # No config yet, nothing to clean
        return 0
    fi

    # Check if file contains old markers (from previous deployments)
    if grep -q "^SSL_HTTPS_START$\|^SSL_HTTPS_END$\|^SSL_REDIRECT_START$\|^SSL_REDIRECT_END$" "$nginx_conf"; then
        info "Detected old SSL markers in nginx config, cleaning up..."

        # Remove marker lines (they should have been removed by update_nginx_for_https)
        sed -i '/^SSL_HTTPS_START$/d' "$nginx_conf"
        sed -i '/^SSL_HTTPS_END$/d' "$nginx_conf"
        sed -i '/^SSL_REDIRECT_START$/d' "$nginx_conf"
        sed -i '/^SSL_REDIRECT_END$/d' "$nginx_conf"

        success "Old SSL markers removed from nginx config"
        info "Configuration file: $nginx_conf"
    fi
}

# =============================================================================
# SSL CERTIFICATE FUNCTIONS
# =============================================================================

# Setup SSL certificates with Let's Encrypt (using host certbot)
setup_ssl_certificates() {
    # Source .env to check SSL_TYPE
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    # Skip if SSL is not letsencrypt
    if [[ "$ssl_type" != "letsencrypt" ]]; then
        info "SSL type is '$ssl_type' - skipping certificate setup"
        return 0
    fi

    # Skip if domain is localhost
    if [[ "$domain" == "localhost" ]]; then
        info "Domain is localhost - skipping SSL certificate setup"
        return 0
    fi

    step "Setting up SSL certificate for $domain..."

    # Check if ssl_certificate_manager.sh exists
    local ssl_manager="$DEPLOY_DIR/scripts/ssl_certificate_manager.sh"
    if [[ ! -f "$ssl_manager" ]]; then
        error "SSL certificate manager script not found: $ssl_manager"
    fi

    # Get Let's Encrypt email
    local email="${LETSENCRYPT_EMAIL:-}"
    if [[ -z "$email" ]]; then
        error "LETSENCRYPT_EMAIL is not set in .env file"
    fi

    # Get server IP (try to detect automatically)
    local server_ip="${SERVER_IP:-}"
    if [[ -z "$server_ip" ]]; then
        # Try to detect public IP
        server_ip=$(curl -s ifconfig.me 2>/dev/null || echo "")
        if [[ -z "$server_ip" ]]; then
            error "SERVER_IP not set in .env and auto-detection failed. Please set SERVER_IP in .env file."
        fi
        info "Auto-detected server IP: $server_ip"
    fi

    # Check if certificate already exists
    if [ -d "/etc/letsencrypt/live/$domain" ]; then
        success "SSL certificate already exists for $domain"

        # Validate certificate
        if sudo "$ssl_manager" check "$domain" >> "$LOG_FILE" 2>&1; then
            info "Certificate is valid"

            # Update nginx configuration to enable HTTPS if not already done
            update_nginx_for_https "$domain"

            # Reload nginx to pick up certificates
            if compose_cmd ps -q nginx >/dev/null 2>&1; then
                info "Reloading nginx with certificates..."
                if compose_cmd exec nginx nginx -s reload >> "$LOG_FILE" 2>&1; then
                    success "Nginx reloaded successfully"
                else
                    warning "Failed to reload nginx"
                fi
            fi

            return 0
        else
            warning "Certificate validation failed, will obtain new certificate"
        fi
    fi

    # Obtain new certificate using ssl_certificate_manager.sh
    info "Obtaining SSL certificate from Let's Encrypt (host certbot)..."
    info "Domain: $domain"
    info "Email: $email"
    info "Server IP: $server_ip"
    echo ""

    if sudo "$ssl_manager" obtain "$domain" "$email" "$server_ip" >> "$LOG_FILE" 2>&1; then
        success "SSL certificate obtained successfully!"

        # Update nginx configuration to enable HTTPS
        update_nginx_for_https "$domain"

        # Start nginx if not running (may have been stopped by ssl_certificate_manager)
        if ! compose_cmd ps -q nginx >/dev/null 2>&1; then
            info "Starting nginx..."
            compose_cmd start nginx >> "$LOG_FILE" 2>&1 || true
            sleep 3
        fi

        # Reload nginx with new configuration
        info "Reloading nginx with new configuration..."
        if compose_cmd exec nginx nginx -s reload >> "$LOG_FILE" 2>&1; then
            success "Nginx reloaded successfully"
        else
            warning "Failed to reload nginx. Restarting..."
            compose_cmd restart nginx >> "$LOG_FILE" 2>&1 || true
        fi

        success "SSL certificate setup completed!"
    else
        error "Failed to obtain SSL certificate. Check $LOG_FILE for details."
    fi
}

# Update nginx configuration to enable HTTPS
update_nginx_for_https() {
    local domain=$1
    local nginx_conf="$DEPLOY_DIR/nginx/conf.d/app.conf"

    if [[ ! -f "$nginx_conf" ]]; then
        error "Nginx configuration not found: $nginx_conf"
    fi

    info "Updating nginx configuration to enable HTTPS..."

    # Uncomment HTTPS server block and remove markers
    sed -i '/# SSL_HTTPS_START/,/# SSL_HTTPS_END/{
        /# SSL_HTTPS_START/d
        /# SSL_HTTPS_END/d
        s/^# //
    }' "$nginx_conf"

    # Uncomment HTTP to HTTPS redirect and remove markers
    sed -i '/# SSL_REDIRECT_START/,/# SSL_REDIRECT_END/{
        /# SSL_REDIRECT_START/d
        /# SSL_REDIRECT_END/d
        s/^# //
    }' "$nginx_conf"

    # Comment out initial HTTP server block (will be replaced by redirect)
    sed -i '/^server {/,/^}$/{
        /# SSL_REDIRECT_START/b
        /server_name {{DOMAIN}};/!b
        s/^/# /
    }' "$nginx_conf" || true

    # Validate nginx configuration (if container is running)
    if compose_cmd ps -q nginx >/dev/null 2>&1 && compose_cmd ps nginx | grep -q "Up"; then
        info "Validating nginx configuration..."
        if compose_cmd exec nginx nginx -t >> "$LOG_FILE" 2>&1; then
            success "Nginx configuration is valid"
        else
            error "Nginx configuration is invalid. Check $LOG_FILE for details."
        fi
    else
        info "Nginx container not running, skipping validation (will be validated on start)"
    fi

    success "Nginx configuration updated for HTTPS"
    info "Configuration file: $nginx_conf"
}

# Verify SSL certificate
verify_ssl() {
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    if [[ "$ssl_type" != "letsencrypt" || "$domain" == "localhost" ]]; then
        return 0
    fi

    step "Verifying SSL certificate..."

    # Check certificate file exists (now on host system)
    local cert_path="/etc/letsencrypt/live/$domain/fullchain.pem"
    if [[ ! -f "$cert_path" ]]; then
        warning "Certificate file not found: $cert_path"
        return 0
    fi

    # Check certificate expiry
    if command_exists openssl; then
        local expiry_date
        expiry_date=$(openssl x509 -enddate -noout -in "$cert_path" | cut -d= -f2)
        info "Certificate expires: $expiry_date"
    fi

    # Test HTTPS connectivity
    info "Testing HTTPS connectivity..."
    if command_exists curl; then
        if curl -Is --max-time 10 "https://$domain/health" >/dev/null 2>&1; then
            success "HTTPS is working correctly!"
            info "URL: https://$domain"
        else
            warning "HTTPS test failed. Certificate may need time to propagate."
            info "Try accessing: https://$domain in a few minutes"
        fi
    else
        info "curl not available - skipping HTTPS test"
    fi
}

# =============================================================================
# FIREWALL MANAGEMENT FOR SSL
# =============================================================================

# Check and open firewall ports for SSL
configure_firewall_for_ssl() {
    # Source .env to check SSL_TYPE and DOMAIN
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"
    local domain="${DOMAIN:-localhost}"

    # Skip if no SSL or localhost
    if [[ "$ssl_type" == "none" || "$domain" == "localhost" ]]; then
        info "No SSL configuration needed (type: $ssl_type, domain: $domain)"
        return 0
    fi

    step "Configuring firewall for SSL..."

    # Check if UFW is installed and active
    if ! command_exists ufw; then
        warning "UFW not installed, skipping firewall configuration"
        return 0
    fi

    if ! sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        warning "UFW is not active, skipping firewall configuration"
        return 0
    fi

    # Check current port status
    local port_80_status=$(sudo ufw status 2>/dev/null | grep "80/tcp" || echo "❌ not configured")
    local port_443_status=$(sudo ufw status 2>/dev/null | grep "443/tcp" || echo "❌ not configured")

    info "Current firewall status:"
    echo "  Port 80:  $port_80_status"
    echo "  Port 443: $port_443_status"
    echo ""

    # Ask user what to do
    warning "SSL Certificate requires firewall configuration"
    echo "Options:"
    echo "  [1] Open ports 80 and 443 (required for new SSL certificate)"
    echo "  [2] Open port 443 only (if certificate already exists)"
    echo "  [3] Skip firewall configuration (manual setup required)"
    echo ""
    read -p "Select [1-3]: " fw_choice
    echo ""

    case $fw_choice in
        1)
            info "Opening ports 80 and 443..."
            sudo ufw allow 80/tcp comment 'HTTP for SSL challenge' >> "$LOG_FILE" 2>&1 || true
            sudo ufw allow 443/tcp comment 'HTTPS' >> "$LOG_FILE" 2>&1 || true
            success "Ports 80 and 443 are now open in firewall"
            ;;
        2)
            info "Opening port 443 only..."
            sudo ufw allow 443/tcp comment 'HTTPS' >> "$LOG_FILE" 2>&1 || true
            success "Port 443 is now open in firewall"
            warning "Port 80 is closed - certificate renewal may fail if not already configured"
            ;;
        3)
            info "Skipping firewall configuration"
            warning "Make sure ports 80 and 443 are accessible for SSL to work!"
            warning "You can manually open ports with:"
            echo "  sudo ufw allow 80/tcp"
            echo "  sudo ufw allow 443/tcp"
            ;;
        *)
            warning "Invalid choice, skipping firewall configuration"
            ;;
    esac
}

# Close port 80 after SSL certificate is obtained (optional)
close_http_port() {
    # Source .env to check SSL_TYPE
    set -a
    source "$DEPLOY_DIR/.env" 2>/dev/null || true
    set +a

    local ssl_type="${SSL_TYPE:-none}"

    # Only relevant for letsencrypt
    if [[ "$ssl_type" != "letsencrypt" ]]; then
        return 0
    fi

    # Check if UFW is available
    if ! command_exists ufw; then
        return 0
    fi

    if ! sudo ufw status 2>/dev/null | grep -q "Status: active"; then
        return 0
    fi

    # Check if port 80 is currently open
    if ! sudo ufw status 2>/dev/null | grep -q "80/tcp"; then
        info "Port 80 is not open in firewall"
        return 0
    fi

    echo ""
    step "Post-SSL Security Configuration"
    echo ""
    info "SSL certificate obtained successfully!"
    echo ""
    warning "Security recommendation: Close HTTP port 80 in firewall"
    echo ""
    echo "What this means:"
    echo "  ✓ Nginx will still listen on port 80 inside Docker (for HTTP→HTTPS redirect)"
    echo "  ✓ UFW will block external access to port 80 (only 443 accessible from internet)"
    echo "  ✓ Certbot renewal will still work (through Docker network)"
    echo "  ✓ Maximum security: HTTPS-only external access"
    echo ""
    echo "  ✗ Direct HTTP access from internet will be blocked"
    echo "  ✗ HTTP→HTTPS redirect won't work from outside (browser will show connection refused)"
    echo ""
    info "Recommended for: High-security production environments"
    info "Not recommended for: Sites requiring HTTP→HTTPS auto-redirect from external sources"
    echo ""
    read -p "Close port 80 in UFW firewall? [y/N]: " close_80
    echo ""

    if [[ "${close_80,,}" == "y" ]]; then
        info "Closing port 80 in UFW..."
        sudo ufw delete allow 80/tcp >> "$LOG_FILE" 2>&1 || true
        success "Port 80 closed in firewall"
        success "External access: HTTPS only (port 443)"
        info "HTTP→HTTPS redirect still works inside Docker network"
        echo ""
        warning "To re-open port 80 later (for certificate renewal or HTTP access):"
        echo "  sudo ufw allow 80/tcp"
    else
        info "Port 80 remains open for HTTP→HTTPS redirect"
        success "External access: Both HTTP (80) and HTTPS (443)"
    fi
}

# =============================================================================
# STATUS FUNCTIONS
# =============================================================================

# Get service status
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

    # Nginx URLs
    if compose_cmd ps -q nginx >/dev/null 2>&1; then
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

# =============================================================================
# MAIN EXECUTION
# =============================================================================

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_help
                exit 0
                ;;
            -b|--build)
                BUILD_IMAGES=true
                shift
                ;;
            -d|--detach)
                DETACH_MODE=true
                shift
                ;;
            -f|--foreground)
                DETACH_MODE=false
                shift
                ;;
            -p|--profile)
                COMPOSE_PROFILE="$2"
                shift 2
                ;;
            --no-migrate)
                RUN_MIGRATIONS=false
                shift
                ;;
            --clean)
                CLEAN_DEPLOY=true
                shift
                ;;
            *)
                error "Unknown option: $1 (use --help for usage)"
                ;;
        esac
    done
}

main() {
    # Parse arguments
    parse_args "$@"

    # Initialize log file
    mkdir -p "$(dirname "$LOG_FILE")"
    touch "$LOG_FILE"
    chmod 644 "$LOG_FILE"

    echo "========================================================================"
    print_message "$BLUE" "       Family Budget - Deployment Script"
    echo "========================================================================"
    echo ""

    # Load .env to check deployment profile
    if [[ -f "$DEPLOY_DIR/.env" ]]; then
        set -a
        source "$DEPLOY_DIR/.env" 2>/dev/null || true
        set +a

        # Auto-detect profile from .env if not specified
        if [[ -z "$COMPOSE_PROFILE" && "${DEPLOYMENT_PROFILE:-basic}" == "full" ]]; then
            COMPOSE_PROFILE="full"
            info "Auto-detected profile from .env: full"
        fi
    fi

    # Display deployment configuration
    info "Deployment configuration:"
    echo "  Build images:     $BUILD_IMAGES"
    echo "  Detach mode:      $DETACH_MODE"
    echo "  Run migrations:   $RUN_MIGRATIONS"
    echo "  Clean deploy:     $CLEAN_DEPLOY"
    if [[ -n "$COMPOSE_PROFILE" ]]; then
        echo "  Profile:          $COMPOSE_PROFILE"
    else
        echo "  Profile:          none (basic: postgres + backend)"
    fi
    if [[ -n "${DEPLOYMENT_PROFILE:-}" ]]; then
        echo "  Deployment type:  ${DEPLOYMENT_PROFILE}"
        if [[ "${SSL_TYPE:-none}" == "letsencrypt" ]]; then
            echo "  SSL:              Automatic (Let's Encrypt)"
        fi
    fi
    echo ""

    # Check if HTTP/HTTPS ports are available (for full profile with nginx)
    if [[ "$COMPOSE_PROFILE" == "full" || "${DEPLOYMENT_PROFILE:-}" == "full" ]]; then
        step "Checking Port Availability"

        # Load .env if not already loaded
        if [[ -z "${HTTP_PORT:-}" ]]; then
            set -a
            source "$DEPLOY_DIR/.env" 2>/dev/null || true
            set +a
        fi

        local http_port="${HTTP_PORT:-80}"
        local https_port="${HTTPS_PORT:-443}"

        info "Checking if ports are available for nginx..."
        check_port_available "$http_port" "HTTP"
        check_port_available "$https_port" "HTTPS"
        echo ""
    fi

    # Deployment steps
    check_prerequisites
    echo ""

    validate_env
    echo ""

    # NEW: Check for old deployments and cleanup if needed
    cleanup_old_deployment
    echo ""

    # NEW: Ensure we have free network subnets
    check_and_select_subnets
    echo ""

    clean_deployment
    echo ""

    build_images
    echo ""

    # stop_services removed - redundant after cleanup_old_deployment

    # Clean up old nginx markers from previous deployments
    cleanup_nginx_markers
    echo ""

    start_services
    echo ""

    if [[ "$DETACH_MODE" == "true" ]]; then
        wait_for_services
        echo ""

        run_migrations
        echo ""

        # Configure firewall before SSL certificate setup
        configure_firewall_for_ssl
        echo ""

        setup_ssl_certificates
        echo ""

        # Optionally close HTTP port after SSL certificate is obtained
        close_http_port
        echo ""

        verify_ssl
        echo ""

        print_status
    else
        info "Running in foreground mode (Ctrl+C to stop)"
        info "Services will be stopped when you exit"
        # Logs will be shown by docker compose up in foreground mode
    fi
}

# Run main function
main "$@"

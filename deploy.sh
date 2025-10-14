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
PROJECT_NAME="familybudget"
LOG_FILE="./logs/deploy.log"

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
    if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
        error ".env file not found. Please run setup.sh or copy from .env.example"
    fi

    # Check if docker-compose.yml exists
    if [[ ! -f "$SCRIPT_DIR/docker-compose.yml" ]]; then
        error "docker-compose.yml not found"
    fi

    # Check required directories
    local required_dirs=("data" "backups" "logs")
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$SCRIPT_DIR/$dir" ]]; then
            warning "Directory $dir not found, creating..."
            mkdir -p "$SCRIPT_DIR/$dir"
        fi
    done

    success "Prerequisites check passed"
}

# Validate environment variables
validate_env() {
    info "Validating environment variables..."

    # Source .env file
    set -a
    source "$SCRIPT_DIR/.env"
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

        if docker compose $build_args build >> "$LOG_FILE" 2>&1; then
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
    running_containers=$(docker compose ps -q 2>/dev/null || echo "")

    if [[ -n "$running_containers" ]]; then
        warning "Found running services, stopping..."

        if docker compose down >> "$LOG_FILE" 2>&1; then
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
            docker compose down >> "$LOG_FILE" 2>&1 || true

            # Remove volumes
            if docker compose down -v >> "$LOG_FILE" 2>&1; then
                success "Volumes removed"
            else
                warning "Failed to remove some volumes"
            fi

            # Remove data directories
            if [[ -d "$SCRIPT_DIR/data/postgres" ]]; then
                warning "Removing PostgreSQL data directory..."
                rm -rf "$SCRIPT_DIR/data/postgres"/*
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

    if [[ "$DETACH_MODE" == "true" ]]; then
        compose_args="$compose_args -d"
    fi

    info "Running: docker compose $compose_args up"

    if docker compose $compose_args up $compose_args >> "$LOG_FILE" 2>&1; then
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
        health_status=$(docker compose ps -q "$service_name" 2>/dev/null | xargs docker inspect --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

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
                running_status=$(docker compose ps -q "$service_name" 2>/dev/null | xargs docker inspect --format='{{.State.Status}}' 2>/dev/null || echo "not_running")

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
    services=$(docker compose ps --services 2>/dev/null || echo "")

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
        if ! docker compose ps -q backend >/dev/null 2>&1; then
            warning "Backend service not running, skipping migrations"
            return 0
        fi

        # Check if alembic is configured
        if [[ ! -f "$SCRIPT_DIR/backend/alembic.ini" ]]; then
            warning "Alembic not configured, skipping migrations"
            return 0
        fi

        # Run migrations
        if docker compose exec -T backend alembic upgrade head >> "$LOG_FILE" 2>&1; then
            success "Database migrations completed"
        else
            warning "Database migrations failed (this may be expected for first deployment)"
        fi
    else
        info "Skipping database migrations (--no-migrate specified)"
    fi
}

# =============================================================================
# STATUS FUNCTIONS
# =============================================================================

# Get service status
get_service_status() {
    local service=$1

    local container_id
    container_id=$(docker compose ps -q "$service" 2>/dev/null || echo "")

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
    services=$(docker compose ps --services 2>/dev/null || echo "")

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
    source "$SCRIPT_DIR/.env" 2>/dev/null || true
    set +a

    local backend_port="${BACKEND_PORT:-8000}"
    local http_port="${HTTP_PORT:-80}"
    local https_port="${HTTPS_PORT:-443}"
    local domain="${DOMAIN:-localhost}"

    # Backend URL
    if docker compose ps -q backend >/dev/null 2>&1; then
        if [[ "$domain" == "localhost" ]]; then
            print_message "$CYAN" "  Backend:     http://localhost:$backend_port"
        else
            print_message "$CYAN" "  Backend:     http://$domain:$backend_port"
        fi
    fi

    # Nginx URLs
    if docker compose ps -q nginx >/dev/null 2>&1; then
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
    echo ""

    # Deployment steps
    check_prerequisites
    echo ""

    validate_env
    echo ""

    clean_deployment
    echo ""

    build_images
    echo ""

    stop_services
    echo ""

    start_services
    echo ""

    if [[ "$DETACH_MODE" == "true" ]]; then
        wait_for_services
        echo ""

        run_migrations
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

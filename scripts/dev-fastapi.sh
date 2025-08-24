#!/bin/bash

# Development script for Family Budget with FastAPI backend
# This script manages the development environment with Docker Compose

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.fastapi.yaml"
ENV_FILE=".env"
ENV_DEV_FILE=".env.dev"
PROJECT_NAME="familybudget"

# Function to print colored messages
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_message "$RED" "❌ Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_message "$GREEN" "✅ Docker is running"
}

# Function to setup environment file
setup_env() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_DEV_FILE" ]; then
            print_message "$YELLOW" "📋 Copying $ENV_DEV_FILE to $ENV_FILE..."
            cp "$ENV_DEV_FILE" "$ENV_FILE"
            print_message "$GREEN" "✅ Environment file created"
        else
            print_message "$RED" "❌ No .env.dev file found. Please create one first."
            exit 1
        fi
    else
        print_message "$GREEN" "✅ Environment file exists"
    fi
}

# Function to initialize database
init_database() {
    print_message "$BLUE" "🗄️  Initializing database..."
    
    # Start only postgres and redis first
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for PostgreSQL to be ready
    print_message "$YELLOW" "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker exec postgres-dev pg_isready -U postgres >/dev/null 2>&1; then
            print_message "$GREEN" "✅ PostgreSQL is ready"
            break
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -eq $max_attempts ]; then
            print_message "$RED" "❌ PostgreSQL failed to start in time"
            exit 1
        fi
        
        echo -n "."
        sleep 1
    done
    
    # Check if database exists and has tables
    if docker exec postgres-dev psql -U postgres -lqt | cut -d \| -f 1 | grep -qw budgetdb; then
        print_message "$GREEN" "✅ Database 'budgetdb' already exists"
        
        # Check if tables exist
        table_count=$(docker exec postgres-dev psql -U budget -d budgetdb -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
        table_count=$(echo $table_count | tr -d ' ')
        
        if [ "$table_count" -gt "0" ]; then
            print_message "$GREEN" "✅ Database tables already exist ($table_count tables)"
        else
            print_message "$YELLOW" "📊 Creating database tables..."
            # Tables will be created by init scripts
        fi
    else
        print_message "$YELLOW" "📊 Creating new database..."
    fi
}

# Function to start services
start_services() {
    local detached_mode=""
    
    if [ "$1" == "-d" ] || [ "$1" == "--detach" ]; then
        detached_mode="-d"
        print_message "$BLUE" "🚀 Starting services in detached mode..."
    else
        print_message "$BLUE" "🚀 Starting services..."
    fi
    
    docker-compose -f "$COMPOSE_FILE" up $detached_mode
}

# Function to stop services
stop_services() {
    print_message "$YELLOW" "🛑 Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down
    print_message "$GREEN" "✅ Services stopped"
}

# Function to clean up everything
cleanup() {
    print_message "$RED" "🧹 Cleaning up everything (including volumes)..."
    docker-compose -f "$COMPOSE_FILE" down -v
    print_message "$GREEN" "✅ Cleanup complete"
}

# Function to show logs
show_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose -f "$COMPOSE_FILE" logs -f
    else
        docker-compose -f "$COMPOSE_FILE" logs -f "$service"
    fi
}

# Function to show status
show_status() {
    print_message "$BLUE" "📊 Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Function to run database migrations
run_migrations() {
    print_message "$BLUE" "🔄 Running database migrations..."
    docker-compose -f "$COMPOSE_FILE" exec backend-fastapi alembic upgrade head
    print_message "$GREEN" "✅ Migrations complete"
}

# Function to show help
show_help() {
    echo "Family Budget Development Script (FastAPI Backend)"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  (no options)     Start all services in foreground"
    echo "  -d, --detach     Start services in detached mode"
    echo "  --init-db        Force database initialization"
    echo "  --stop           Stop all services"
    echo "  --clean          Stop services and remove volumes"
    echo "  --logs [service] Show logs (optionally for specific service)"
    echo "  --status         Show service status"
    echo "  --migrate        Run database migrations"
    echo "  -h, --help       Show this help message"
    echo ""
    echo "Services:"
    echo "  - postgres       PostgreSQL database"
    echo "  - redis          Redis cache"
    echo "  - backend-fastapi FastAPI backend (port 4000)"
    echo "  - frontend       SvelteKit frontend (port 5173)"
    echo ""
    echo "Examples:"
    echo "  $0               # Start all services"
    echo "  $0 -d            # Start in background"
    echo "  $0 --logs        # Show all logs"
    echo "  $0 --logs backend-fastapi  # Show backend logs only"
    echo "  $0 --stop        # Stop all services"
}

# Main script logic
main() {
    # Parse command line arguments
    case "$1" in
        -h|--help)
            show_help
            exit 0
            ;;
        --stop)
            check_docker
            stop_services
            exit 0
            ;;
        --clean)
            check_docker
            cleanup
            exit 0
            ;;
        --logs)
            check_docker
            show_logs "$2"
            exit 0
            ;;
        --status)
            check_docker
            show_status
            exit 0
            ;;
        --migrate)
            check_docker
            run_migrations
            exit 0
            ;;
        --init-db)
            check_docker
            setup_env
            cleanup
            init_database
            start_services "$2"
            ;;
        -d|--detach)
            check_docker
            setup_env
            init_database
            start_services "-d"
            print_message "$GREEN" "✅ All services started successfully!"
            print_message "$BLUE" "📱 Frontend: http://localhost:5173"
            print_message "$BLUE" "🔧 Backend API: http://localhost:4000"
            print_message "$BLUE" "📚 API Docs: http://localhost:4000/docs"
            print_message "$YELLOW" "💡 Use '$0 --logs' to view logs"
            ;;
        "")
            check_docker
            setup_env
            init_database
            print_message "$GREEN" "✅ All services starting..."
            print_message "$BLUE" "📱 Frontend: http://localhost:5173"
            print_message "$BLUE" "🔧 Backend API: http://localhost:4000"
            print_message "$BLUE" "📚 API Docs: http://localhost:4000/docs"
            print_message "$YELLOW" "💡 Press Ctrl+C to stop"
            start_services
            ;;
        *)
            print_message "$RED" "❌ Unknown option: $1"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
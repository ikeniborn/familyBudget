#!/bin/bash
# Development environment startup script with database initialization

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[DEV]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if .env exists, if not copy from .env.dev
if [ ! -f .env ]; then
    print_status "Creating .env from .env.dev..."
    cp .env.dev .env
fi

# Load environment variables
set -a
source .env
set +a

# Function to check if database is initialized
check_db_initialized() {
    docker-compose -f docker-compose.dev.yaml exec -T postgres psql -U postgres -d budgetdb -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 't_%';" 2>/dev/null | grep -q "[1-9][0-9]*" || return 1
}

# Function to initialize database
Init_database() {
    print_status "Initializing database schema..."
    
    # Wait for PostgreSQL to be ready
    print_status "Waiting for PostgreSQL to be ready..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker-compose -f docker-compose.dev.yaml exec -T postgres pg_isready -U postgres >/dev/null 2>&1; then
            break
        fi
        retries=$((retries - 1))
        sleep 1
    done
    
    if [ $retries -eq 0 ]; then
        print_error "PostgreSQL failed to start in time"
        return 1
    fi
    
    print_status "PostgreSQL is ready!"
    
    # Create database and user if not exists
    print_status "Creating database and user..."
    docker-compose -f docker-compose.dev.yaml exec -T postgres psql -U postgres <<-EOSQL
        -- Create budget user if not exists
        DO
        \$do\$
        BEGIN
           IF NOT EXISTS (
              SELECT FROM pg_catalog.pg_user
              WHERE usename = 'budget') THEN
              CREATE USER budget WITH PASSWORD '${BUDGET_DB_PASSWORD:-devpassword}';
           END IF;
        END
        \$do\$;

        -- Create budgetdb if not exists
        SELECT 'CREATE DATABASE budgetdb OWNER budget'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'budgetdb')\gexec

        -- Grant privileges
        GRANT ALL PRIVILEGES ON DATABASE budgetdb TO budget;
EOSQL
    
    # Apply schema
    print_status "Applying database schema..."
    docker-compose -f docker-compose.dev.yaml exec -T postgres psql -U budget -d budgetdb < postgresql/ddl/budgetdb.sql
    
    # Apply products schema
    print_status "Applying products schema..."
    docker-compose -f docker-compose.dev.yaml exec -T postgres psql -U budget -d budgetdb < postgresql/ddl/products.sql
    
    # Run Prisma migrations
    print_status "Running Prisma migrations..."
    docker-compose -f docker-compose.dev.yaml exec -T frontend-api npm run prisma:generate
    
    print_status "Database initialization completed!"
}

# Parse command line arguments
INIT_DB=false
DETACH=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --init-db)
            INIT_DB=true
            shift
            ;;
        -d|--detach)
            DETACH="-d"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --init-db    Initialize database with schema"
            echo "  -d, --detach Run in detached mode"
            echo "  --help       Show this help message"
            exit 0
            ;;
        *)
            shift
            ;;
    esac
done

# Start development environment
print_status "Starting development environment..."
docker-compose -f docker-compose.dev.yaml up $DETACH postgres redis

# Wait for services to be ready
if [ -z "$DETACH" ]; then
    # If not detached, services are starting in foreground
    exit 0
fi

# If detached, continue with initialization
sleep 5  # Give services time to start

# Initialize database if requested or if not initialized
if [ "$INIT_DB" = true ]; then
    Init_database
else
    if ! check_db_initialized; then
        print_warning "Database appears to be empty. Initializing..."
        Init_database
    else
        print_status "Database already initialized, skipping..."
    fi
fi

# Start remaining services
print_status "Starting application services..."
docker-compose -f docker-compose.dev.yaml up $DETACH frontend frontend-api

if [ -n "$DETACH" ]; then
    print_status "Development environment is running in detached mode"
    print_status "Frontend: http://localhost:3000"
    print_status "API: http://localhost:4000"
    print_status "PostgreSQL: localhost:5432"
    print_status "Redis: localhost:6379"
    echo ""
    print_status "To view logs: docker-compose -f docker-compose.dev.yaml logs -f"
    print_status "To stop: docker-compose -f docker-compose.dev.yaml down"
fi
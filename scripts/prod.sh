#!/bin/bash
# Production environment startup script
# Now supports SvelteKit frontend only (React frontend removed)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[PROD]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check for .env file
if [ ! -f .env ]; then
    print_error ".env file not found!"
    echo "Please create .env from .env.prod template:"
    echo "  cp .env.prod .env"
    echo "  # Edit .env with your production values"
    exit 1
fi

# Parse command line arguments
BUILD_IMAGES=false
EXTRA_ARGS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --build)
            BUILD_IMAGES=true
            EXTRA_ARGS="--build"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --build     Force rebuild of Docker images"
            echo "  --help      Show this help message"
            echo ""
            echo "Production URLs (assuming DOMAIN=example.com):"
            echo "  SvelteKit Frontend: https://app.example.com"
            echo "  API:               https://api.example.com"
            exit 0
            ;;
        *)
            # Pass other arguments through to docker-compose
            EXTRA_ARGS="$EXTRA_ARGS $1"
            shift
            ;;
    esac
done

# Ensure external network exists for Traefik
print_status "Ensuring app_network exists for Traefik..."
if ! docker network inspect app_network >/dev/null 2>&1; then
    print_status "Creating app_network..."
    docker network create app_network
else
    print_status "app_network already exists"
fi

# Start production environment
print_status "Starting production environment..."
if [ "$BUILD_IMAGES" = true ]; then
    print_status "Building Docker images..."
fi

# Load environment variables
set -a
source .env
set +a

# Start services
print_status "Starting production services with SvelteKit frontend..."
docker-compose up -d $EXTRA_ARGS

print_status "Production environment is running!"
print_status "SvelteKit Frontend: https://${FRONTEND_SUBDOMAIN}.${DOMAIN}"
print_status "API:               https://${FRONTEND_API_SUBDOMAIN}.${DOMAIN}"

echo ""
print_status "To view logs: docker-compose logs -f"
print_status "To stop: docker-compose down"
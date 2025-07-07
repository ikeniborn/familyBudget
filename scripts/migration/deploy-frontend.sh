#!/bin/bash

# Frontend Deployment Script
# This script handles the deployment of the new React frontend

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/../.." && pwd )"
ENV_FILE="${1:-web.env}"

echo -e "${GREEN}Starting Frontend Deployment...${NC}"

# Function to check if service is healthy
check_service_health() {
    local service=$1
    local max_attempts=30
    local attempt=1
    
    echo -e "${YELLOW}Checking health of $service...${NC}"
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose --env-file $ENV_FILE ps | grep -q "$service.*healthy"; then
            echo -e "${GREEN}$service is healthy${NC}"
            return 0
        fi
        echo "Waiting for $service to be healthy... (attempt $attempt/$max_attempts)"
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}$service failed to become healthy${NC}"
    return 1
}

# Step 1: Build new images
echo -e "${YELLOW}Building Docker images...${NC}"
docker-compose --env-file $ENV_FILE build frontend frontend-api

# Step 2: Deploy services
echo -e "${YELLOW}Deploying services...${NC}"
docker-compose --env-file $ENV_FILE up -d frontend frontend-api

# Step 3: Wait for services to be healthy
check_service_health "frontend"
check_service_health "frontend-api"

# Step 4: Run smoke tests
echo -e "${YELLOW}Running smoke tests...${NC}"
if command -v npm &> /dev/null; then
    cd "$PROJECT_ROOT/frontend"
    npm run test:e2e -- --grep "smoke" || {
        echo -e "${RED}Smoke tests failed!${NC}"
        exit 1
    }
else
    echo -e "${YELLOW}npm not found, skipping smoke tests${NC}"
fi

echo -e "${GREEN}Frontend deployment completed successfully!${NC}"
echo -e "${GREEN}React UI is now the primary interface${NC}"
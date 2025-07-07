#!/bin/bash
# Development environment startup script

# Check if .env exists, if not copy from .env.development
if [ ! -f .env ]; then
    echo "Creating .env from .env.development..."
    cp .env.development .env
fi

# Start development environment
echo "Starting development environment..."
docker-compose -f docker-compose.dev.yaml up "$@"
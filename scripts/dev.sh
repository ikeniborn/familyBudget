#!/bin/bash
# Development environment startup script

# Check if .env exists, if not copy from .env.dev
if [ ! -f .env ]; then
    echo "Creating .env from .env.dev..."
    cp .env.dev .env
fi

# Start development environment
echo "Starting development environment..."
docker-compose -f docker-compose.dev.yaml up "$@"
#!/bin/bash
# Production environment startup script

# Check for .env file
if [ ! -f .env ]; then
    echo "ERROR: .env file not found!"
    echo "Please create .env from .env.example:"
    echo "  cp .env.example .env"
    echo "  # Edit .env with your production values"
    exit 1
fi

# Start production environment
echo "Starting production environment..."
docker-compose up -d "$@"
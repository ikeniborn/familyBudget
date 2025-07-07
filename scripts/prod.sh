#!/bin/bash
# Production environment startup script

# Check for web.env file
if [ ! -f web.env ]; then
    echo "ERROR: web.env file not found!"
    echo "Please create web.env from .env.example:"
    echo "  cp .env.example web.env"
    echo "  # Edit web.env with your production values"
    exit 1
fi

# Start production environment with specific env file
echo "Starting production environment..."
docker-compose --env-file web.env up -d "$@"
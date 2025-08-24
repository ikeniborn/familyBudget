#!/bin/bash

# FastAPI Backend Startup Script

set -e

echo "Starting Family Budget FastAPI Backend..."

# Load environment variables
if [ -f .env ]; then
    echo "Loading environment variables from .env"
    export $(grep -v '^#' .env | xargs)
else
    echo "Warning: .env file not found. Using default values."
fi

# Set default values if not provided
export NODE_ENV=${NODE_ENV:-development}
export DEBUG=${DEBUG:-true}
export HOST=${HOST:-0.0.0.0}
export PORT=${PORT:-4000}

echo "Environment: $NODE_ENV"
echo "Debug mode: $DEBUG"
echo "Host: $HOST"
echo "Port: $PORT"

# Wait for database to be ready
echo "Waiting for database to be ready..."
while ! pg_isready -h ${DATABASE_HOST:-postgres} -p ${DATABASE_PORT:-5432} -U ${DATABASE_USER:-budget} 2>/dev/null; do
    echo "Database not ready, waiting..."
    sleep 2
done
echo "Database is ready!"

# Wait for Redis to be ready
echo "Waiting for Redis to be ready..."
while ! redis-cli -h ${REDIS_HOST:-redis} -p ${REDIS_PORT:-6379} ping 2>/dev/null; do
    echo "Redis not ready, waiting..."
    sleep 2
done
echo "Redis is ready!"

# Run database migrations if needed
echo "Running database migrations..."
# Note: Uncomment when Alembic is configured
# alembic upgrade head

# Start the application
if [ "$NODE_ENV" = "development" ]; then
    echo "Starting in development mode with hot reload..."
    uvicorn app.main:app --host $HOST --port $PORT --reload --log-level debug
else
    echo "Starting in production mode..."
    uvicorn app.main:app --host $HOST --port $PORT --workers 4 --log-level info
fi
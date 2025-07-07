# Development Setup Guide

## Overview

This guide explains how to set up the complete Family Budget application for local development using `docker-compose.dev.yaml`.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development without Docker)
- Git

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd familyBudget
   ```

2. **Setup environment**
   ```bash
   # Option 1: Use the development script (recommended)
   ./scripts/dev.sh
   
   # Option 2: Manual setup
   cp .env.dev .env
   docker-compose -f docker-compose.dev.yaml up -d
   ```

4. **Wait for services to be ready**
   ```bash
   # Check status
   docker-compose -f docker-compose.dev.yaml ps
   
   # View logs
   docker-compose -f docker-compose.dev.yaml logs -f
   ```

## Service URLs

After starting, services will be available at:

- **Frontend (React)**: http://localhost:3000
- **Frontend API (Unified Node.js)**: http://localhost:4000
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379

## Development Workflow

### Working on Frontend (React)

The frontend uses Vite with hot module replacement:

```bash
# Frontend logs
docker-compose -f docker-compose.dev.yaml logs -f frontend-dev

# Restart frontend only
docker-compose -f docker-compose.dev.yaml restart frontend-dev
```

Changes to frontend code will automatically reload in the browser.

### Working on Frontend API (Node.js)

The BFF uses nodemon for auto-reload:

```bash
# Frontend API logs
docker-compose -f docker-compose.dev.yaml logs -f frontend-api-dev

# Restart frontend API only
docker-compose -f docker-compose.dev.yaml restart frontend-api-dev
```

### Working on Backend API (Python)

The FastAPI backend uses uvicorn with auto-reload:

```bash
# Backend API logs
docker-compose -f docker-compose.dev.yaml logs -f budget-api-dev

# Restart backend API only
docker-compose -f docker-compose.dev.yaml restart budget-api-dev
```

### Database Access

PostgreSQL is exposed on port 5432:

```bash
# Connect with psql
psql -h localhost -U budget -d budgetdb
# Password: devpassword (from .env)

# Connect with pgAdmin or other tools
# Host: localhost
# Port: 5432
# Database: budgetdb
# Username: budget
# Password: devpassword
```

## Common Commands

### Using helper scripts (recommended)
```bash
# Start development environment
./scripts/dev.sh

# Start in detached mode
./scripts/dev.sh -d

# Rebuild and start
./scripts/dev.sh -d --build
```

### Manual commands
```bash
# Start services
docker-compose -f docker-compose.dev.yaml up -d

# Stop services
docker-compose -f docker-compose.dev.yaml down

# Rebuild after dependency changes
docker-compose -f docker-compose.dev.yaml up -d --build
```

### View logs
```bash
# All services
docker-compose -f docker-compose.dev.yaml logs -f

# Specific service
docker-compose -f docker-compose.dev.yaml logs -f frontend-dev
```

### Reset database
```bash
# Stop services
docker-compose -f docker-compose.dev.yaml down

# Remove volume
docker volume rm familybudget_postgres-dev-data

# Start again (will recreate database)
docker-compose -f docker-compose.dev.yaml up -d
```

## Troubleshooting

### Port conflicts

If you get port binding errors, check for conflicting services:

```bash
# Check what's using port 3000
lsof -i :3000

# Check all development ports
lsof -i :3000,4000,8888,5432
```

### Database connection issues

1. Ensure PostgreSQL is fully started:
   ```bash
   docker-compose -f docker-compose.dev.yaml logs postgres-dev | grep "database system is ready"
   ```

2. Check database initialization:
   ```bash
   docker-compose -f docker-compose.dev.yaml exec postgres-dev psql -U postgres -c "\l"
   ```

### Frontend can't connect to API

1. Check frontend-api is running:
   ```bash
   curl http://localhost:4000/health
   ```

2. Check CORS settings in frontend-api
3. Verify VITE_API_URL in frontend environment

### API authentication issues

1. Ensure SESSION_SECRET is set
2. Check Telegram bot token is valid
3. Clear browser cookies/session

## Testing

### Unit Tests
```bash
# Frontend tests
docker-compose -f docker-compose.dev.yaml exec frontend-dev npm test

# Frontend API tests
docker-compose -f docker-compose.dev.yaml exec frontend-api-dev npm test
```

### E2E Tests
```bash
# Ensure all services are running
docker-compose -f docker-compose.dev.yaml up -d

# Run Playwright tests
cd frontend && npm run test:e2e
```

## Development Tips

1. **Use container names for internal communication**
   - Frontend → Frontend API: `http://frontend-api:4000`
   - Frontend API → Backend: `http://budget-api:8888`
   - Any service → PostgreSQL: `postgres:5432`

2. **Hot reload is enabled for all services**
   - Frontend: Vite HMR
   - Frontend API: nodemon
   - Backend API: uvicorn --reload

3. **Volumes are mounted for code**
   - Changes to source code are reflected immediately
   - node_modules and Python packages are in containers

4. **Database persists between restarts**
   - Data is stored in `postgres-dev-data` volume
   - Remove volume to reset database

## Production Differences

The development setup differs from production:

1. **No Traefik** - Direct port exposure instead
2. **Hot reload enabled** - Auto-restart on code changes
3. **Debug logging** - More verbose output
4. **Insecure defaults** - Simple passwords and secrets
5. **Source code mounted** - For live development

Never use development configuration in production!
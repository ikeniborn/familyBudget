# Dual Frontend Setup Guide

This document explains how to run both React and Svelte frontends simultaneously during the migration period.

## Overview

The Family Budget application now supports running both React and Svelte frontends in parallel:

- **React Frontend** (existing): Default interface, accessible at the root domain
- **Svelte Frontend** (new): New interface, accessible at `/svelte` path prefix
- **Shared Backend**: Both frontends use the same API, database, and authentication

## Architecture

### Production Deployment

```
                     ┌─────────────────┐
                     │     Traefik     │
                     │  (Reverse Proxy) │
                     └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
     https://app.example.com/      https://app.example.com/svelte
                    │                   │
            ┌───────▼──────┐    ┌──────▼───────┐
            │ React Frontend│    │Svelte Frontend│
            │   (Port 80)   │    │  (Port 3000)  │
            └───────┬──────┘    └──────┬───────┘
                    │                  │
                    └─────────┬────────┘
                              │
                  https://api.example.com
                              │
                    ┌─────────▼─────────┐
                    │   Frontend API    │
                    │   (Port 4000)     │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   PostgreSQL +    │
                    │      Redis        │
                    └───────────────────┘
```

### Development Setup

- React Frontend: `http://localhost:3000`
- Svelte Frontend: `http://localhost:5173`
- API: `http://localhost:4000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Usage

### Development Environment

#### 1. Start Both Frontends (Recommended for migration work)

```bash
# Start all services including both frontends
./scripts/dev.sh -d --svelte

# This starts:
# - PostgreSQL and Redis
# - Frontend API
# - React frontend at localhost:3000
# - Svelte frontend at localhost:5173
```

#### 2. Start Only React Frontend (Default behavior)

```bash
# Traditional development setup
./scripts/dev.sh -d

# This starts:
# - PostgreSQL and Redis
# - Frontend API
# - React frontend at localhost:3000
```

#### 3. Start Only Svelte Frontend

```bash
# For pure Svelte development
./scripts/dev.sh -d --svelte-only

# This starts:
# - PostgreSQL and Redis
# - Frontend API
# - Svelte frontend at localhost:5173
```

#### 4. Advanced Development Options

```bash
# Force database initialization
./scripts/dev.sh -d --svelte --init-db

# Run in foreground (with logs)
./scripts/dev.sh --svelte

# Show help
./scripts/dev.sh --help
```

### Production Environment

#### 1. Deploy With Both Frontends

```bash
# Deploy all services including Svelte
./scripts/prod.sh --svelte

# URLs will be:
# - React:  https://app.example.com
# - Svelte: https://app.example.com/svelte
# - API:    https://api.example.com
```

#### 2. Deploy Only React Frontend (Default)

```bash
# Traditional production deployment
./scripts/prod.sh

# URL: https://app.example.com
```

#### 3. Force Image Rebuild

```bash
# Rebuild Docker images and deploy with Svelte
./scripts/prod.sh --svelte --build
```

## Configuration

### Environment Variables

The setup uses the same environment variables for both frontends with some additions:

#### Production (.env.prod template)

```bash
# Core configuration (same for both frontends)
DOMAIN=example.com
FRONTEND_SUBDOMAIN=app
FRONTEND_API_SUBDOMAIN=api

# Database and API settings
POSTGRES_PASSWORD=your_secure_postgres_password
BUDGET_DB_PASSWORD=your_secure_budget_password
SESSION_SECRET=your_secure_session_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Svelte-specific (automatically configured in production)
# PUBLIC_API_URL and ORIGIN are set based on DOMAIN variables
```

#### Development (.env.dev template)

```bash
# Development overrides
DOMAIN=localhost
VITE_API_URL=http://localhost:4000     # For React
PUBLIC_API_URL=http://localhost:4000   # For Svelte

# Database access
DATABASE_URL=postgresql://budget:devpassword@localhost:5432/budgetdb
```

### Traefik Routing Rules

The production setup uses Traefik path-based routing:

```yaml
# React Frontend - Default (all paths except /svelte)
traefik.http.routers.frontend-main.rule=Host(`app.example.com`) && !PathPrefix(`/svelte`)

# Svelte Frontend - Prefixed paths
traefik.http.routers.frontend-svelte.rule=Host(`app.example.com`) && PathPrefix(`/svelte`)
traefik.http.middlewares.svelte-stripprefix.stripPrefix.prefixes=/svelte
```

## Docker Services

### Development (docker-compose.dev.yaml)

- `postgres-dev`: PostgreSQL database
- `redis-dev`: Redis cache
- `frontend-dev`: React frontend with hot reload (port 3000)
- `frontend-svelte-dev`: Svelte frontend with hot reload (port 5173)
- `frontend-api-dev`: Node.js API with hot reload (port 4000)

### Production (docker-compose.yaml)

- `postgres`: PostgreSQL database (internal network)
- `redis`: Redis cache (internal network)
- `frontend`: React frontend (port 80, Traefik routing)
- `frontend-svelte`: Svelte frontend (port 3000, Traefik routing with /svelte prefix)
- `frontend-api`: Node.js API (port 4000, Traefik routing)

## Migration Strategy

### Phase 1: Parallel Development
- Deploy both frontends side by side
- Develop new features in Svelte
- Maintain React for existing functionality
- Users can test Svelte by visiting `/svelte` path

### Phase 2: Feature Parity
- Implement all React features in Svelte
- Test thoroughly with real users
- Fix any issues discovered

### Phase 3: Traffic Migration
- Update Traefik rules to route more traffic to Svelte
- Use canary deployments or A/B testing
- Monitor performance and user feedback

### Phase 4: Complete Migration
- Make Svelte the default frontend
- Remove React frontend service
- Update routing to remove `/svelte` prefix

## Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# If ports are already in use, stop other services:
docker-compose -f docker-compose.dev.yaml down
sudo lsof -i :3000  # Check what's using port 3000
sudo lsof -i :5173  # Check what's using port 5173
```

#### 2. Network Issues
```bash
# Ensure external network exists (for production)
docker network create app_network

# Check network connectivity
docker-compose logs frontend-svelte
docker-compose logs traefik
```

#### 3. Path Prefix Issues (Svelte)
- Svelte uses `/svelte` prefix in production
- Check that `svelte.config.js` has correct path configuration
- Verify Traefik middleware strips prefix correctly

#### 4. Authentication Issues
- Both frontends share the same session store (Redis)
- Login in one frontend should work in the other
- Check that API_URL environment variables are correct

### Debug Commands

```bash
# View logs for specific service
docker-compose -f docker-compose.dev.yaml logs -f frontend-svelte

# Check service health
docker-compose -f docker-compose.dev.yaml ps

# Connect to database
docker exec -it postgres-dev psql -U budget -d budgetdb

# Check API connectivity
curl http://localhost:4000/health
```

### Performance Considerations

- Each frontend runs in its own container
- Resource limits are configured in docker-compose files
- Monitor memory usage during development with both frontends running
- Consider running only one frontend at a time during active development

## Testing

### Development Testing

```bash
# Test React frontend
curl http://localhost:3000

# Test Svelte frontend
curl http://localhost:5173

# Test API
curl http://localhost:4000/health
```

### Production Testing

```bash
# Test React frontend (default)
curl -H "Host: app.example.com" https://app.example.com

# Test Svelte frontend (with prefix)
curl -H "Host: app.example.com" https://app.example.com/svelte

# Test API
curl https://api.example.com/health
```

## Security Considerations

- Both frontends use the same authentication system
- Sessions are shared via Redis
- API endpoints use the same authorization middleware
- Traefik handles SSL termination for both frontends
- Container isolation prevents cross-contamination

## Monitoring

### Development

```bash
# Monitor all services
docker-compose -f docker-compose.dev.yaml logs -f

# Monitor specific service
docker-compose -f docker-compose.dev.yaml logs -f frontend-svelte
```

### Production

```bash
# Monitor all services
docker-compose logs -f

# Check service status
docker-compose ps

# Resource usage
docker stats
```

## Next Steps

1. **Feature Migration**: Start migrating React components to Svelte
2. **User Testing**: Get feedback from users on both interfaces
3. **Performance Optimization**: Monitor and optimize both frontends
4. **Gradual Migration**: Plan the transition strategy
5. **Documentation**: Keep this guide updated as the migration progresses

## File Locations

- Development compose: `docker-compose.dev.yaml`
- Production compose: `docker-compose.yaml`
- Development script: `scripts/dev.sh`
- Production script: `scripts/prod.sh`
- Environment templates: `.env.dev`, `.env.prod`
- Svelte Dockerfile: `frontend-svelte/Dockerfile`
- Svelte Dev Dockerfile: `frontend-svelte/Dockerfile.dev`
- Svelte Config: `frontend-svelte/svelte.config.js`

This setup provides maximum flexibility during the migration period while maintaining production stability.
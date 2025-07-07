# Environment Variables Guide

## Overview

This document describes all environment variables used in the Family Budget application.

## Docker Compose Behavior

Docker Compose automatically loads environment variables in the following order:

1. From shell environment
2. From `.env` file in the project directory (default)
3. From file specified with `--env-file` option
4. From `environment:` section in docker-compose.yaml

## Environment Files

### Production: `web.env`
Used for production deployment. Copy from `.env.example` and set production values.

### Development: `.env.development`
Default values for local development. Automatically used by `./scripts/dev.sh`.

### Default: `.env`
Docker Compose loads this file automatically if present. Created from `.env.development` or `.env.example`.

## Variable Reference

### Domain Configuration
- `DOMAIN` - Base domain for the application (e.g., example.com)
- `BUDGET_API_SUBDOMAIN` - Subdomain for backend API (default: api)
- `FRONTEND_SUBDOMAIN` - Subdomain for React frontend (default: app)
- `FRONTEND_API_SUBDOMAIN` - Subdomain for Node.js BFF (default: api-app)

### Database
- `POSTGRES_PASSWORD` - PostgreSQL superuser password (for postgres user)
  - Used for database administration tasks
  - Required for initial database setup
- `BUDGET_DB_PASSWORD` - Application database password (for budget user)
  - Used by application to connect to database
  - Should be different from POSTGRES_PASSWORD in production

### Frontend API (Node.js BFF)
- `SESSION_SECRET` - Secret key for session encryption
  - Must be a long, random string in production
  - Used to sign session cookies
- `TELEGRAM_BOT_TOKEN` - Token for Telegram bot authentication
  - Obtained from @BotFather on Telegram
  - Required for Telegram login functionality

### Development URLs
- `VITE_API_URL` - Frontend API URL for React app (default: http://localhost:4000)
- `BACKEND_API_URL` - Backend API URL for BFF (default: http://localhost:8888)

### Security Settings
- `SECURE_API` - Enable secure API with parameterized queries (default: true)
  - Set to `false` to use legacy API (NOT RECOMMENDED)
  - When true, all SQL queries use parameterized statements
  - Requires X-User-Id header for all API requests

## Usage Examples

### Production
```bash
# Create production env file
cp .env.example web.env
vim web.env  # Edit with production values

# Start with production env
./scripts/prod.sh

# Or manually
docker-compose --env-file web.env up -d
```

### Development
```bash
# Use development defaults
./scripts/dev.sh

# Or manually
cp .env.development .env
docker-compose -f docker-compose.dev.yaml up
```

### Custom Environment
```bash
# Create custom env file
cp .env.example custom.env
vim custom.env

# Use custom env file
docker-compose --env-file custom.env up -d
```

## Security Best Practices

1. **Never commit env files with real values**
   - Add `*.env`, `web.env` to `.gitignore`
   - Only commit `.env.example` and `.env.development`

2. **Use strong passwords in production**
   - Generate with: `openssl rand -base64 32`
   - Different passwords for each service

3. **Rotate secrets regularly**
   - Change SESSION_SECRET periodically
   - Update database passwords quarterly

4. **Restrict file permissions**
   ```bash
   chmod 600 web.env
   ```

5. **Use environment-specific values**
   - Development: Simple passwords for convenience
   - Production: Complex, unique passwords

## Troubleshooting

### Variables not loading
```bash
# Check current environment
docker-compose config

# Verify env file is being used
docker-compose --env-file web.env config
```

### Override precedence
Environment variables are resolved in this order (highest to lowest priority):
1. Shell environment: `export DOMAIN=test.com`
2. Command line: `docker-compose --env-file custom.env`
3. Docker Compose `environment:` section
4. `.env` file in project root
5. Default values in docker-compose.yaml (e.g., `${VAR:-default}`)
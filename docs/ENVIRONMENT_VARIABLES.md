# Environment Variables Documentation

This document describes all environment variables used in the Family Budget application with the unified Node.js API architecture.

## Docker Compose Behavior

Docker Compose automatically loads environment variables in the following order:

1. From shell environment
2. From `.env` file in the project directory (default)
3. From file specified with `--env-file` option
4. From `environment:` section in docker-compose.yaml

## Environment Files

### Production: `.env`
Used for production deployment. Copy from `.env.example` and set production values.
Docker Compose loads this file automatically.

### Development: `.env.dev`
Default values for local development. Copy to `.env` for development or use `./scripts/dev.sh`.

### Example: `.env.example`
Template with all available variables. Use as a starting point for creating your `.env` file.

## Required Variables

### Domain Configuration

- **DOMAIN** - Your domain name (e.g., `example.com`)
  - Required for production
  - Used for SSL certificates and routing

- **FRONTEND_SUBDOMAIN** - Subdomain for the React frontend (default: `app`)
  - Example: `app.example.com`

- **FRONTEND_API_SUBDOMAIN** - Subdomain for the unified API (default: `api`)
  - Example: `api.example.com`

### Database Configuration

- **POSTGRES_PASSWORD** - PostgreSQL superuser password
  - Used for database administration
  - Should be strong and secure in production

- **BUDGET_DB_PASSWORD** - Application database user password
  - Used by the application to connect to PostgreSQL
  - Should be different from POSTGRES_PASSWORD

### Security

- **SESSION_SECRET** - Secret key for session encryption
  - Should be a long, random string
  - Used for securing user sessions
  - Example: Generate with `openssl rand -hex 32`

- **TELEGRAM_BOT_TOKEN** - Token for Telegram authentication
  - Obtained from @BotFather on Telegram
  - Format: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

## Optional Variables

### Environment

- **NODE_ENV** - Node.js environment (default: `production`)
  - Values: `production`, `development`, `test`
  - Affects optimization and error reporting

### Feature Flags

- **USE_UNIFIED_API** - Enable unified Node.js API (default: `true`)
  - Should always be `true` after migration
  - Legacy flag for backward compatibility

### Redis Configuration

- **REDIS_HOST** - Redis server hostname (default: `redis`)
  - For Docker: use container name
  - For local development: use `localhost`

- **REDIS_PORT** - Redis server port (default: `6379`)

- **REDIS_PASSWORD** - Redis password (optional)
  - Only needed if Redis authentication is enabled

### URLs (Development)

- **DATABASE_URL** - Full PostgreSQL connection string
  - Format: `postgresql://user:password@host:port/database`
  - Example: `postgresql://budget:devpassword@localhost:5432/budgetdb`
  - Automatically constructed in production

- **VITE_API_URL** - API URL for frontend development
  - Example: `http://localhost:4000`
  - Used in development mode

- **FRONTEND_URL** - Frontend URL for CORS configuration
  - Example: `http://localhost:3000`
  - Used for development

### Legacy Variables (Deprecated)

- **BUDGET_API_SUBDOMAIN** - Legacy Python API subdomain
  - Can be removed after full migration
  - Only used for backward compatibility

- **SECURE_API** - Enable secure API mode
  - Deprecated: security is now built-in

- **BACKEND_API_URL** - Python backend API URL
  - Deprecated: replaced by unified API

## Usage Examples

### Production
```bash
# Create production env file
cp .env.example .env
vim .env  # Edit with production values

# Start with production env
./scripts/prod.sh

# Or manually
docker-compose up -d
```

### Development
```bash
# Use development defaults
./scripts/dev.sh

# Or manually
cp .env.dev .env
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

## Example Configuration Files

### Production (.env)

```bash
# Domain
DOMAIN=yourdomain.com
FRONTEND_SUBDOMAIN=app
FRONTEND_API_SUBDOMAIN=api

# Database
POSTGRES_PASSWORD=strong_postgres_password
BUDGET_DB_PASSWORD=strong_budget_password

# Security
SESSION_SECRET=your_very_long_random_session_secret
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Environment
NODE_ENV=production
USE_UNIFIED_API=true
```

### Development (.env.dev)

```bash
# Domain
DOMAIN=localhost
FRONTEND_SUBDOMAIN=app
FRONTEND_API_SUBDOMAIN=api

# Database
POSTGRES_PASSWORD=devpassword
BUDGET_DB_PASSWORD=devpassword
DATABASE_URL=postgresql://budget:devpassword@localhost:5432/budgetdb

# Security
SESSION_SECRET=dev-session-secret-change-in-production
TELEGRAM_BOT_TOKEN=your_dev_telegram_bot_token

# Environment
NODE_ENV=development
USE_UNIFIED_API=true

# Development URLs
VITE_API_URL=http://localhost:4000
FRONTEND_URL=http://localhost:3000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Security Best Practices

1. **Never commit env files with real values**
   - Add `.env` to `.gitignore` (production values)
   - Only commit `.env.example` and `.env.dev`

2. **Use strong passwords in production**
   - Generate with: `openssl rand -base64 32`
   - Different passwords for each service

3. **Rotate secrets regularly**
   - Change SESSION_SECRET periodically
   - Update database passwords quarterly

4. **Restrict file permissions**
   ```bash
   chmod 600 .env
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
docker-compose config
```

### Override precedence
Environment variables are resolved in this order (highest to lowest priority):
1. Shell environment: `export DOMAIN=test.com`
2. Command line: `docker-compose --env-file custom.env`
3. Docker Compose `environment:` section
4. `.env` file in project root
5. Default values in docker-compose.yaml (e.g., `${VAR:-default}`)

### Missing Variables

If a required variable is missing, you'll see errors like:
- `Error: SESSION_SECRET is required`
- `UnhandledPromiseRejectionWarning: TELEGRAM_BOT_TOKEN not found`

### Invalid Database URL

If DATABASE_URL is incorrect:
- Check format: `postgresql://user:password@host:port/database`
- Ensure all parts are URL-encoded if they contain special characters
- Verify the database exists and user has permissions

### Connection Issues

For Redis/PostgreSQL connection issues:
- In Docker: use container names (e.g., `redis`, `postgres`)
- Locally: use `localhost` or `127.0.0.1`
- Check if services are running: `docker ps`
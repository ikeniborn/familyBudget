# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget Management System - a microservices-based application for tracking family finances with Google Sheets integration.

## Architecture

### Core Services (Docker Compose)
- **budget-api** (port 8888): FastAPI backend with JWT authentication and Redis caching
- **budget-ui** (port 8501): Streamlit frontend with Telegram OAuth
- **postgres** (port 5432): Main database with Russian schema (budgetdb) - optimized with indexes and connection pooling
- **redis** (port 6379): In-memory cache for API responses with configurable TTL
- **couchdb** (port 5984): Document database for additional storage
- **traefik**: Reverse proxy with automatic SSL/TLS from Let's Encrypt Production
- **backup**: Automated daily backups for PostgreSQL (2 AM) and CouchDB (3 AM) with 7-day retention

### Project Structure
```
/api/                # FastAPI backend with JWT auth
  /utils/            # Auth, models, Redis client, optimized DB
/app/budget/         # Streamlit UI with Telegram OAuth
/db/                 # Database configurations and backups
  /postgresql/       # PostgreSQL configs, DDL, backups
  /couchdb/          # CouchDB configs and backups
  /backup/           # Backup service with cron jobs
/service/            # Infrastructure services
  /traefik/          # Reverse proxy with Production SSL
/google/             # Google Apps Script integration
  /src/              # GAS source files for Sheets automation
```

## Common Commands

### Development
```bash
# Start all services (development)
docker-compose -f docker-compose-dev.yaml up -d

# Start all services (production)
docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]

# Generate Traefik dashboard password
./service/traefik/generate-password.sh admin yourpassword

# Switch to Production SSL certificates
./apply_production_ssl.sh

# Manual backup
docker-compose exec backup /scripts/backup-postgres.sh
docker-compose exec backup /scripts/backup-couchdb.sh

# Restore from backup
docker-compose exec backup /scripts/restore-postgres.sh /backups/postgres_budgetdb_YYYYMMDD_HHMMSS.sql.gz

# Apply database optimizations
docker-compose exec postgres psql -U budget -d budgetdb -f /docker-entrypoint-initdb.d/add_indexes.sql
```

### Code Formatting
```bash
# Format Python code
black . --line-length=180
```

### Database Access
```bash
# PostgreSQL
psql -h localhost -p 5432 -U budget -d budgetdb
# Password: Check .env file for POSTGRES_PASSWORD_BUDGET

# CouchDB Admin
# URL: http://localhost:5984/_utils
# User: admin, Password: Check .env file for COUCHDB_PASSWORD
```

## Key Implementation Details

### Database Schema (PostgreSQL)
- All tables use Russian naming: `t_d_` prefix for dimensions, `t_f_` for facts
- Main fact table: `t_f_registry` - stores all financial transactions
- Dimension tables: users, periods, cost_centers, financial_centers, nomenclatures
- Use `id_` prefix for ID columns, `nm_` for names, `dt_` for dates
- **Optimizations Applied**:
  - Indexes on all foreign keys for faster JOINs
  - Composite indexes for common query patterns
  - Connection pooling (10-20 connections)
  - Parameterized queries to prevent SQL injection

### API Endpoints (FastAPI)
- Base URL: `https://api.${TRAEFIK_DOMAIN}`
- Authentication: JWT tokens via `/token` endpoint
- All endpoints protected with authentication middleware
- **Performance Features**:
  - Redis caching with @cache_result decorator (5min default, 1hr for static data)
  - Cache invalidation on POST/PUT/DELETE operations
  - Connection pooling with asyncpg (10-20 connections)
  - Parameterized queries via queries.py module
- **Key Modules**:
  - Models: `/api/utils/models.py`
  - Auth: `/api/utils/auth.py`
  - Cache: `/api/utils/redis_client.py`
  - Optimized DB: `/api/utils/postgres_optimized.py`
  - SQL queries: `/api/utils/queries.py`

### UI (Streamlit)
- Telegram OAuth authentication required
- JWT token management via auth_client.py
- Forms for transaction entry in `/app/budget/utils/forms.py`
- API client with auth in `/app/budget/utils/api.py`

### Google Apps Script
- Automated budget tracking and reporting
- Trello integration for task management
- Portfolio tracking with crypto prices
- Build with: `cd google && npm run build`

## Environment Variables

### Common
- `TRAEFIK_DOMAIN` - Your domain name
- `ACME_EMAIL` - Email for Let's Encrypt
- `JWT_SECRET_KEY` - Secret key for JWT tokens

### Database
- `POSTGRES_HOST=10.5.0.2`
- `POSTGRES_DB_BUDGET=budgetdb`
- `POSTGRES_USER_BUDGET=budget`
- `POSTGRES_PASSWORD_BUDGET` - Database password

### Services
- `API_URL=https://api.${TRAEFIK_DOMAIN}`

## Important Notes

1. **Network**: All services use `app_network` (10.5.0.0/16)
2. **Healthchecks**: Configured for all services in docker-compose.yaml
3. **Resource Limits**: Services have CPU and memory constraints
4. **Backups**: 
   - Automated daily backups (PostgreSQL 2 AM, CouchDB 3 AM)
   - 7-day retention with automatic cleanup
   - Backup service runs in dedicated container with cron
5. **SSL**: Production Let's Encrypt certificates via Traefik
6. **Security**: 
   - JWT auth for API, Telegram OAuth for UI
   - Rate limiting and security headers via Traefik
   - SQL injection protection through parameterized queries
   - Connection pooling for database security
7. **Configuration**: All secrets in single `.env` file
8. **Performance**:
   - Redis caching with configurable TTL (5min default, 1hr for static)
   - Database indexes on all foreign keys
   - Connection pooling (10-20 connections)
   - Optimized SQL queries in queries.py module
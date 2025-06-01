# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget Management System - a microservices-based application for tracking family finances with Google Sheets integration.

## Architecture

### Core Services (Docker Compose)
- **budget-api** (port 8888): FastAPI backend with JWT authentication
- **budget-ui** (port 8501): Streamlit frontend with Telegram OAuth
- **postgres** (port 5432): Main database with Russian schema (budgetdb)
- **couchdb** (port 5984): Document database for additional storage
- **traefik**: Reverse proxy with automatic SSL/TLS from Let's Encrypt

### Project Structure
```
/api/            # FastAPI backend with JWT auth
/app/budget/     # Streamlit UI with Telegram OAuth
/db/             # Database configurations and backups
/service/        # Traefik and other services
/google/         # Google Apps Script integration
  /src/          # GAS source files for Sheets automation
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
# Password: VZ7TcYGrb3jvJAFRQSsg

# CouchDB Admin
# URL: http://localhost:5984/_utils
# User: admin, Password: 2L6uEoNMjW9rVnPgy37t
```

## Key Implementation Details

### Database Schema (PostgreSQL)
- All tables use Russian naming: `t_d_` prefix for dimensions, `t_f_` for facts
- Main fact table: `t_f_registry` - stores all financial transactions
- Dimension tables: users, periods, cost_centers, financial_centers, nomenclatures
- Use `id_` prefix for ID columns, `nm_` for names, `dt_` for dates

### API Endpoints (FastAPI)
- Base URL: `https://api.${TRAEFIK_DOMAIN}`
- Authentication: JWT tokens via `/token` endpoint
- All endpoints protected with authentication middleware
- Uses async PostgreSQL connections via asyncpg
- Models defined in `/api/utils/models.py`
- Auth module in `/api/utils/auth.py`

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
4. **Backups**: Automated scripts in `/db/*/backup/`
5. **SSL**: Automatic certificates via Traefik + Let's Encrypt
6. **Security**: JWT auth for API, Telegram OAuth for UI
7. **Configuration**: All secrets in single `.env` file
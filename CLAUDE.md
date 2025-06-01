# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget Management System - a microservices-based application for tracking family finances with Google Sheets integration.

## Architecture

### Core Services (Docker Compose)
- **budget-api** (port 8888): FastAPI backend with PostgreSQL integration
- **budget-ui** (port 8501): Streamlit frontend with Telegram authentication
- **postgres** (port 5432): Main database with Russian schema (budgetdb)
- **couchdb** (port 5984): Document database for additional storage
- **haproxy**: Reverse proxy with SSL termination

### Project Structure
```
/web/            # Main web application
  /api/          # FastAPI backend
  /app/budget/   # Streamlit UI
  /db/           # Database configurations and backups
  /service/      # HAProxy and other services
/google/         # Google Apps Script integration
  /src/          # GAS source files for Sheets automation
```

## Common Commands

### Development
```bash
# Start all services (development)
cd web && docker-compose -f docker-compose-dev.yaml up -d

# Start all services (production)
cd web && docker-compose up -d

# View logs
docker-compose logs -f [service-name]

# Restart a service
docker-compose restart [service-name]
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
- Base URL: `http://localhost:8888`
- All endpoints under `/api/v1/`
- Uses async PostgreSQL connections via asyncpg
- Models defined in `/web/api/utils/models.py`

### UI (Streamlit)
- Telegram authentication required
- Forms for transaction entry in `/web/app/budget/utils/forms.py`
- API client in `/web/app/budget/utils/api.py`

### Google Apps Script
- Automated budget tracking and reporting
- Trello integration for task management
- Portfolio tracking with crypto prices
- Build with: `cd google && npm run build`

## Environment Variables

### API Service
- `POSTGRES_HOST=10.5.0.2`
- `POSTGRES_DB=budgetdb`
- `POSTGRES_USER=budget`
- `POSTGRES_PASSWORD=VZ7TcYGrb3jvJAFRQSsg`

### UI Service
- `API_URL=http://10.5.0.3:8888`

## Important Notes

1. **Network**: All services use `app_network` (10.5.0.0/16)
2. **Healthchecks**: Configured for all services in docker-compose.yaml
3. **Resource Limits**: Services have CPU and memory constraints
4. **Backups**: Automated scripts in `/web/db/*/backup/`
5. **SSL**: Managed by HAProxy with Let's Encrypt certificates
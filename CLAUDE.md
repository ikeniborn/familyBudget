# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a web-based budget management system built with a microservices architecture using Docker. It provides multi-user budget tracking with Telegram authentication, separating planned vs actual expenses.

## Architecture

- **Backend**: FastAPI (Python) at `api/` - REST API service
- **Frontend**: React + TypeScript at `frontend/` - Modern SPA with Telegram auth
- **BFF**: Node.js/Express at `frontend-api/` - Backend for Frontend
- **Database**: PostgreSQL (partitioned tables)
- **Reverse Proxy**: Traefik for SSL/routing
- **Deployment**: Docker Compose orchestration

Services run on Docker network:
- postgres: 10.5.0.2:5432
- budget-api: Internal network
- frontend: Internal network
- frontend-api: Internal network

## Common Development Commands

### Start Development Environment
```bash
# Full stack
docker-compose up -d --build

# Frontend only development (with hot reload)
docker-compose -f docker-compose.dev.yaml up

# Stop services
docker-compose down
```

### Code Quality
```bash
# Format code (Black configured for 180 chars)
black . --line-length=180

# Lint code
flake8 . --max-line-length=180
```

### Container Management
```bash
# View logs
docker logs -f frontend
docker logs -f frontend-api
docker logs -f budget-api

# Access container
docker exec -ti budget-api bash

# Restart service
docker restart frontend
```

### Database Operations
```bash
# Manual backup
./postgresql/backup/postgres-backup.sh

# Apply schema
psql -U budget -d budgetdb -f ./postgresql/ddl/budgetdb.sql
```

## Database Schema

PostgreSQL database `budgetdb` with partitioned tables:

**Dimensions (Reference Data):**
- `t_d_user` - Users with Telegram integration
- `t_d_period` - Time periods
- `t_d_financial_center` - Financial responsibility centers (ЦФО)
- `t_d_cost_center` - Cost centers (МВЗ)
- `t_d_nomenclature` - Budget categories
- `t_d_row_type` - Operation types (plan/fact)

**Fact Table:**
- `t_f_registry` - Main transactions (partitioned by year 2023-2030)

**Product Tables (New):**
- `t_d_product` - Product catalog
- `t_f_product_price` - Price history
- `t_l_product_nomenclature` - Product-category mapping

## API Structure

FastAPI endpoints at `/api/`:
- `/users` - User management
- `/periods` - Period operations
- `/financial_centers` - ЦФО management
- `/cost_centers` - МВЗ management
- `/nomenclatures` - Category management
- `/registry` - Transaction operations

All endpoints require user context for data isolation.

## Key Project Files

- `api/budget_api.py` - Main API application
- `frontend/src/App.tsx` - React application entry
- `frontend-api/src/index.ts` - Node.js BFF entry
- `postgresql/ddl/budgetdb.sql` - Database schema
- `docker-compose.yaml` - Production config
- `docker-compose.dev.yaml` - Frontend development config
- `.env.example` - Environment template

## Security & Authentication

- Telegram OAuth for user authentication
- User-based data isolation in all queries
- Environment-based secrets management
- Session-based authentication in frontend-api

## Development Guidelines

1. **Dependencies**:
   - API: See `api/requirements.txt`
   - Frontend: See `frontend/package.json`
   - Frontend-API: See `frontend-api/package.json`

2. **Code Style**:
   - Black formatter: 180 char line length
   - Flake8 linter configuration in `.flake8`

3. **Database Changes**:
   - Update `postgresql/ddl/budgetdb.sql`
   - Partitions exist for years 2023-2030
   - All queries must filter by user_id

4. **Container Resources**:
   - Each service has defined memory/CPU limits
   - Check `docker-compose.yaml` for production limits

## Backup & Maintenance

Automated daily backups to Yandex Cloud:
- PostgreSQL: midnight (postgres-backup.sh)
- SSL certificates managed automatically by Traefik

Backups use MinIO client (`mc`) configured for Yandex Object Storage.

## Testing

- **Frontend**: Jest unit tests, Playwright E2E tests
- **API**: pytest for Python tests
- **Frontend-API**: Jest for Node.js tests

Run tests:
```bash
# Frontend tests
cd frontend && npm test

# E2E tests
cd frontend && npm run test:e2e

# API tests
cd api && pytest
```

## Deployment

Production deployment:
1. Push code to main branch
2. CI/CD automatically deploys via GitHub Actions
3. Or manually: `docker-compose pull && docker-compose up -d`

SSL certificates managed by Let's Encrypt via Traefik.
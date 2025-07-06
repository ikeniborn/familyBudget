# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a web-based budget management system built with a microservices architecture using Docker. It provides multi-user budget tracking with Telegram authentication, separating planned vs actual expenses.

## Architecture

- **Backend**: FastAPI (Python) at `api/` - REST API service
- **Frontend**: Streamlit at `budget/` - Web UI with Telegram auth
- **Database**: PostgreSQL (partitioned tables) + CouchDB
- **Reverse Proxy**: HAProxy for SSL/routing
- **Deployment**: Docker Compose orchestration

Services run on Docker network 10.5.0.0/24:
- postgres: 10.5.0.2:5432
- budget-api: 10.5.0.3:8888
- budget-ui: 10.5.0.4:8501
- couchdb: 10.5.0.6:5984

## Common Development Commands

### Start Development Environment
```bash
# With rebuild
sudo docker-compose --env-file web_dev.env -f docker-compose-dev.yaml up --build -d

# Without rebuild
sudo docker-compose --env-file web_dev.env -f docker-compose-dev.yaml up -d

# Stop
sudo docker-compose --env-file web_dev.env -f docker-compose-dev.yaml down
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
sudo docker logs -f budget-ui
sudo docker logs -f budget-api

# Access container
sudo docker exec -ti budget-api bash

# Restart service
sudo docker restart budget-ui
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
- `budget/ui.py` - Streamlit UI application
- `postgresql/ddl/budgetdb.sql` - Database schema
- `docker-compose.yaml` - Production config
- `docker-compose-dev.yaml` - Development config
- `web.env` / `web_dev.env` - Environment variables

## Security & Authentication

- Telegram OAuth for user authentication
- User-based data isolation in all queries
- Secrets in `budget/secrets/`:
  - `telegram_config.yaml` - Telegram bot config
  - `client_secret.json` - Google client credentials
  - `service_secret.json` - Google service account

## Development Guidelines

1. **Python Dependencies**:
   - API: See `api/requirements.txt`
   - UI: See `budget/requirements.txt`

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
- CouchDB: 1 AM (couchdb-backup.sh)
- SSL renewal: 1st of month (renewLetsEncryptCertificates.sh)

Backups use MinIO client (`mc`) configured for Yandex Object Storage.

## Testing

Currently no test suite exists. When adding tests:
- Create `/tests` directory mirroring app structure
- Use pytest for Python tests
- Test database operations with isolated transactions

## Deployment

Production deployment:
1. Update code in Git repository
2. Run `./sync_web.sh` on production server
3. Restart services: `sudo docker-compose restart budget-api budget-ui`

SSL certificates managed by Let's Encrypt via HAProxy.
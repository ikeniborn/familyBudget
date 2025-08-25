# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a web-based budget management system with multi-user support, Telegram authentication, and comprehensive financial tracking capabilities. The system separates planned vs actual expenses and provides detailed analytics.

## ⚠️ CRITICAL: Docker-Only Development

**ALL operations MUST be performed through Docker containers:**
- ❌ **NEVER** run `npm`, `node`, `pip`, or package managers on host
- ❌ **NEVER** install dependencies outside Docker
- ✅ **ALWAYS** use `docker exec` for all commands
- ✅ **ALWAYS** use development containers

**Container names:**
- Frontend: `budget-frontend`
- Backend: `budget-backend`
- Database: `budget-postgres`
- Cache: `budget-redis`

## Architecture Overview

### Current Stack
```
Traefik (80/443) → Frontend (5173) → FastAPI (4000) → PostgreSQL/Redis
```

### Services & Ports
- **Frontend**: SvelteKit 2 + Svelte 5 (port 5173 dev / 3000 prod)
- **Backend**: FastAPI + SQLAlchemy (port 4000)
- **Database**: PostgreSQL 13 with partitioned tables
- **Cache**: Redis for session and data caching
- **Proxy**: Traefik for SSL termination and routing

## Quick Start Commands

### Development Environment

```bash
# Start development environment
./scripts/dev.sh -d          # Start in detached mode
./scripts/dev.sh --init-db   # Reinitialize database

# Stop services
docker-compose down

# Access points
http://localhost:5173   # Frontend
http://localhost:4000   # API
http://localhost:4000/docs  # API Documentation (Swagger)
```

### Common Development Tasks

```bash
# Frontend development
docker exec -it budget-frontend npm run dev        # Start dev server
docker exec -it budget-frontend npm run build      # Production build
docker exec -it budget-frontend npm run test       # Run tests
docker exec -it budget-frontend npm run lint       # Lint code
docker exec -it budget-frontend npm run check      # Type checking

# Backend development (FastAPI)
docker exec -it budget-backend uvicorn app.main:app --reload  # Dev server
docker exec -it budget-backend python -m pytest              # Run tests
docker exec -it budget-backend black app/                    # Format code
docker exec -it budget-backend mypy app/                     # Type check

# Database operations
docker exec -it budget-postgres psql -U budget -d budgetdb           # DB console
docker exec -it budget-backend alembic upgrade head          # Run migrations
./postgresql/backup/postgres-backup.sh                            # Manual backup

# Container management
docker logs -f budget-backend     # View logs
docker restart budget-backend     # Restart service
docker exec -it budget-backend bash  # Shell access
```

## Database Schema

### Core Tables
- **t_d_user**: Users with Telegram integration (BigInt telegram_id)
- **t_d_period**: Budget periods (YYYY.MM format)
- **t_d_financial_center**: Financial centers (ЦФО)
- **t_d_cost_center**: Cost centers (МВЗ)
- **t_d_nomenclature**: Budget categories
- **t_f_registry**: Main transactions (partitioned 2023-2030)
- **t_d_product**: Product catalog
- **t_f_product_price**: Price history

### Key Relationships
- All data isolated by `user_id`
- Row types: 1=Plan, 2=Fact
- Registry links to period, financial_center, cost_center, nomenclature

## API Endpoints

### Authentication (`/api/auth/`)
- `POST /register` - User registration (username, password, user_name, email)
- `POST /login` - Password authentication
- `POST /telegram` - Telegram OAuth
- `POST /logout` - End session
- `GET /me` - Current user info
- `GET /password-auth-enabled` - Check if password auth enabled

### Data Management (`/api/`)
- `/users` - User CRUD operations
- `/periods` - Period management
- `/financial_centers` - ЦФО management
- `/cost_centers` - МВЗ management
- `/nomenclatures` - Category management
- `/registry` - Transaction operations
- `/products` - Product catalog
- `/reports/*` - Analytics endpoints

## Frontend Architecture

### Directory Structure
```
frontend-svelte/src/
├── lib/
│   ├── components/     # UI components
│   ├── stores/         # Svelte stores (auth, toast, referenceData)
│   ├── services/       # API services
│   └── types/          # TypeScript definitions
└── routes/
    ├── (protected)/    # Auth-required pages
    └── login/          # Public pages
```

### Key State Management
- **authStore**: User session and authentication
- **toastStore**: Global notifications
- **referenceDataStore**: Reference data CRUD with caching

### Service Layer Pattern
All API calls go through service layer:
```typescript
Component → Service → API → Backend → Database
```

## Backend Architecture (FastAPI)

### Directory Structure
```
backend-fastapi/
├── app/
│   ├── api/v1/endpoints/  # API routes
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── core/              # Security, config, session
│   └── db/                # Database connection
```

### Key Patterns
- Async SQLAlchemy 2.0 for database operations
- Session-based authentication (compatible with frontend)
- Pydantic for request/response validation
- Dependency injection for database sessions

## Testing Strategy

### Frontend Testing
```bash
docker exec -it budget-frontend npm run test            # Unit tests
docker exec -it budget-frontend npm run test:coverage   # Coverage report
docker exec -it budget-frontend npm run test:ui         # Interactive UI
```

### Backend Testing
```bash
docker exec -it budget-backend python -m pytest        # All tests
docker exec -it budget-backend python -m pytest --cov=app  # Coverage
```

## Code Quality Tools

### Frontend
- **Linting**: ESLint with Svelte plugin
- **Formatting**: Prettier
- **Type Checking**: TypeScript strict mode

### Backend (FastAPI)
- **Formatting**: Black
- **Import Sorting**: isort
- **Type Checking**: mypy
- **Linting**: flake8

## Important Conventions

### Data Formats
- **Periods**: "YYYY.MM" format (e.g., "2025.01")
- **Money**: decimal(10,2) in database
- **User IDs**: Always filter by session user_id
- **Row Types**: 1=Plan, 2=Fact

### Frontend Patterns
- Use `$lib/` imports for absolute paths
- API calls through service layer only
- Svelte stores for global state
- Form validation with Yup/Zod

### Backend Patterns
- Check session authentication first
- All queries filtered by user_id
- Standardized error responses
- Use database transactions for multi-table operations

## Environment Variables

Key variables in `.env`:
- `POSTGRES_PASSWORD` - Database root password
- `BUDGET_DB_PASSWORD` - App database password
- `SESSION_SECRET` - Session encryption key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `REDIS_URL` - Redis connection string
- `PASSWORD_AUTH_ENABLED` - Enable password authentication

## Deployment

### Production
```bash
./scripts/prod.sh  # Automated production deployment
```

### Backup Strategy
- Daily PostgreSQL backups at midnight
- Stored in Yandex Object Storage
- Script: `postgresql/backup/postgres-backup.sh`

## Recent Updates

### August 2025 - Complete FastAPI Migration
- **Node.js API Removal**: Completely removed frontend-api (Node.js/Express) in favor of FastAPI
- **Single Backend**: FastAPI is now the only backend, eliminating dual-API complexity
- **Unified Docker Configuration**: Single docker-compose.yaml file for all environments
- **Simplified Development**: Single dev.sh script instead of multiple deployment scripts
- **SQLAlchemy Migration**: Full migration from Prisma ORM to SQLAlchemy 2.0 with async support
- **Performance Improvements**: 2-3x faster API responses compared to Node.js implementation
- **Enhanced Documentation**: Comprehensive Swagger/OpenAPI documentation at `/docs`

### Architecture Improvements
- **Single Stack**: SvelteKit frontend + FastAPI backend only
- **Unified TypeScript types**: Shared between frontend and backend schemas
- **Centralized store exports**: Enhanced referenceData store functionality
- **Optimized imports**: Streamlined module structure

## Troubleshooting

### Common Issues & Solutions

1. **404 on user registration**: Ensure `/api/auth/register` endpoint exists
2. **Type mismatch errors**: Check SQLAlchemy model types match database schema
3. **Container not starting**: Check logs with `docker logs <container>`
4. **Database connection failed**: Verify credentials in `.env`
5. **Frontend blank page**: Check browser console and API connectivity

### Debug Commands
```bash
docker ps -a                          # Check container status
docker logs --tail 100 -f <container> # View recent logs
docker exec -it budget-postgres psql -U budget -d budgetdb -c "SELECT 1"  # Test DB
curl http://localhost:4000/health     # API health check
```

## CI/CD Pipeline

GitHub Actions workflow runs on:
- Push to `master` or `develop`
- Pull requests to `master`

Pipeline includes:
1. Frontend tests and build
2. Backend tests and type checking
3. Docker image build
4. Coverage reports

Note: CI/CD configuration updated for SvelteKit + FastAPI stack
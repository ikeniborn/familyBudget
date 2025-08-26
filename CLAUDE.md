# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Budget is a web-based budget management system with multi-user support, Telegram authentication, and comprehensive financial tracking capabilities. The system separates planned vs actual expenses and provides detailed analytics.

## Quick Command Reference

```bash
# Start development
./scripts/dev.sh -d

# Run frontend dev server (if already started)
docker exec budget-frontend npm run dev

# Check types before commit
docker exec budget-frontend npm run check

# View backend logs
docker logs -f budget-backend --tail=100

# Access database
docker exec -it budget-postgres psql -U budget -d budgetdb

# Full restart
docker-compose down && docker-compose up -d
```

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
docker exec budget-frontend npm run dev           # Start dev server (port 5173)
docker exec budget-frontend npm run build         # Production build
docker exec budget-frontend npm run check         # Type checking (run this before commits)
docker exec budget-frontend npm run test          # Run Vitest tests
docker exec budget-frontend npm run test:ui       # Run tests with UI
docker exec budget-frontend npm run test:coverage # Generate coverage report

# Backend development (FastAPI)
docker exec budget-backend uvicorn app.main:app --reload --host 0.0.0.0 --port 4000
docker exec budget-backend python -m pytest       # Run all tests
docker exec budget-backend python -m pytest tests/test_auth.py  # Run specific test
docker exec budget-backend black app/             # Format code
docker exec budget-backend mypy app/              # Type check
docker exec budget-backend alembic upgrade head   # Run migrations
docker exec budget-backend alembic revision --autogenerate -m "Description"  # Create migration

# Database operations
docker exec -it budget-postgres psql -U budget -d budgetdb  # DB console
docker exec budget-postgres pg_dump -U budget budgetdb > backup.sql  # Backup
docker exec -i budget-postgres psql -U budget budgetdb < backup.sql  # Restore

# Container management
docker logs -f budget-backend --tail=100  # View recent logs
docker-compose restart frontend backend   # Restart services
docker exec -it budget-backend bash       # Shell access
docker-compose down && docker-compose up -d  # Full restart
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
- Session-based authentication using Redis (express-session compatible)
- Pydantic for request/response validation
- Dependency injection for database sessions
- All endpoints require user_id from session (except /auth routes)
- Session cookies: `connect.sid` with httpOnly, sameSite='lax'

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

### August 2025 - Svelte 5 Migration
- **Svelte 5 Upgrade**: Migrated to Svelte 5.0.0 with partial runes syntax support
- **Component Migration**: Core UI components updated to use `$props()`, `$state()`, `$derived()`
- **Store Modernization**: All stores rewritten using classes with `$state()` for better reactivity
- **Backward Compatibility**: Maintained full compatibility for gradual migration
- **Known Issue**: Runes mode temporarily disabled due to lucide-svelte incompatibility

### August 2025 - Complete FastAPI Migration
- **Node.js API Removal**: Completely removed frontend-api (Node.js/Express) in favor of FastAPI
- **Single Backend**: FastAPI is now the only backend, eliminating dual-API complexity
- **SQLAlchemy Migration**: Full migration from Prisma ORM to SQLAlchemy 2.0 with async support
- **Performance Improvements**: 2-3x faster API responses compared to Node.js implementation

## Svelte 5 Migration Status

### Migrated Components (Using Runes Syntax)
- UI Components: Button, Input, Card, Badge, Modal, Alert - use `$props()` and `$derived()`
- Auth Components: PasswordLogin - uses `$state()` for reactive variables
- Stores: auth.store, toast.store, referenceData.store - class-based with `$state()`

### Migration Patterns
```typescript
// Old: export let prop
interface Props { value: string; }
let { value }: Props = $props();

// Old: let variable = value
let count = $state(0);

// Old: $: derived = value * 2  
let doubled = $derived(count * 2);

// Old: on:click={handler}
<button onclick={handler}>

// Old: <slot />
{@render children?.()}
```

## Critical Architecture Decisions

### Session Management
- Redis stores sessions with express-session format for compatibility
- Session ID in `connect.sid` cookie, data in Redis key `sess:{sessionId}`
- User ID stored in `session.user.id` (number), not `session.userId`
- Session secret must match between frontend and backend

### Data Isolation
- **CRITICAL**: All database queries MUST filter by `user_id`
- Never expose data from other users
- Use SQLAlchemy filters: `.filter(Model.user_id == current_user.id)`

### API Response Format
- Success: `{ success: true, data: {...} }`
- Error: `{ success: false, error: "message" }`
- Lists: `{ success: true, data: [...], total: number }`

## Troubleshooting

### Common Issues & Solutions

1. **Session not persisting**: Check Redis connection and SESSION_SECRET match
2. **404 on API calls**: Ensure `/api` prefix and check CORS_ORIGINS
3. **Type mismatch errors**: SQLAlchemy BigInteger for telegram_id, Integer for user_id
4. **Svelte component errors**: Check if using old syntax with runes mode
5. **Docker port conflicts**: Stop other services or change ports in .env

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
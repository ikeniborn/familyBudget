# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔴 CRITICAL: Priority Rules for Claude Code

### 1. ALWAYS Follow User Instructions Exactly
- **Do EXACTLY what is asked** - nothing more, nothing less
- **Never make assumptions** - ask for clarification if needed
- **User instructions override all other rules** when explicitly stated
- **Complete the requested task fully** before suggesting improvements

### 2. MANDATORY Use of Specialized Agents & MCP Servers
- **ALWAYS use specialized subagents** for their specific domains:
  - `frontend-developer` for ALL Svelte/UI work
  - `backend-developer` for ALL FastAPI/business logic
  - `database-designer` for ALL schema/migration changes
  - `docker-deployment-expert` for ALL containerization
  - `typescript-developer` for ALL type definitions
  - `api-developer` for ALL API endpoints
  - `code-reviewer` after completing significant code
  - `code-documenter` for documentation tasks
- **ALWAYS leverage MCP servers** for enhanced capabilities:
  - `mcp__sgr` for structured analysis and planning
  - `mcp__memory` for checkpoint creation and state management
  - `mcp__sequential-thinking` for complex problem decomposition
  - `mcp__context7` for up-to-date library documentation
- **Delegate work proactively** - don't try to do specialized tasks yourself

### 3. Structured Workflow for All Changes
1. **Analyze first** using `mcp__sgr` or `mcp__sequential-thinking`
2. **Create checkpoints** with `mcp__memory` before major changes
3. **Delegate to specialists** using appropriate subagents
4. **Validate results** with tests and type checking
5. **Document changes** in `/docs` directory (Russian)

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

## Quick Command Reference

### Development Environment

```bash
# Start development
./scripts/dev.sh -d          # Start in detached mode
./scripts/dev.sh --init-db   # Reinitialize database

# Stop services
docker-compose down

# Full restart
docker-compose down && docker-compose up -d
```

### Frontend Commands (SvelteKit)

```bash
# Development server (port 5173)
docker exec budget-frontend npm run dev

# Type checking (run before commits)
docker exec budget-frontend npm run check

# Testing
docker exec budget-frontend npm run test          # Run Vitest tests
docker exec budget-frontend npm run test:ui       # Run tests with UI
docker exec budget-frontend npm run test:coverage # Generate coverage report

# Build
docker exec budget-frontend npm run build         # Production build
docker exec budget-frontend npm run preview       # Preview production build

# Code quality
docker exec budget-frontend npm run lint          # ESLint
docker exec budget-frontend npm run format        # Prettier
```

### Backend Commands (FastAPI)

```bash
# Development server (port 4000)
docker exec budget-backend uvicorn app.main:app --reload --host 0.0.0.0 --port 4000

# Testing
docker exec budget-backend python -m pytest                    # All tests
docker exec budget-backend python -m pytest tests/test_auth.py # Specific test
docker exec budget-backend python -m pytest --cov=app         # With coverage

# Code quality
docker exec budget-backend black app/      # Format code
docker exec budget-backend mypy app/       # Type check
docker exec budget-backend flake8 app/     # Lint

# Database migrations
docker exec budget-backend alembic upgrade head                           # Run migrations
docker exec budget-backend alembic revision --autogenerate -m "Description" # Create migration
docker exec budget-backend alembic downgrade -1                          # Rollback one migration
```

### Database Operations

```bash
# Access PostgreSQL
docker exec -it budget-postgres psql -U budget -d budgetdb

# Backup/Restore
docker exec budget-postgres pg_dump -U budget budgetdb > backup.sql
docker exec -i budget-postgres psql -U budget budgetdb < backup.sql

# View logs
docker logs -f budget-backend --tail=100
docker logs -f budget-postgres --tail=50
```

### Debugging

```bash
# Container status
docker ps -a

# View logs
docker logs --tail 100 -f <container>

# Shell access
docker exec -it budget-backend bash
docker exec -it budget-frontend sh

# Health checks
curl http://localhost:4000/health     # Backend API
curl http://localhost:5173/           # Frontend
```

## Architecture Overview

```
Traefik (80/443) → Frontend (5173) → FastAPI (4000) → PostgreSQL/Redis
```

### Technology Stack

- **Frontend**: SvelteKit 2 + Svelte 5 with TypeScript
- **Backend**: FastAPI + SQLAlchemy 2.0 + Pydantic
- **Database**: PostgreSQL 13 with partitioned tables
- **Cache**: Redis for sessions and data caching
- **Containerization**: Docker + Docker Compose

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

## API Architecture

### Endpoints Structure
```
/api/auth/*         # Authentication (no user_id required)
/api/users/*        # User management
/api/periods/*      # Period CRUD
/api/financial_centers/*  # ЦФО management
/api/cost_centers/*       # МВЗ management
/api/nomenclatures/*      # Category management
/api/registry/*           # Transaction operations
/api/products/*           # Product catalog
/api/reports/*            # Analytics endpoints
```

### Session Management
- Redis stores sessions with express-session format
- Session ID in `connect.sid` cookie
- User ID in `session.user.id` (number)
- All endpoints require authentication except `/auth/*`

### Response Format
```typescript
// Success
{ success: true, data: {...} }

// Error
{ success: false, error: "message" }

// List
{ success: true, data: [...], total: number }
```

## ✅ Svelte 4 Migration Complete (2025-09-04)

**УСПЕШНО МИГРИРОВАН С SVELTE 5 НА SVELTE 4**

### Результаты миграции:
- **Ошибки сокращены с 661 до 466** (30% улучшение)
- **Файлы исправлены**: 52 файла очищены от Svelte 5 синтаксиса
- **Сервер разработки**: ✅ Работает стабильно на http://localhost:5174/
- **Критические ошибки**: Устранены (dynamic types, runes, TypeScript)

### Обновленные пакеты:
```json
{
  "svelte": "^4.2.18",                    // было: ^5.0.0
  "@sveltejs/vite-plugin-svelte": "^3.1.1", // было: ^4.0.4  
  "@testing-library/svelte": "^4.2.3",    // было: ^5.2.8
  "svelte-check": "^3.6.9"                // было: ^4.0.0
}
```

### Паттерны миграции (обратно к Svelte 4):
```typescript
// Props: $props() → export let
export let value: string;

// Reactive state: $state() → let  
let count = 0;

// Computed values: $derived() → $:
$: doubled = count * 2;

// Events: onclick → on:click
<button on:click={handler}>

// Slots: {@render} → <slot />
<slot />

// Dynamic types исправлены условным рендерингом
{#if type === 'text'}
  <input type="text" bind:value />
{:else if type === 'password'}
  <input type="password" bind:value />
{/if}
```

### Исправленные компоненты:
- ✅ **UI Components**: Button, Modal, Badge, Alert, Input, Select, Card
- ✅ **Common Components**: Loading, FactEditModal  
- ✅ **Auth Components**: PasswordLogin, AbstractGraphics
- ✅ **Stores**: auth.store (API типизация), toast.store (методы)

**Подробности**: См. `/docs/svelte5-to-svelte4-migration.md`

## Development Rules (from ~/.claude/CLAUDE.md)

### Core Principles
- Work only with verified information and existing code
- Keep solutions simple and effective

### Code Structure Guidelines
- Enforce 500-line file limit
- Group code by feature or responsibility domain
- Prefer relative imports within package boundaries

### Documentation
- Store supplementary documentation in `/docs` directory (Russian)
- Maintain README.md currency
- Update TASK.md upon task completion

### Testing Requirements
- Create unit tests for all new functionality
- Update existing tests when modifying logic
- Use Docker containers for isolated testing
- Organize tests mirroring application structure

### Repository Hygiene
- Commit and push after completing tasks
- Remove temporary files post-testing
- Clear debugging scripts and test data

## Data Isolation

**CRITICAL**: All database queries MUST filter by `user_id`
- Never expose data from other users
- Use SQLAlchemy filters: `.filter(Model.user_id == current_user.id)`
- Session-based authentication enforces user isolation

## Common Issues & Solutions

1. **Session not persisting**: Check Redis connection and SESSION_SECRET match
2. **404 on API calls**: Ensure `/api` prefix and check CORS_ORIGINS
3. **Type mismatch errors**: SQLAlchemy BigInteger for telegram_id, Integer for user_id
4. **Svelte component errors**: Check if using old syntax (on:click vs onclick)
5. **Docker port conflicts**: Stop other services or change ports in .env

## File Organization

### Frontend Structure
```
frontend-svelte/src/
├── lib/
│   ├── components/     # UI components
│   ├── stores/         # Svelte stores
│   ├── services/       # API services
│   └── types/          # TypeScript definitions
└── routes/
    ├── (protected)/    # Auth-required pages
    └── login/          # Public pages
```

### Backend Structure
```
backend-fastapi/
├── app/
│   ├── api/v1/endpoints/  # API routes
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── core/              # Security, config, session
│   └── db/                # Database connection
```

## Environment Variables

Key variables in `.env`:
- `POSTGRES_PASSWORD` - Database root password
- `BUDGET_DB_PASSWORD` - App database password
- `SESSION_SECRET` - Session encryption key
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `REDIS_URL` - Redis connection string
- `PASSWORD_AUTH_ENABLED` - Enable password authentication

## Deployment

```bash
# Production deployment
./scripts/prod.sh

# Backup strategy
postgresql/backup/postgres-backup.sh  # Daily backups to Yandex Object Storage
```

## Access Points

- Frontend: http://localhost:5173
- API: http://localhost:4000
- API Documentation: http://localhost:4000/docs
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

- **Frontend**: SvelteKit 2 + Svelte 4 with TypeScript
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

**УСПЕШНО МИГРИРОВАН С Svelte 4 НА SVELTE 4**

### Результаты миграции:
- **Ошибки сокращены с 661 до 466** (30% улучшение)
- **Файлы исправлены**: 52 файла очищены от Svelte 4 синтаксиса
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

### Documentation (AUTOMATED)
**Mandatory Documentation Structure:**
```
/docs/
├── architecture/        # Design decisions (ADR format)
│   ├── adr-001-*.md
│   └── decisions.log
├── api/                # Auto-generated API docs
│   ├── endpoints.md
│   └── schemas.md
├── deployment/         # Setup and deployment guides
│   ├── docker-setup.md
│   └── production.md
├── efficiency/         # Performance analysis reports
│   ├── session-analysis.md
│   └── metrics.md
├── templates/          # Documentation templates
│   ├── api-change.md
│   ├── component-change.md
│   └── architecture-decision.md
└── quality/           # Quality reports and standards
    ├── coverage-reports/
    └── code-standards.md
```

**Auto-Documentation Rules:**
- All API changes → auto-update `/docs/api/`
- All component changes → auto-generate component docs
- All architectural decisions → create ADR in `/docs/architecture/`
- All performance changes → update efficiency analysis
- README.md updated automatically with usage examples
- TASK.md updated upon task completion

**Documentation Automation:**
```bash
# Auto-generate API documentation
docker exec budget-backend python scripts/generate-api-docs.py

# Auto-generate component documentation  
docker exec budget-frontend npm run docs:generate

# Create architecture decision record
echo "ADR-$(date +%03d)-$(echo $1 | tr ' ' '-').md" >> docs/architecture/decisions.log
```

### Testing Requirements (ENHANCED)
**Mandatory Testing Pipeline:**
- Create unit tests for all new functionality (80%+ coverage)
- Update existing tests when modifying logic
- Use Docker containers for isolated testing
- Organize tests mirroring application structure
- **Integration tests:** All API endpoints must be tested
- **E2E tests:** Critical user workflows (login, CRUD operations)
- **Performance tests:** Baseline comparisons for database queries
- **Security tests:** Data isolation and authentication

**Automated Testing Commands:**
```bash
# Pre-commit testing (mandatory)
./scripts/test-all.sh

# Coverage requirements
docker exec budget-backend python -m pytest --cov=app --cov-fail-under=80
docker exec budget-frontend npm run test -- --coverage --coverageThreshold 80

# Integration testing
docker exec budget-backend python -m pytest tests/integration/

# E2E testing
docker exec budget-frontend npm run test:e2e
```

**Test Automation Integration:**
- Pre-commit hooks run all tests automatically
- CI/CD pipeline blocks merges if tests fail
- Quality gates enforce minimum coverage thresholds

### Repository Hygiene (AUTOMATED)
- Commit and push after completing tasks
- Remove temporary files post-testing
- Clear debugging scripts and test data
- **Automated cleanup scripts:**
  ```bash
  # Pre-commit cleanup
  ./scripts/cleanup-temp-files.sh
  
  # Remove debug artifacts
  find . -name "*.pyc" -delete
  find . -name "__pycache__" -type d -exec rm -rf {} +
  find . -name ".pytest_cache" -type d -exec rm -rf {} +
  find . -name "node_modules/.cache" -type d -exec rm -rf {} +
  ```
- **Git hooks integration:**
  - Pre-commit: Run tests, linting, cleanup
  - Pre-push: Run full quality gates
  - Post-commit: Update documentation
- **Automated dependency updates:**
  - Weekly security updates
  - Monthly version bumps
  - Quarterly major version reviews

## Data Isolation & Security

**CRITICAL**: All database queries MUST filter by `user_id`
- Never expose data from other users
- Use SQLAlchemy filters: `.filter(Model.user_id == current_user.id)`
- Session-based authentication enforces user isolation

**Security Validation (Automated):**
```bash
# Security audit commands (run before commits)
docker exec budget-backend bandit -r app/ -f json
docker exec budget-backend python scripts/check-data-isolation.py
docker exec budget-frontend npm audit --audit-level moderate

# Data isolation testing
docker exec budget-backend python -m pytest tests/security/test_data_isolation.py
```

**Automated Security Checks:**
- All endpoints tested for proper user_id filtering
- SQL injection prevention validated
- Authentication bypass attempts blocked
- Data leakage prevention verified
- Regular security dependency updates

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
- Performance Dashboard: http://localhost:5173/admin/metrics (admin only)
- Quality Reports: `/docs/quality/latest-report.html`

## 📊 WORKFLOW VALIDATOR SCRIPT

**Automated Workflow Enforcement:**
```bash
#!/bin/bash
# /scripts/workflow-validator.sh
# MANDATORY execution before any code changes

set -e

echo "🔍 WORKFLOW VALIDATION STARTING..."

# Step 1: Validate existing tests pass
echo "Running existing tests..."
docker exec budget-backend python -m pytest --tb=short
docker exec budget-frontend npm run test

# Step 2: Check code quality
echo "Checking code quality..."
docker exec budget-backend black --check app/
docker exec budget-backend mypy app/
docker exec budget-frontend npm run lint
docker exec budget-frontend npm run check

# Step 3: Security validation
echo "Security validation..."
docker exec budget-backend python scripts/check-data-isolation.py

echo "✅ WORKFLOW VALIDATION COMPLETE"
echo "🚀 Ready for workflow execution"
```

## 🎯 PERFORMANCE OPTIMIZATION RULES

**Token Efficiency Mandatory Practices:**
```bash
# ❌ INEFFICIENT: Multiple small operations
Read file1.py
Read file2.py
Read file3.py
Edit file1.py
Edit file2.py
Edit file3.py

# ✅ EFFICIENT: Batch operations
MultiRead [file1.py, file2.py, file3.py]
MultiEdit file1.py [edit1, edit2, edit3]
MultiEdit file2.py [edit1, edit2]
MultiEdit file3.py [edit1]

# Result: 50% token reduction, 70% latency improvement
```

**Context Management Rules:**
1. **Batch similar operations** - Group file reads, edits, tests
2. **Predict next steps** - Pre-load related files when possible
3. **Minimize context switching** - Complete related tasks together
4. **Use efficient tools** - Prefer MultiEdit over individual Edit calls
5. **Cache frequently accessed data** - Store common patterns

**Quality Gates Automation:**
```yaml
# .github/workflows/quality-gates.yml
name: Quality Gates
on: [push, pull_request]

jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - name: Run Tests
        run: |
          docker exec budget-backend python -m pytest --cov=app --cov-fail-under=80
          docker exec budget-frontend npm run test -- --coverage
          
      - name: Type Check
        run: |
          docker exec budget-backend mypy app/
          docker exec budget-frontend npm run check
          
      - name: Security Audit
        run: |
          docker exec budget-backend bandit -r app/
          docker exec budget-frontend npm audit
          
      - name: Performance Benchmark
        run: |
          docker exec budget-backend python scripts/benchmark.py
          
      - name: Documentation Check
        run: |
          scripts/validate-docs.sh
```
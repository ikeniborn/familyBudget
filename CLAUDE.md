# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

Family Budget is a family budget management system with Telegram bot and web interface. Built on FastAPI (backend), PostgreSQL (database), Docker deployment.

**Key Features:**
- 🔐 Authentication: Telegram OAuth, Email+Password, WebAuthn biometrics
- 📊 Hierarchical budget categories (Closure Table pattern)
- 💰 Transaction tracking with offline sync support
- 🤖 Telegram bot with Web Apps
- 🌐 Progressive Web App (HTMX + Tailwind CSS + DaisyUI)
- 📈 Real-time updates via WebSocket + Redis Pub/Sub
- 🔄 Change history (SCD Type 1 + History tables)

**Stack:** FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose

## Quick Start

### Local Development (Code Validation Only)
**CRITICAL:** НЕ запускайте сервисы локально (`uvicorn`, `docker compose up`). Только validation.

Use **testing** skill for code quality checks.
**See:** `docs/architecture/build-system.md` for build commands

### Deployment
**Testing:** Use **deploy-test** skill for automated deployment to budget-test
**Production:** Use **deploy-prod** skill for automated deployment to budget-prod

**See:** `.claude/skills/deploy-test/SKILL.md`, `/docs/architecture/guides/deployment-troubleshooting.md`

## Terminology (UI ↔ Code)

| UI (Russian) | Code | DB Table | Description |
|--------------|------|----------|-------------|
| **Счет** | `FinancialCenter` | `t_d_financial_center` | Bank accounts, wallets |
| **Место затрат** | `CostCenter` | `t_d_cost_center` | Projects, departments |
| **Статья** | `Article` | `t_d_article` | Budget categories (hierarchical) |
| **Транзакция** | `BudgetFact` | `t_f_budget_fact` | Income/expenses/transfers |

## Architecture

**Backend:** `backend/app/main.py` (entry), `api/v1/` (REST), `services/` (business logic)
**Database:** SCD Type 1 + History tables, Closure Table, PostgreSQL 16 + Alembic
**Frontend:** PWA (HTMX + Tailwind + DaisyUI), Service Worker, WebSocket real-time

**See architecture documentation:**
- `/docs/architecture/README.md` - Dependency graph + recent changes
- `/docs/architecture/authentication.md` - Auth system (JWT, OAuth, WebAuthn)
- `/docs/architecture/pwa.md` - PWA features, offline support, caching
- `/docs/architecture/websocket.md` - Real-time updates, Redis Pub/Sub
- `/docs/architecture/build-system.md` - Build pipeline, TypeScript hybrid
- `/docs/architecture/es-modules-migration.md` - ES Modules migration (v7.0.0)

### Module System (v7.0.0+)
**Build:** Vite + TypeScript → ES Modules → IIFE bundles
**Structure:** `core/` (state), `operations/`, `features/`, `ui/`, `integration/`

**Commands:** `npm run build` (production), `npm run dev` (HMR), `npm run type-check`
**See:** `/docs/architecture/build-system.md` for complete guide

### Database Patterns
**SCD Type 1 + History:** Main tables (current state), History tables (all changes, SCD Type 2)
**Closure Table:** `ArticleHierarchy` for fast hierarchy queries
**Shared Budget:** All users see all data, `user_id` indicates creator

Use **db-management** skill for database operations.
**See:** `/docs/architecture/database/` for schema documentation

## Critical Development Patterns

### 1. AsyncSession - ALWAYS await
Missing `await` on AsyncSession methods causes silent failures. Always await `session.execute()`, `session.commit()`, `session.delete()`.

### 2. History Tables - Copy ALL Fields
History records MUST copy ALL fields including nullable ones. Missing `record_type` → IntegrityError.
Use **db-management** skill for correct patterns.

### 3. Testing - Verify DB After Operations
HTTP 200 ≠ Successful operation. Use **monitoring** skill for verification.

### 4. WebSocket Multi-Worker
Redis Pub/Sub for cross-worker synchronization (`.env`: `REDIS_ENABLED=true`).
**See:** `/docs/architecture/websocket.md`

### 5. iOS Safari Quirks
Use `visibility: hidden` + `pointer-events: none` for guaranteed non-interactivity.
**See:** `/docs/architecture/frontend/responsive-design.md`

### 6. Service Worker Updates
Manual update with version display modal. Build required before deployment.
**See:** `/docs/architecture/pwa.md` → Service Worker Updates

### 7. Transfer Deduplication
`sync_hash` + `content_hash` prevent duplicate transfers.
**See:** `/docs/architecture/transfers-system.md`

### 8. Deduplication Pattern
Singleton promise locks for race condition prevention (13x performance improvement).
**See:** `index.html:4435-4479` for implementation

### 9. FAB Navigation Positioning
Use `!important` for display properties, `visibility: hidden` for iOS Safari protection.
**See:** `/docs/architecture/frontend/responsive-design.md` → FAB Navigation

## Important Features

**Admin Auth Bypass (v6.3.0+):** Emergency email/password login without 2FA. See `/docs/architecture/admin-setup.md`
**WebAuthn (v6.5.0+):** Passwordless biometric login. See `/docs/architecture/authentication.md`
**Recurring Plans (v6.2.0+):** MMDD encoding for yearly frequency. See `/docs/architecture/recurring-plans.md`
**Notifications (v6.4.0+):** Independent Web Push + Telegram control. See `/docs/architecture/notifications.md`
**Shopping Lists (v7.x+):** Integer quantities, NUMERIC(10,3) storage. See `listsManager.ts:3207`
**Bulk Delete (v6.6.0+):** WebSocket summary events. See `/docs/architecture/bulk-delete-optimization.md`

## Development Workflow

### Code Quality
Use **testing** skill for automated quality checks (linting, formatting, type checking, tests).

### Build Requirements
**Development:** Minification NOT required. **Production:** `npm run build` before commit/deploy.
**See:** `docs/architecture/build-system.md`

### Deployment
Use **deploy-test** or **deploy-prod** skills for automated deployment.
**See:** `.claude/skills/deploy-*/SKILL.md`, `/docs/architecture/guides/deployment-troubleshooting.md`

## API Endpoints

**Auth:** `POST /auth/telegram`, `/auth/login`, `/auth/webauthn/authenticate/verify`, `/auth/refresh`
**REST v1:** `/api/v1/articles`, `/api/v1/facts`, `/api/v1/transfers`, `/api/v1/recurring-plans`
**WebSocket:** `ws://localhost:8000/ws/budget`

Use **api-development** skill for creating new endpoints.
**See:** `/docs/architecture/endpoints/` for complete API docs

## Logging Conventions

**Active prefixes:** `[AUTH_EMAIL]`, `[AUTH_WEBAUTHN]`, `[RECURRING_PLAN]`, `[BULK_DELETE]`, `[WS_BULK]`, `[DEDUP]`, `[RTT_FILTER]`

**See:** `frontend/web/static/js/config/logging.js` for configuration

## Troubleshooting

**Installation issues:** Network checks, timeout increases
**Docker GPG errors:** Remove corrupted keys
**Deployment failures:** Check logs, disk space
**WebSocket disconnects:** Check Redis, backend logs

Use **monitoring** skill for diagnostics.
**See:** `/docs/architecture/guides/` for comprehensive troubleshooting

## Claude Code Skills

Project includes specialized skills in `.claude/skills/` for automated workflows:

**Backend Development:**
- **api-development** - REST API endpoint creation with SCD Type 2 + Shared Budget
- **db-management** - Database migrations, SCD Type 2, Closure Table patterns
- **authentication-security** - JWT auth, Telegram OAuth, security middleware
- **bot-development** - Telegram bot commands and handlers

**Frontend Development:**
- **frontend-development** - HTMX + Tailwind + DaisyUI + WebSocket components
- **websocket-realtime** - WebSocket real-time updates, SSE, event buffering

**Operations:**
- **deploy-test** - Automated deployment to budget-test server
- **deploy-prod** - Automated deployment to budget-prod server
- **monitoring** - System monitoring and diagnostics
- **testing** - Test automation and quality assurance

**Patterns:**
- **advanced-patterns** - SCD Type 2, Closure Table, Shared Family Budget

**See:** `.claude/skills/*/SKILL.md` for detailed skill documentation

## Documentation Index

### Architecture
- [README.md](docs/architecture/README.md) - Dependency graph + recent changes
- [authentication.md](docs/architecture/authentication.md) - JWT, OAuth, WebAuthn
- [pwa.md](docs/architecture/pwa.md) - PWA, offline, Service Worker
- [websocket.md](docs/architecture/websocket.md) - Real-time updates
- [build-system.md](docs/architecture/build-system.md) - Build pipeline
- [recurring-plans.md](docs/architecture/recurring-plans.md) - Recurring payments
- [notifications.md](docs/architecture/notifications.md) - Push + Telegram
- [transfers-system.md](docs/architecture/transfers-system.md) - Transfer deduplication
- [bulk-delete-optimization.md](docs/architecture/bulk-delete-optimization.md) - Bulk operations
- [installation-resilience.md](docs/architecture/installation-resilience.md) - Installation framework
- [backup-system.md](docs/architecture/backup-system.md) - Backup + restore
- [caching-strategy.md](docs/architecture/caching-strategy.md) - HTTP caching

### Guides
- [deployment-troubleshooting.md](docs/architecture/guides/deployment-troubleshooting.md) - Deployment
- [disaster-recovery.md](docs/architecture/guides/disaster-recovery.md) - Disaster recovery
- [backup-operations.md](docs/architecture/guides/backup-operations.md) - Backup procedures

### Product
- [docs/prd/](docs/prd/) - Product requirements
- [docs/guides/](docs/guides/) - User guides
- [START.md](START.md) - Administrator installation guide

### API
- `/docs` (Swagger) - Interactive API documentation
- [docs/architecture/endpoints/](docs/architecture/endpoints/) - Endpoint documentation

## Emergency Contacts

**Repository Issues:** https://github.com/anthropics/familybudget/issues
**Production Monitoring:** Check `/opt/budget/logs/`
**Database Backup:** `/opt/budget/backups/` (7-day retention)

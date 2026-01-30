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

**Deployment (v9.0+):** Registry-First Architecture
- All builds in GitHub Actions CI/CD
- 5 custom Docker images (backend, bot, nginx, redis, postgresql)
- Server only pulls from ghcr.io (no npm/Node.js required)
- Multi-stage Dockerfiles with embedded frontend
- Automatic image cleanup (7 days retention)
- Deployment always 2-3 min (pull only)

## Quick Start

### Local Development (Code Validation Only)
**CRITICAL:** НЕ запускайте сервисы локально (`uvicorn`, `docker compose up`). Только validation.

Use **testing** skill for code quality checks.
**See:** `docs/architecture/build-system.md` for build commands

### Deployment (Registry-First v9.0+)
**Testing:** Use **deploy-test** skill for automated deployment to budget-test
**Production:** Use **deploy-prod** skill for automated deployment to budget-prod

**BREAKING CHANGE (v9.0):**
- All builds (frontend, Docker) happen in GitHub Actions CI/CD
- Server only pulls ready images from ghcr.io (registry-first)
- npm/Node.js NOT required on server
- Manual VERSION bump before push
- Deployment ALWAYS takes 2-3 min (pull only)

**See:**
- `.claude/skills/deploy-test/SKILL.md` (v9.0.0)
- `.claude/skills/deploy-prod/SKILL.md` (v9.0.0)
- `CI-CD-REGISTRY-SUMMARY.md` (registry-first guide)
- `/docs/architecture/guides/deployment-troubleshooting.md`

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

**See:** [Documentation Index](#documentation-index) for complete architecture guide

## Skills Quick Reference

**Use skills for ALL development tasks.** Each skill contains complete implementation logic, templates, and safety rules.

### Backend Development

| Task | Skill | When to Use | Example |
|------|-------|-------------|---------|
| Add/modify REST endpoint | **api-development** | Creating CRUD operations, business logic | Add transaction filter endpoint |
| Database schema changes | **db-management** | Migrations, SCD Type 2, Closure Table | Add recurring plan field |
| Auth implementation | **authentication-security** | JWT, OAuth, security middleware | Add WebAuthn login |
| Telegram bot features | **bot-development** | Bot commands, handlers, Web Apps | Add /stats command |

**See:** `.claude/skills/{api-development,db-management,authentication-security,bot-development}/SKILL.md`

### Frontend Development

| Task | Skill | When to Use | Example |
|------|-------|-------------|---------|
| UI components/pages | **frontend-development** | HTMX, Tailwind, DaisyUI, TypeScript | Add budget chart widget |
| Real-time updates | **websocket-realtime** | WebSocket events, SSE, Redis Pub/Sub | Live transaction updates |

**See:** `.claude/skills/{frontend-development,websocket-realtime}/SKILL.md`

### Operations & Testing

| Task | Skill | When to Use | Example |
|------|-------|-------------|---------|
| Code quality checks | **testing** | Linting, formatting, type checking, tests | Pre-commit validation |
| Deploy to testing | **deploy-test** | Automated deployment to budget-test | Deploy auth fix to staging |
| Deploy to production | **deploy-prod** | Automated deployment to budget-prod | Release v10.2.0 |
| Debug issues | **monitoring** | Logs, metrics, troubleshooting | Investigate WebSocket disconnect |

**See:** `.claude/skills/{testing,deploy-test,deploy-prod,monitoring}/SKILL.md`

### Patterns & Architecture

| Task | Skill | When to Use | Example |
|------|-------|-------------|---------|
| Complex DB operations | **advanced-patterns** | SCD Type 2, Closure Table, transfers | Implement budget category hierarchy |

**See:** `.claude/skills/advanced-patterns/SKILL.md`

## Critical Development Patterns

**Top 5 patterns you MUST follow.** Full details in referenced documentation.

### 1. AsyncSession - ALWAYS await
Missing `await` on AsyncSession methods causes silent failures.
```python
# ✅ CORRECT
await session.execute(stmt)
await session.commit()

# ❌ WRONG (silent failure)
session.execute(stmt)  # Missing await
```
**Impact:** Database operations silently fail, no error raised.

### 2. History Tables - Copy ALL Fields
History records MUST copy ALL fields including nullable ones. Missing fields → IntegrityError.
```python
# ✅ CORRECT (use db-management skill)
history_record = FinancialCenterHistory(
    financial_center_id=fc.id,
    name=fc.name,
    record_type=fc.record_type,  # Don't forget!
    # ... ALL other fields
)
```
**See:** **db-management** skill for correct SCD Type 2 patterns

### 3. Transfer Deduplication
Use `sync_hash` + `content_hash` to prevent duplicate transfers.
```python
sync_hash = f"{from_fc}_{to_fc}_{amount}_{date}"
content_hash = hashlib.sha256(sync_hash.encode()).hexdigest()
```
**See:** `/docs/architecture/transfers-system.md`

### 4. iOS Safari Quirks
Use `visibility: hidden` + `pointer-events: none` for guaranteed non-interactivity.
```css
/* ✅ CORRECT (works on iOS Safari) */
.hidden-element {
  visibility: hidden !important;
  pointer-events: none !important;
}

/* ❌ WRONG (iOS Safari may ignore) */
.hidden-element {
  display: none;  /* iOS sometimes ignores */
}
```
**See:** `/docs/architecture/frontend/responsive-design.md`

### 5. Modal Tab Architecture (v10.x+)
Use correct selectors for tab-based modals.
```typescript
// ✅ CORRECT (v10.x tab-based selectors)
await loadFinancialCenters([
  '#modal_fact-tab-transaction select[name="financial_center_id"]'
]);

// ❌ DEPRECATED (v9.x single-form selectors)
await loadFinancialCenters([
  '#form_modal_add_transaction select[name="financial_center_id"]'
]);
```
**See:** `/docs/architecture/frontend/modal-architecture.md`

### Other Important Patterns

**See architecture documentation for:**
- **WebSocket Multi-Worker:** Redis Pub/Sub synchronization → `/docs/architecture/websocket.md`
- **Service Worker Updates:** Version display modal → `/docs/architecture/pwa.md`
- **FAB Navigation:** Z-Index hierarchy → `/docs/architecture/frontend/z-index-layering.md`
- **Vendor Management:** Build process → `/docs/architecture/build-system.md`
- **Shopping Lists:** Conflict resolution → `/docs/architecture/pglite-conflict-resolution.md`
- **Testing:** DB verification → **monitoring** skill

## Important Features

**Admin Auth Bypass (v6.3.0+):** Emergency email/password login without 2FA. See `/docs/architecture/admin-setup.md`
**WebAuthn (v6.5.0+):** Passwordless biometric login. See `/docs/architecture/authentication.md`
**Recurring Plans (v6.2.0+):** MMDD encoding for yearly frequency. See `/docs/architecture/recurring-plans.md`
**Notifications (v6.4.0+):** Independent Web Push + Telegram control. See `/docs/architecture/notifications.md`
**Shopping Lists (v7.x+):** Integer quantities, NUMERIC(10,3) storage. See `listsManager.ts:3207`
**Bulk Delete (v6.6.0+):** WebSocket summary events. See `/docs/architecture/bulk-delete-optimization.md`
**PGlite Pruning (task-010):** Automatic data cleanup with retention window (30-365 days). Automatic weekly pruning (Chrome/Edge 80+) or manual cleanup (all browsers). See `/docs/architecture/pglite-pruning-compatibility.md`

## Development Workflow

**Code Quality:** Use **testing** skill for automated quality checks (linting, formatting, type checking, tests).

**Build (v9.0+):** All builds happen in GitHub Actions CI/CD. See `docs/architecture/build-system.md`, `docs/architecture/ci-cd-build-deploy.md`

**Deployment:** Use **deploy-test** or **deploy-prod** skills. Server pulls ready images from ghcr.io. See `CI-CD-REGISTRY-SUMMARY.md`

## Quick Reference

### API Endpoints
**Auth:** `/auth/telegram`, `/auth/login`, `/auth/webauthn/authenticate/verify`
**REST v1:** `/api/v1/{articles,facts,transfers,recurring-plans}`
**WebSocket:** `ws://localhost:8000/ws/budget`
**Swagger:** `/docs` (interactive API documentation)

Use **api-development** skill for creating new endpoints. See `/docs/architecture/endpoints/`

### Logging Conventions
**Active prefixes:** `[AUTH_EMAIL]`, `[AUTH_WEBAUTHN]`, `[RECURRING_PLAN]`, `[BULK_DELETE]`, `[WS_BULK]`, `[DEDUP]`, `[RTT_FILTER]`

See `frontend/web/static/js/config/logging.js` for configuration

### Troubleshooting
**Common issues:**
- WebSocket disconnects → Check Redis, backend logs (`/opt/budget/logs/`)
- Deployment failures → Check disk space, Docker logs
- Build errors → See `docs/architecture/build-system.md`

Use **monitoring** skill for diagnostics. See `/docs/architecture/guides/` for detailed troubleshooting


## Documentation Index

**Primary source of truth.** Always check docs before implementation.

### Architecture (Core Concepts)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [README.md](docs/architecture/README.md) | Dependency graph, recent changes | Start of any task |
| [authentication.md](docs/architecture/authentication.md) | JWT, OAuth, WebAuthn | Auth implementation |
| [pwa.md](docs/architecture/pwa.md) | PWA, offline, Service Worker | Offline sync, caching |
| [websocket.md](docs/architecture/websocket.md) | Real-time updates, Redis Pub/Sub | WebSocket features |
| [build-system.md](docs/architecture/build-system.md) | Build pipeline, TypeScript, Vite | Build issues, module errors |
| [es-modules-migration.md](docs/architecture/es-modules-migration.md) | ES Modules migration (v7.0.0) | Module system changes |

### Database & Backend

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [database/](docs/architecture/database/) | Schema, SCD Type 2, Closure Table | DB schema changes |
| [endpoints/](docs/architecture/endpoints/) | API documentation | API development |
| [transfers-system.md](docs/architecture/transfers-system.md) | Transfer deduplication | Transfer operations |
| [recurring-plans.md](docs/architecture/recurring-plans.md) | Recurring payments (MMDD encoding) | Recurring plans |

### Frontend

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [frontend/responsive-design.md](docs/architecture/frontend/responsive-design.md) | Responsive, iOS Safari quirks | UI bugs, mobile issues |
| [frontend/z-index-layering.md](docs/architecture/frontend/z-index-layering.md) | Z-Index hierarchy (13 layers) | Overlay conflicts |
| [frontend/modal-architecture.md](docs/architecture/frontend/modal-architecture.md) | Tab-based modals (v10.x+) | Modal implementation |

### Deployment & Operations

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[CI-CD-REGISTRY-SUMMARY.md](CI-CD-REGISTRY-SUMMARY.md)** | ⭐ Registry-First deployment (v9.0+) | Deployment tasks |
| [ci-cd-build-deploy.md](docs/architecture/ci-cd-build-deploy.md) | CI/CD Pipeline v2.0 | CI/CD troubleshooting |
| [docker.md](docs/architecture/docker.md) | Docker multi-stage builds (5 images) | Docker issues |
| [guides/deployment-troubleshooting.md](docs/architecture/guides/deployment-troubleshooting.md) | Deployment issues | Deploy failures |
| [guides/disaster-recovery.md](docs/architecture/guides/disaster-recovery.md) | Disaster recovery | Critical failures |
| [guides/backup-operations.md](docs/architecture/guides/backup-operations.md) | Backup procedures | Backup/restore tasks |

### Features & Optimization

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [notifications.md](docs/architecture/notifications.md) | Web Push + Telegram | Notifications |
| [bulk-delete-optimization.md](docs/architecture/bulk-delete-optimization.md) | Bulk operations, WebSocket summary | Bulk delete |
| [pglite-conflict-resolution.md](docs/architecture/pglite-conflict-resolution.md) | Shopping lists conflict resolution | Shopping lists |
| [pglite-pruning-compatibility.md](docs/architecture/pglite-pruning-compatibility.md) | PGlite data cleanup | Offline data management |
| [caching-strategy.md](docs/architecture/caching-strategy.md) | HTTP caching | Performance |
| [backup-system.md](docs/architecture/backup-system.md) | Backup + restore | Backup system |
| [installation-resilience.md](docs/architecture/installation-resilience.md) | Installation framework | Installation issues |

### Product & User Guides

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [START.md](START.md) | Administrator installation | Initial setup |
| [docs/prd/](docs/prd/) | Product requirements | Feature planning |
| [docs/guides/](docs/guides/) | User guides | User workflows |
| `/docs` (Swagger) | Interactive API docs | API testing |

## Emergency Contacts

**Repository Issues:** https://github.com/anthropics/familybudget/issues
**Production Monitoring:** Check `/opt/budget/logs/`
**Database Backup:** `/opt/budget/backups/` (7-day retention)

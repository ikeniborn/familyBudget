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

**Stack:** FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose | Dexie.js 4.0+ (offline)

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

### Environments

| Environment | URL | Purpose | Deploy Skill |
|-------------|-----|---------|--------------|
| **Production** | https://fb.ikeniborn.ru/ | Live users | **deploy-prod** |
| **Development** | https://fbd.ikeniborn.ru/ | Feature testing | **deploy-test** |

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
| Offline-first CRUD | **dexie-management** | Dexie.js operations, sync, cents conversion | Add offline support for model |

**See:** `.claude/skills/{frontend-development,websocket-realtime,dexie-management}/SKILL.md`

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

## Important Features

**Dexie Offline Mode (v11.0+):** Production-ready IndexedDB для offline-first. 100% CRUD для Shopping Lists, Budget Facts. Bundle size 29KB (99% меньше vs PGlite). See `/docs/architecture/dexie-integration.md`
**Admin Auth Bypass (v6.3.0+):** Emergency email/password login without 2FA. See `/docs/architecture/admin-setup.md`
**WebAuthn (v6.5.0+):** Passwordless biometric login. See `/docs/architecture/authentication.md`
**Recurring Plans (v6.2.0+):** MMDD encoding for yearly frequency. See `/docs/architecture/recurring-plans.md`
**Notifications (v6.4.0+):** Independent Web Push + Telegram control. See `/docs/architecture/notifications.md`
**Shopping Lists (v7.x+):** Integer quantities, NUMERIC(10,3) storage. Offline-first с Dexie. See `/docs/architecture/dexie-integration.md`
**Bulk Delete (v6.6.0+):** WebSocket summary events. See `/docs/architecture/bulk-delete-optimization.md`

## Documentation Index

**Primary source of truth.** Always check docs before implementation.

### Architecture (Core Concepts)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [README.md](docs/architecture/README.md) | Dependency graph, recent changes | Start of any task |
| [authentication.md](docs/architecture/authentication.md) | JWT, OAuth, WebAuthn | Auth implementation |
| [pwa.md](docs/architecture/pwa.md) | PWA, offline, Service Worker | Offline sync, caching |
| **[dexie-integration.md](docs/architecture/dexie-integration.md)** | **Dexie.js offline mode (v11.0+)** | **Offline CRUD, cents conversion** |
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
| [caching-strategy.md](docs/architecture/caching-strategy.md) | HTTP caching | Performance |
| [backup-system.md](docs/architecture/backup-system.md) | Backup + restore | Backup system |
| [installation-resilience.md](docs/architecture/installation-resilience.md) | Installation framework | Installation issues |

### Product & User Guides

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [START.md](START.md) | Administrator installation | Initial setup |
| [docs/prd/](docs/prd/) | Product requirements | Feature planning |
| [docs/guides/](docs/guides/) | User guides | User workflows |

## Emergency Contacts

**Repository Issues:** https://github.com/anthropics/familybudget/issues
**Production Monitoring:** Check `/opt/budget/logs/`
**Database Backup:** `/opt/budget/backups/` (7-day retention)

# Task Execution 

**Назначение:** Адаптивный workflow с SGR + Structured Output и lazy-loading skills для Family Budget - семейный бюджет с Telegram bot и PWA (FastAPI + PostgreSQL + HTMX + TypeScript)

**Проект:** Family Budget - Full-Stack Web App (FastAPI 0.121.2 | PostgreSQL 16 | python-telegram-bot 21.10 | Docker Compose)

---

## Задачи

[User input]

**CORE REQUIREMENTS:**

1. **Git Branch [MANDATORY]:**
   - YOU MUST execute PHASE 1.5 (branch creation) BEFORE approval (PHASE 2)
   - Use Skill tool to invoke: `git-workflow` with `mode=create-branch`
   - Branch pattern: "dev/<task_name>_<YYYYMMDDhhmmss>" (auto-generated by structured-planning)
   - Base branch: test
   - Applies to ALL complexity levels (minimal/standard/complex)
2. **Pre-flight:** Изучить `/docs/architecture` перед началом изменений
3. **Logging:** Всегда добавлять полное логирование (frontend/backend)
4. **Best practices:** Применять эффективные паттерны разработки. Использовать LSP plugin при работе с TypeScript/Python (см. @skill:lsp-integration)
5. **Clarification:** При планировании задавать уточняющие вопросы
6. **Documentation:** Актуализировать `/docs/architecture` после изменений
7. **Progress Tracking:** Для non-trivial tasks использовать TaskCreate/TaskUpdate для visibility и recovery

---

## Execution Flow

### High-Level Orchestration

```
PHASE 0 → Context & Complexity Assessment
   @skill:context-awareness → {project_context}
   @skill:lsp-integration → {lsp_status} [for TypeScript/Python]
      ├─ TypeScript LSP: Type checking, go-to-definition
      └─ Python LSP (pyright): Type hints, async/await validation
   @skill:context7-integration → {library_docs}
   @skill:adaptive-workflow → {complexity, workflow_mode}
      ├─ minimal: Single endpoint, simple UI component
      ├─ standard: Feature with frontend+backend+tests
      ├─ complex: Multi-module features, database migrations, architecture changes
      └─ v2.0.0: Auto-triggers @skill:task-decomposition for complex tasks

PHASE 1 → Analysis & Planning
   @skill:thinking-framework → COT reasoning
   @skill:structured-planning → {task_plan}

   📋 Task Creation [for non-trivial tasks]
      ├─ Use TaskCreate for each execution step from plan
      ├─ Set subject (imperative), description, activeForm (present continuous)
      └─ Track progress: TaskUpdate → in_progress/completed

🔀 PHASE 1.5 → Git Branch Setup [MANDATORY]
   ⚠️ CHECKPOINT: Execute BEFORE approval
   @skill:git-workflow [mode: create-branch]
   → Input: {branch_name, base_branch: test}
   → Output: {git_branch_result}
   → Validate: git_branch_result.switched === true

PHASE 2 → Approval [conditional: skip if minimal]
   @skill:approval-gates → {user_approval}
      └─ User approves plan knowing branch is created

PHASE 3 → Execution [mode selected by adaptive-workflow]
   Execute using domain skills (see Domain Skills section)
      ├─ ALL code changes happen on development branch (from PHASE 1.5)
      ├─ TaskUpdate → in_progress (перед началом каждого task)
      ├─ @skill:code-review → {review}
      ├─ @skill:error-handling
      ├─ @skill:rollback-recovery [on critical errors]
      └─ TaskUpdate → completed (после завершения task)

PHASE 4 → Validation
   Execute validation tests:
      ├─ Backend: pytest tests/ --cov=app
      ├─ Frontend: npm run test (TypeScript type check)
      ├─ Integration: docker-compose exec app pytest tests/integration/
      └─ Verify LSP diagnostics (if LSP enabled)

PHASE 5A → Git Commit & Push [MODIFIED]
   @skill:git-workflow [mode: commit-and-push] → {commit_result}
      ├─ Assume already on correct branch (created in PHASE 1.5)
      ├─ Stage files: git add app/ static/ tests/ docs/
      ├─ Commit with Conventional Commits format + Co-Authored-By
      ├─ Push to remote: git push -u origin dev/<task_name>_<timestamp>
      └─ NO branch creation (already done in PHASE 1.5)

PHASE 5B → PR Automation [Optional]
   @skill:pr-automation → {pr}

PHASE 5C → Documentation + Summary
   Update /docs/architecture
   @skill:git-workflow → @template:task-summary
```

---

## Skills Quick Reference

**Все детали реализации, templates, schemas, safety rules находятся в skills.**

### Task Management Tools

**Built-in Claude Code tools для progress tracking:**

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **TaskCreate** | Create task with subject, description, activeForm | PHASE 1 (после structured-planning для non-trivial tasks) |
| **TaskUpdate** | Update status (in_progress/completed) | PHASE 3 (перед началом и после завершения каждого task) |
| **TaskList** | View all tasks and progress | Проверка overall progress, поиск next task |
| **TaskGet** | Get full task details by ID | Получение context перед началом task |

**Criteria для использования:**
- ✅ Non-trivial tasks (>= 3 execution steps)
- ✅ Complex tasks requiring multiple phases
- ✅ Tasks где user хочет видеть progress
- ❌ Trivial one-step tasks

### Workflow Skills (Universal)

| Phase | Skill | Purpose | Details |
|-------|-------|---------|---------|
| 0 | context-awareness | Detect project context | См. skill |
| 0 | adaptive-workflow v2.0.0 | Determine complexity + task-decomposition | См. skill |
| 0 | lsp-integration | LSP integration [optional] | См. skill |
| 0 | context7-integration | Library docs [optional] | См. skill |
| 1 | thinking-framework | COT reasoning (3 templates) | См. skill |
| 1 | structured-planning v2.2.0 | Task plan + skill/prd-generator | См. skill |
| 2 | approval-gates | User approval [conditional] | См. skill |
| 3 | code-review | Quality + security checks | См. skill |
| 3 | error-handling | Failure handling | См. skill |
| 3 | rollback-recovery | Critical error rollback | См. skill |
| 4 | git-workflow | Branch, commit, summary | См. skill |
| 4 | pr-automation | PR + CI/CD + auto-fix | См. skill |

### Domain Skills (Family Budget-Specific)

**Note:** Domain skills определяются в проектной директории `.claude/skills/`

**Backend Development:**

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **api-development** | REST API endpoint creation with SCD Type 2 + Shared Budget | Adding/modifying API routes |
| **authentication-security** | JWT auth, Telegram OAuth, security middleware | Auth features, security updates |
| **bot-development** | Telegram bot commands and handlers | Bot functionality changes |
| **db-management** | Database migrations, SCD Type 2, Closure Table patterns | Database schema changes |

**Frontend Development:**

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **frontend-development** | HTMX + Tailwind + DaisyUI + WebSocket components | UI components, pages |
| **websocket-realtime** | WebSocket real-time updates, SSE broadcasting, event buffering | Real-time features |

**Patterns:**

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **advanced-patterns** | SCD Type 2, Closure Table, Shared Family Budget patterns | Complex DB operations, transfers |

**Список для проекта:** См. project CLAUDE.md и `.claude/skills/*/SKILL.md` для детальной документации

---

## Key Principles

**SGR (Structured Generation & Reasoning):**
- Thinking → Structured Output → Execute → Validate → Commit

**Progress Tracking:**
- Non-trivial tasks создают tasks via TaskCreate (PHASE 1)
- Each task marked as in_progress перед началом (PHASE 3)
- Each task marked as completed после завершения (PHASE 3)
- User видит progress via `/tasks` command

**Adaptive Workflow:**
- Complexity определяет workflow mode (см. @skill:adaptive-workflow)
- Auto-skip unnecessary phases
- Lazy loading skills

**Separation of Concerns:**
- **Template** = Orchestration flow только
- **Skills** = Вся реализационная логика, templates, schemas, safety rules
- **Project CLAUDE.md** = Project-specific commands, patterns, conventions

**Data Flow:**
- PHASE N output → PHASE N+1 input
- Structured artifacts между phases
- Dependencies: см. individual skills

---
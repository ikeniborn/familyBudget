# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

**NEVER**: 
- Edit CLAUDE.md. Only user can add or delete tgis file.
- Delete volume docker. Only after approve user.

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

## Core Rules

**1. Multi-Perspective Analysis**

При решении любой задачи рассматривай проблему с точки зрения:
- **Системный архитектор**: Инфраструктурные решения, масштабируемость, отказоустойчивость
- **Frontend разработчик**: UX/UI эффективность, производительность клиента, доступность
- **Backend разработчик**: Оптимальная обработка данных, нагрузка на ресурсы, эффективность API
- **Security специалист**: Потенциальные уязвимости, защита данных, соответствие best practices
- **Технический писатель**: Актуальность и корректность документации, синхронизация с кодом

**2. Validation Loop**

После разработки решения:
- Проводить повторную проверку архитектурных решений
- Верифицировать соответствие требованиям из всех перспектив
- Задавать уточнющие вопросы на этапе анализа и планирования

## Quick Start

### Local Development & Testing

**Automated Testing (Recommended):** Use `@skill:test-code` in PHASE 4 of Execution Flow for automatic test selection and execution based on git diff.

**Manual Testing (for local debugging only):**
- Virtual environment required: `backend/.venv/`
- Install dependencies: `backend/.venv/bin/pip install -r requirements-dev.txt -r requirements.txt`

### Local Testing Setup

**Automated Testing (Recommended):**
- `@skill:test-code` automatically selects and runs appropriate tests based on git diff
- Executes pytest (backend), TypeScript checks (frontend), Playwright (e2e)
- Handles test environment setup and teardown

**Manual Testing (for debugging):**
```bash
# Run all tests
./tests/run-tests.sh all

# Run specific test suite
./tests/run-tests.sh backend   # Backend pytest tests
./tests/run-tests.sh frontend  # TypeScript type checking
./tests/run-tests.sh e2e       # Playwright E2E tests
```

**Initial Setup (one-time):**
```bash
# Create virtual environment and install dependencies
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt -r requirements.txt

# Start test database
docker-compose -f docker-compose-test.yml up -d

# Apply migrations
DATABASE_URL="postgresql://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/alembic -c backend/db/migrations/alembic.ini upgrade head
```

**Test Dependencies:** pytest 8.3.4, pytest-asyncio 0.24.0, pytest-cov 6.0.0, pytest-xdist 3.6.1, httpx 0.28.1, black 24.10.0, ruff 0.8.4

**Test Organization:** `tests/api/` (API tests), `tests/services/` (business logic), `tests/integration/` (DB-dependent)

**Important:**
- ❌ DO NOT run services locally (uvicorn, docker compose up)
- ✅ Tests use test PostgreSQL database (docker-compose-test.yml)
- ✅ Frontend/Docker builds happen in CI/CD (GitHub Actions)

### E2E Testing (Playwright)

**Automated Testing (Recommended):**
- `@skill:test-code` automatically runs E2E tests when frontend changes are detected
- Uses Playwright with 6 browser configurations (chromium, firefox, webkit, mobile)

**Manual Testing (for debugging):**

**Prerequisites:**
```bash
npx playwright install
cat > .env.test << 'EOF'
TEST_USER_EMAIL=e2e-test@example.com
TEST_USER_PASSWORD=E2eTestPassword123!
BASE_URL=https://fbd.ikeniborn.ru
EOF
```

**Run Tests:**
```bash
npm run test:e2e              # All tests (6 browsers)
npm run test:e2e:chromium     # Specific browser
npm run test:e2e:ui           # Interactive UI mode (best for development)
npm run test:e2e:headed       # Headed mode (see browser)
```

**E2E Test Suites (10 files):**
- Basic: loading, form submission, mobile navigation, modal responsive
- Features: offline functionality, recurring plans, shopping lists, transfers, CSV import
- Visual: regression testing (4 components)

**Configuration:**
- Config: `config/playwright.config.ts`
- Tests: `tests/e2e/webapp/`
- Reports: `playwright-report/`
- Runtime: ~5-6 minutes (10 tests × 6 browsers)

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production** | https://fb.ikeniborn.ru/ | Live users |
| **Development** | https://fbd.ikeniborn.ru/ | Feature testing |

- For analysis logs connect to test server via "ssh budget-test".
- Work directory "/opt/budget"
- Git directory "~/familyBudget"

## Documentation Index

**Primary source of truth.** Always check docs before implementation.

### Architecture (Core Concepts)

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [README.md](docs/architecture/README.md) | Dependency graph, recent changes | Start of any task |
| [authentication.md](docs/architecture/core/authentication.md) | JWT, OAuth, WebAuthn | Auth implementation |
| [pwa.md](docs/architecture/core/pwa.md) | PWA, offline, Service Worker | Offline sync, caching |
| **[dexie-integration.md](docs/architecture/core/dexie-integration.md)** | **Dexie.js offline mode (v11.0+)** | **Offline CRUD, cents conversion** |
| [websocket.md](docs/architecture/core/websocket.md) | Real-time updates, Redis Pub/Sub | WebSocket features |
| [build-system.md](docs/architecture/core/build-system.md) | Build pipeline, TypeScript, Vite | Build issues, module errors |
| [es-modules-migration.md](docs/architecture/migrations/es-modules-migration.md) | ES Modules migration (v7.0.0) | Module system changes |

### Database & Backend

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [database/](docs/architecture/backend/database/) | Schema, SCD Type 2, Closure Table | DB schema changes |
| [endpoints/](docs/architecture/backend/endpoints/) | API documentation | API development |
| [transfers-system.md](docs/architecture/features/transfers-system.md) | Transfer deduplication | Transfer operations |
| [recurring-plans.md](docs/architecture/features/recurring-plans.md) | Recurring payments (MMDD encoding) | Recurring plans |

### Frontend

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [frontend/responsive-design.md](docs/architecture/frontend/responsive-design.md) | Responsive, iOS Safari quirks | UI bugs, mobile issues |
| [frontend/z-index-layering.md](docs/architecture/frontend/z-index-layering.md) | Z-Index hierarchy (13 layers) | Overlay conflicts |
| [frontend/modal-architecture.md](docs/architecture/frontend/modal-architecture.md) | Tab-based modals (v10.x+) | Modal implementation |

### Deployment & Operations

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [ci-cd-build-deploy.md](docs/architecture/operations/ci-cd-build-deploy.md) | CI/CD Pipeline v2.0 | CI/CD troubleshooting |
| [docker.md](docs/architecture/core/docker.md) | Docker multi-stage builds (5 images) | Docker issues |
| [deployment-troubleshooting.md](docs/architecture/operations/deployment-troubleshooting.md) | Deployment issues | Deploy failures |
| [disaster-recovery.md](docs/architecture/operations/disaster-recovery.md) | Disaster recovery | Critical failures |
| [backup-operations.md](docs/architecture/operations/backup-operations.md) | Backup procedures | Backup/restore tasks |

### Features & Optimization

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [notifications.md](docs/architecture/features/notifications.md) | Web Push + Telegram | Notifications |
| [bulk-delete-optimization.md](docs/architecture/features/bulk-delete-optimization.md) | Bulk operations, WebSocket summary | Bulk delete |
| [caching-strategy.md](docs/architecture/optimization/caching-strategy.md) | HTTP caching | Performance |
| [backup-system.md](docs/architecture/features/backup-system.md) | Backup + restore | Backup system |
| [installation-resilience.md](docs/architecture/optimization/installation-resilience.md) | Installation framework | Installation issues |

### Product & User Guides

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [docs/prd/](docs/prd/) | Product requirements | Feature planning |

### Plans

Результаты работы агента по планированию сохраняй всегда в docs/plans/

---

## Execution Flow

```
PHASE 0 → Context & Complexity Assessment
   @skill:context-awareness → {project_context}
   @skill:doc-explorer → {documentation_context}
      → Interactive documentation exploration with guided tours
      → Helps understand project architecture before implementation
   @skill:lsp-integration → {lsp_status} [optional]
   @skill:context7-integration → {library_docs} [optional]
   @skill:adaptive-workflow → {complexity, workflow_mode, skip[], required[]}

PHASE 1 → Analysis & Planning
   @skill:thinking-framework → COT reasoning
   @skill:structured-planning → {task_plan}
   @skill:plan-validation → {plan_validation_result}
      → Validates plan BEFORE execution (4-level validation)
      → BLOCKS approval if blocking_issues detected

   TaskCreate [for non-trivial tasks]

PHASE 1.5 → Pre-Approval Actions [MANDATORY]
   ⚠️ Execute BEFORE approval

   IF plan_validation_result.passed == false:
      BLOCK execution, show blocking_issues, require fixes

   @skill:git-workflow [mode: create-branch]
   → Input: {branch_name, base_branch}
   → Output: {git_branch_result.switched === true}

PHASE 2 → Approval [conditional: skip if minimal]
   @skill:approval-gates → {user_approval}
      → Reads plan_validation_result (blocks if failed)

PHASE 3 → Execution
   Domain skills execution
   @skill:code-review
   @skill:error-handling [on recoverable errors]
   @skill:rollback-recovery [on critical failures]

   TaskUpdate: pending → in_progress → completed

PHASE 4 → Post-Execution Validation
   @skill:validation-framework → {validation_results}
      → Validates execution results (acceptance criteria, tests, completion)
      → Triggers error-handling if validation fails

   @skill:test-code → {test_results} [adaptive, based on git diff]
      → Automatic test selection: syntax, quality, runtime, dependencies, e2e
      → Runs pytest (backend), TypeScript checks (frontend), Playwright (e2e)
      → Triggers error-handling if tests fail

PHASE 5A → Git Commit & Push
   @skill:git-workflow [mode: commit-and-push] → {commit_result}

PHASE 5B → Documentation Sync [conditional: if code or docs changed]
   @skill:doc-sync → {sync_result}
      → Detects outdated documentation by comparing code changes
      → Generates documentation updates (LSP integration for API changes)
      → BLOCKS commit if critical documentation drift detected

   @skill:architecture-documentation → {arch_docs} [optional]
      → Generates YAML/TOON architectural documentation
      → Creates component dependency diagrams

PHASE 5C → PR Automation [optional]
   @skill:pr-automation → {pr_result}

PHASE 5D → Task Summary
   @skill:git-workflow → @template:task-summary
```
## Key Principles

**SGR (Structured Generation & Reasoning):**
- Thinking → Structured Output → Execute → Validate → Commit

**Progress Tracking:**
- task_plan (static blueprint) - created in PHASE 1
- TaskCreate (dynamic tracking) - updated in PHASE 3

**Data Flow:**
- PHASE N output → PHASE N+1 input

**Git requests**
- Only create requets to test branch from dev/* branches 
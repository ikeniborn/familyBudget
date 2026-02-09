# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

!**NEVER** edit CLAUDE.md. Only user can add or delete tgis file.

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
**CRITICAL:** НЕ запускайте сервисы локально (`uvicorn`, `docker compose up`). Тестирование выполняется локально через pytest в виртуальном окружении.

**BREAKING CHANGE (v9.0):**
- All builds (frontend, Docker) happen in GitHub Actions CI/CD
- Server only pulls ready images from ghcr.io (registry-first)
- npm/Node.js NOT required on server
- Manual VERSION bump before push
- Never update manual package.json or package-lock.json. Updated in GitHub Actions CI/CD
- Fixed GitHub Actions deployment hang on port conflict check (non-interactive mode support)
- Fixed Alembic migrations for distroless runtime (use python -m alembic instead of bash)
- Fixed distroless ENTRYPOINT to use venv python (uvicorn module not found error)
- Fixed ENTRYPOINT and HEALTHCHECK to use python3.11 explicitly (symlink 'python' not available in distroless venv)
- Fixed venv creation with --copies flag (symlinks broken when COPY to distroless)
- Added libpython3.11.so.1.0 shared library copy to distroless runtime (required by --copies venv binary)
- Use distroless system Python + PYTHONPATH instead of venv binary (simpler, no symlink/shared library issues)
- Added missing httpx dependency (removed in v11.2.3 optimization, but still used by 5 services)

**BREAKING CHANGE (v11.4.12):**
- Tests removed from CI/CD pipeline → run locally via pytest
- Virtual environment required: `backend/.venv/`
- Install dependencies: `backend/.venv/bin/pip install -r requirements-dev.txt -r requirements.txt`

### Local Testing Setup

**Quick Start (Recommended):**
```bash
# Run all tests (backend + frontend + e2e)
./tests/run-tests.sh all

# Run specific test suite
./tests/run-tests.sh backend   # Backend pytest tests
./tests/run-tests.sh frontend  # TypeScript type checking
./tests/run-tests.sh e2e       # Playwright E2E tests
```

**1. Initial Setup (one-time):**
```bash
# Create virtual environment
cd backend
python3 -m venv .venv

# Install dependencies
.venv/bin/pip install -r requirements-dev.txt -r requirements.txt
```

**2. Run Tests:**
```bash
# Start test database first
docker-compose -f docker-compose-test.yml up -d

# Wait for database to be ready
until docker exec familybudget-postgres-test pg_isready -U familybudget 2>/dev/null; do
  echo "Waiting for PostgreSQL..."; sleep 1
done

# Apply migrations (first time only or after schema changes)
DATABASE_URL="postgresql://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/alembic -c backend/db/migrations/alembic.ini upgrade head

# Load test environment variables and run tests
set -a && source backend/.env.test && set +a && \
PYTHONPATH=$PWD backend/.venv/bin/pytest backend/tests/ -v

# Specific test file
PYTHONPATH=$PWD backend/.venv/bin/pytest backend/tests/api/test_recurring_plans_date_validation.py -v

# With coverage
PYTHONPATH=$PWD backend/.venv/bin/pytest backend/tests/ --cov=app --cov-report=term-missing

# Parallel execution (faster)
PYTHONPATH=$PWD backend/.venv/bin/pytest backend/tests/ -n auto

# Stop test database
docker-compose -f docker-compose-test.yml down
```

**3. Available Test Dependencies:**
- `pytest==8.3.4` - Testing framework
- `pytest-asyncio==0.24.0` - Async test support
- `pytest-cov==6.0.0` - Coverage reports
- `pytest-xdist==3.6.1` - Parallel test execution
- `httpx==0.28.1` - HTTP client for API tests
- `black==24.10.0` - Code formatter
- `ruff==0.8.4` - Linter

**4. Test Organization:**
- `tests/api/` - API endpoint tests
- `tests/services/` - Business logic tests
- `tests/integration/` - Integration tests (require DB)
- `tests/conftest.py` - Shared fixtures

**5. IMPORTANT:**
- ❌ DO NOT run services locally (uvicorn, docker compose up)
- ✅ Tests use test PostgreSQL database (docker-compose-test.yml)
- ✅ Frontend builds still happen in CI/CD (GitHub Actions)
- ✅ Docker builds still happen in CI/CD

### E2E Testing (Playwright)

**1. Prerequisites:**
```bash
# Install Playwright browsers (first time only)
npx playwright install

# Create test user credentials (see docs/testing/e2e-test-user-setup.md)
cat > .env.test << 'EOF'
TEST_USER_EMAIL=e2e-test@example.com
TEST_USER_PASSWORD=E2eTestPassword123!
BASE_URL=https://fbd.ikeniborn.ru
EOF
chmod 600 .env.test
```

**2. E2E Test Suites (10 files):**
- `test_webapp_loading.spec.ts` - Basic page loading and rendering
- `test_form_submission.spec.ts` - Form validation and submission flows
- `test_mobile_navigation.spec.ts` - Mobile responsive navigation
- `test_modal_responsive.spec.ts` - Modal behavior across devices
- `test_offline_functionality.spec.ts` - Offline mode and sync
- `test_recurring_plans.spec.ts` - Recurring payment plans
- `test_shopping_lists.spec.ts` - Shopping list CRUD operations
- `test_transfers.spec.ts` - Transfer creation and deduplication
- `test_csv_import.spec.ts` - CSV import workflows
- `test_visual_regression.spec.ts` - Visual regression testing (4 components)

**3. Run E2E Tests:**
```bash
# All tests (6 browsers: chromium, firefox, webkit, mobile chrome, mobile safari, tablet)
npm run test:e2e

# Specific browser
npm run test:e2e:chromium

# Interactive UI mode (best for development)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through tests)
npm run test:e2e:debug

# View HTML report
npm run test:e2e:report

# Generate tests via recording
npm run test:e2e:codegen
```

**4. E2E Test Configuration:**
- **Config:** `config/playwright.config.ts`
- **Test Directory:** `tests/e2e/webapp/`
- **Auth Storage:** `tests/e2e/.auth/user.json` (auto-generated)
- **Reports:** `playwright-report/` (HTML reports)
- **Screenshots:** Auto-captured on failure
- **Videos:** Retained on failure only

**5. Local vs Remote Testing:**
```bash
# Test against remote test server (default)
BASE_URL=https://fbd.ikeniborn.ru npm run test:e2e

# Test against local docker compose (NOT recommended per CLAUDE.md rules)
# BASE_URL=http://localhost:8000 npm run test:e2e
```

**6. Visual Regression Tests:**
- 4 critical UI components tested for visual changes
- Snapshots stored in `tests/e2e/webapp/test_visual_regression.spec.ts-snapshots/`
- Update snapshots: `npm run test:e2e -- --update-snapshots`

**7. Known Limitations:**
- E2E tests require deployed application (fbd.ikeniborn.ru)
- Test user must be created manually (see docs/testing/e2e-test-user-setup.md)
- Visual regression tests are browser-specific (chromium snapshots)
- ~5-6 minutes for full test suite (10 tests × 6 browsers)

### Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Production** | https://fb.ikeniborn.ru/ | Live users |
| **Development** | https://fbd.ikeniborn.ru/ | Feature testing |

For analysis logs connect to test server via "ssh budget-test".
Work directory "/opt/budget"
Git directory "~/familyBudget"

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

**Testing & Validation:**

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| **test-code** | Comprehensive testing framework (7-stage pipeline: syntax, quality, runtime, deps, e2e) | PHASE 4 (Validation) перед git commit |

**Key features:**
- ✅ Adaptive testing на основе git diff (backend → pytest+e2e, frontend → vitest+e2e)
- ✅ Interactive auto-fix proposals (syntax, linting, type-checking, known-failing-tests)
- ✅ TOON format для >= 5 test results (40-50% token savings)
- ✅ E2E tests всегда запускаются (Playwright: 8 tests × 6 browsers, ~5-6 min)
- ✅ Known failing tests detection (28 tests в conftest.py) + auto-fix proposals
- ✅ Coverage thresholds: Backend 30%, Frontend 4-60%

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
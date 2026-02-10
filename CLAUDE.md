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
**CRITICAL:** Для тестирования использовать E2E тестирование, pytest, unicorn, docker. 
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

### Plans

Результаты работы агента по планированию сохраняй всегда в docs/plans/

---

## Общие навыки 

@skill:context-awareness для изучаения проекта
@skill:thinking-framework для размышлений
@skill:structured-planning → для планированя
@skill:code-review для ревью кода 


# CI/CD Pipeline - GitHub Actions

**Дата создания**: 2026-01-14
**Версия**: 1.0
**Статус**: Active

## Обзор

Family Budget использует GitHub Actions для автоматизации тестирования, валидации и проверки качества кода в pull requests. CI/CD pipeline состоит из 8 workflows, покрывающих frontend, backend, E2E, security и accessibility тестирование.

## Список Workflows

### Активные Workflows (8 total)

| Workflow | Trigger | Длительность | Status Checks |
|----------|---------|--------------|---------------|
| **Frontend Tests** | push/PR на main, test, feature/*, fix/* | 3-5 мин | type-check, unit-tests, build-check, lint |
| **TypeScript Check** | push/PR на main, test, develop | 2-3 мин | typescript-errors (non-blocking) |
| **Backend Tests** | push/PR на main, test, feature/*, fix/* | 2-4 мин | backend-unit-integration, bot-tests |
| **E2E Tests** | push/PR, manual | 8-12 мин | e2e-tests (chromium, firefox, webkit) |
| **API Contract Tests** | push/PR на main, test, feature/*, fix/* | 2-3 мин | openapi-validation, typescript-types-validation |
| **Security Scan** | push/PR, daily 3 AM UTC | 3-5 мин | dependency-scan, sast-scan, secrets-scan |
| **Accessibility Tests** | push/PR на main, test, feature/*, fix/* | 4-6 мин | axe-core-tests |
| **Release Drafter** | ❌ УДАЛЁН (legacy) | - | - |

**Total execution time** (parallel): ~12-15 минут (ограничено slowest job: E2E tests)

---

## Detailed Workflow Описания

### 1. Frontend Tests (`frontend-tests.yml`)

**Purpose**: Проверка TypeScript типов, unit/integration тестов (Vitest), сборки и linting.

**Trigger**:
```yaml
on:
  push:
    branches: [main, test, feature/*, fix/*]
    paths: [frontend/**, vitest.config.ts, tsconfig.json, ...]
  pull_request:
    branches: [main, test]
```

**Jobs** (4 parallel):
1. **Type Check**
   - `npm run type-check`
   - Блокирует PR при ошибках TypeScript

2. **Unit & Integration Tests**
   - Vitest (802 tests)
   - Coverage threshold: 5.9% lines (lowered due to legacy monoliths)
   - Upload coverage to Codecov

3. **Build Check**
   - `npm run build:css` + `npm run bundle`
   - Проверяет успешность сборки
   - Проверяет размер bundle (max 500KB)

4. **Lint & Format**
   - Обнаружение `console.log` в production коде
   - ESLint validation

**Artifacts**:
- Coverage reports (HTML/JSON/LCOV)
- Build output

**Coverage Targets**:
- Lines: 5.9%
- Functions: 84%
- Branches: 86%
- Statements: 5.9%

---

### 2. TypeScript Check (`typescript-check.yml`)

**Purpose**: Детальный анализ TypeScript ошибок с breakdown по типу и файлу.

**Trigger**: push/PR на main, test, develop

**Features**:
- Non-blocking (continue-on-error: true)
- Error breakdown в GitHub Step Summary
- Отчет сгруппирован по типу ошибки (TS2322, TS2304, etc.)

**Output Example**:
```
## TypeScript Errors (12 total)
- TS2322: Type mismatch (5 errors)
- TS2304: Cannot find name (3 errors)
- TS2345: Argument type mismatch (4 errors)
```

---

### 3. Backend Tests (`backend-tests.yml`)

**Purpose**: Backend pytest (34 test files) + Bot pytest (4 test files) с coverage validation.

**Trigger**:
```yaml
on:
  push:
    branches: [main, test, feature/*, fix/*]
    paths: [backend/**, bot/**, pytest.ini, requirements.txt]
  pull_request:
    branches: [main, test]
```

**Services**:
- PostgreSQL 16 (test DB)
- Redis 7 (Pub/Sub)

**Jobs** (2 parallel):

1. **Backend Unit & Integration Tests**
   - pytest с coverage
   - Coverage threshold: **70% lines**
   - Exclude e2e marker
   - Upload to Codecov
   - Artifacts: HTML coverage report

2. **Bot Tests**
   - pytest для telegram bot
   - No coverage requirement (пока)
   - Artifacts: JUnit XML report

**Environment Variables**:
```yaml
DATABASE_URL: postgresql+asyncpg://familybudget:test_password@localhost:5432/familybudget_test
REDIS_ENABLED: true
JWT_SECRET: test_jwt_secret_for_ci_only
SECRET_KEY: test_secret_key_for_ci_only
```

---

### 4. E2E Tests (`e2e-tests.yml`)

**Purpose**: Playwright E2E тесты для critical user paths на 3 browsers.

**Trigger**: push/PR + workflow_dispatch (manual)

**Strategy**: Matrix
- chromium
- firefox
- webkit

**Services**: PostgreSQL 16 + Redis 7

**Workflow Steps**:
1. Setup Node.js 18 + Python 3.12
2. Install dependencies (npm ci, pip install)
3. Build frontend (CSS + JS bundles)
4. Install Playwright browsers (per matrix)
5. Run migrations
6. Start backend server (background with health check)
7. Run Playwright tests (`--project=${{ matrix.browser }}`)
8. Upload artifacts (reports, screenshots, videos)

**Artifacts** (on failure):
- HTML reports (all browsers)
- Screenshots (failure only)
- Videos (failure only)

**Retention**: 7 days

**Critical User Paths** (to be implemented):
- Authentication Flow: Login → 2FA → Dashboard
- Transaction Creation: Dashboard → Add → Verify
- Budget Analytics: Dashboard → Charts
- Shopping List: CRUD + offline sync
- Admin Operations: CSV import
- Offline Mode: Service Worker → Sync

---

### 5. API Contract Tests (`api-contract-tests.yml`)

**Purpose**: OpenAPI validation + TypeScript types consistency.

**Trigger**:
```yaml
on:
  push:
    paths: [backend/app/api/**, backend/app/models/**, docs/architecture/endpoints/**]
  pull_request:
    branches: [main, test]
```

**Jobs** (2 sequential):

1. **OpenAPI Validation**
   - Generate current OpenAPI spec (`curl /openapi.json`)
   - Validate spec (`openapi-generator-cli validate`)
   - **PR only**: Compare with previous commit
   - Detect breaking changes (`openapi-diff`)
   - Upload specs as artifacts (30 days)

2. **TypeScript Types Validation**
   - Generate TypeScript types (`openapi-typescript`)
   - Compare with committed version
   - Warn if out of sync

**Breaking Changes Detection**:
- Non-blocking (warning only)
- Report в GitHub Step Summary
- Рекомендация обновить CHANGELOG

**Benefits**:
- Prevents breaking API changes без явного указания
- Ensures frontend types match backend schema
- Catches runtime errors before deployment

---

### 6. Security Scan (`security-scan.yml`)

**Purpose**: SAST + dependency vulnerabilities + secrets detection.

**Trigger**: push/PR + daily schedule (3 AM UTC)

**Jobs** (3 parallel):

1. **Dependency Scan**
   - `npm audit` (npm packages)
   - `safety check` (Python packages)
   - **FAIL if critical vulns > 0** (npm)
   - **WARN if vulns found** (Python)

2. **SAST Scan**
   - Bandit (Python SAST)
     - Level: high
     - Confidence: high
     - Upload SARIF to GitHub Code Scanning
   - ESLint security plugin (frontend)
     - XSS, eval usage, unsafe regex detection

3. **Secrets Scan**
   - TruffleHog (verified secrets only)
   - Gitleaks (git history scanning)
   - **FAIL if secrets detected**

**Vulnerability Types Detected**:
- SQL injection
- Hardcoded secrets/API keys
- XSS vulnerabilities
- Known CVEs in dependencies
- Unsafe crypto usage

**Artifacts**: scan results JSON (30 days retention)

---

### 7. Accessibility Tests (`accessibility-tests.yml`)

**Purpose**: WCAG 2.1 AA compliance validation using axe-core.

**Trigger**:
```yaml
on:
  push:
    paths: [frontend/**/*.html, frontend/**/*.ts, tests/a11y/**]
  pull_request:
    branches: [main, test]
```

**Tool**: @axe-core/playwright

**Workflow**:
1. Setup Node.js + Python
2. Install dependencies + @axe-core/playwright
3. Build frontend
4. Install Playwright (chromium only)
5. Run migrations + start backend
6. Run a11y tests (`tests/a11y/`)
7. Check violation thresholds

**Thresholds**:
- **FAIL if critical violations > 0**
- **WARN if serious violations > 5**

**WCAG Standards**: 2.1 AA (wcag2a, wcag2aa, wcag21a, wcag21aa)

**Checks**:
- Color contrast (4.5:1)
- Keyboard navigation
- ARIA labels
- Focus management
- Screen reader compatibility
- Form validation messages

**Artifacts**: HTML/JSON reports (30 days)

---

## Required Status Checks для PR Merge

### Обязательные Checks (8 total)

**Frontend**:
- ✅ Frontend Tests / type-check
- ✅ Frontend Tests / unit-tests
- ✅ Frontend Tests / build-check
- ✅ Frontend Tests / lint

**Backend**:
- ✅ Backend Tests / backend-unit-integration
- ✅ Backend Tests / bot-tests

**E2E**:
- ✅ E2E Tests / e2e-tests (chromium)

**API Contract**:
- ✅ API Contract Tests / openapi-validation

### Warning-Only Checks (не блокируют PR)

- ⚠️ TypeScript Check / typescript-errors
- ⚠️ Security Scan / dependency-scan
- ⚠️ Security Scan / sast-scan
- ⚠️ Security Scan / secrets-scan
- ⚠️ Accessibility Tests / axe-core-tests

---

## Coverage Thresholds

| Component | Tool | Threshold | Current |
|-----------|------|-----------|---------|
| **Frontend** | Vitest | 5.9% lines | 5.9% ✅ |
| **Frontend** | Vitest | 84% functions | ~84% ✅ |
| **Frontend** | Vitest | 86% branches | ~86% ✅ |
| **Backend** | pytest | 70% lines | TBD |
| **Bot** | pytest | None (TBD) | TBD |

**Примечание**: Frontend coverage снижен с 8.9% до 5.9% из-за legacy monoliths (~9,600 lines untested code).

---

## Execution Strategy (Parallel/Sequential)

### Parallel Execution (Stage 1)
```
Frontend Tests ─┐
Backend Tests  ─┼─> All run in parallel
TypeScript Check─┘
```

### Parallel Execution (Stage 2)
```
E2E Tests (3 browsers) ─┐
API Contract Tests      ├─> All run in parallel
Security Scan (3 jobs)  ─┘
```

### Parallel Execution (Stage 3)
```
Accessibility Tests
```

**Total**: ~12-15 минут (limited by E2E tests на 3 browsers)

---

## Artifacts Retention Policies

| Artifact Type | Retention | Size |
|---------------|-----------|------|
| Coverage reports (frontend) | 7 days | ~5 MB |
| Coverage reports (backend) | 7 days | ~2 MB |
| Playwright reports | 7 days | ~10 MB |
| Playwright screenshots | 7 days | ~20 MB |
| Playwright videos | 7 days | ~50 MB |
| OpenAPI specs | 30 days | ~1 MB |
| Security scan results | 30 days | ~2 MB |
| A11y reports | 30 days | ~5 MB |

---

## Troubleshooting Guide

### Common Issues

**1. PostgreSQL service startup failure**

```
Error: could not connect to server: Connection refused
```

**Solution**: Проверить health checks в workflow (10s interval, 5 retries).

---

**2. Playwright browser installation timeout**

```
Error: browserType.launch: Timeout 30000ms exceeded
```

**Solution**:
- Увеличить timeout до 30 min
- Cache browsers между runs
- Использовать `--with-deps` для установки system dependencies

---

**3. Backend coverage < 70% threshold**

```
Error: Backend coverage 65.3% is below 70.0% threshold
```

**Solution**:
- Добавить больше unit tests
- Временно снизить threshold до 60% (если критично)
- Исключить legacy code из coverage (`--cov-config`)

---

**4. E2E tests flakiness**

```
Error: Timeout 30000ms exceeded waiting for element
```

**Solution**:
- Добавить retries в `playwright.config.ts` (retries: 2)
- Увеличить timeouts для slow elements
- Добавить explicit waits (`waitForSelector`)
- Проверить backend startup (health check)

---

**5. OpenAPI diff false positives**

```
Warning: Breaking API changes detected
```

**Solution**:
- Проверить что изменения действительно breaking
- Обновить CHANGELOG если breaking changes намеренные
- Non-blocking warnings не блокируют PR

---

**6. Security scan блокирует legacy code**

```
Error: Critical vulnerabilities found in npm dependencies
```

**Solution**:
- Обновить dependencies (`npm update`)
- Проверить security advisories (GitHub Security tab)
- Временно использовать `continue-on-error: true` (НЕ рекомендуется)

---

## Secrets и Environment Variables

### Required GitHub Secrets

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `CODECOV_TOKEN` | Upload coverage to Codecov | backend-tests.yml, frontend-tests.yml |
| `GITLEAKS_LICENSE` | Gitleaks Pro license | security-scan.yml |

**Fallback поведение**:
- `CODECOV_TOKEN` missing → fail_ci_if_error: false (не блокирует PR)
- `GITLEAKS_LICENSE` missing → Skip Gitleaks job

### Test Environment Variables

```yaml
# Database
DATABASE_URL: postgresql+asyncpg://familybudget:test_password@localhost:5432/familybudget_test
POSTGRES_HOST: localhost

# Redis
REDIS_ENABLED: true
REDIS_URL: redis://localhost:6379/0

# JWT
JWT_SECRET: test_jwt_secret_for_ci_only
SECRET_KEY: test_secret_key_for_ci_only

# Telegram Bot
TELEGRAM_BOT_TOKEN: test_token_for_ci_only
BACKEND_URL: http://localhost:8000

# Disable external services
ENABLE_WEB_PUSH: false
```

---

## Monitoring и Metrics

### Рекомендуемые Metrics

- Average workflow execution time (по каждому workflow)
- Success/failure rate (по каждому workflow)
- Coverage trends (frontend/backend)
- Security vulnerabilities detected over time
- A11y violations trends

### GitHub Actions Dashboard

Monitoring: https://github.com/<org>/<repo>/actions

Filters:
- By workflow name
- By branch
- By status (success/failure/cancelled)
- By actor (кто запустил)

---

## Future Enhancements

### Planned Improvements

1. **Visual Regression Testing**
   - Percy или Chromatic integration
   - Snapshot testing для UI components

2. **Load/Performance Testing**
   - k6 или Artillery для backend
   - Lighthouse CI для frontend performance

3. **Mobile E2E Tests**
   - Playwright mobile emulation (Mobile Chrome, Mobile Safari)
   - Real device testing (BrowserStack/Sauce Labs)

4. **Dependency Update Automation**
   - Renovate или Dependabot
   - Automated PR creation для updates

5. **Code Quality Gates**
   - SonarQube integration
   - Code smell detection
   - Maintainability index

---

## Related Documentation

- [Testing Infrastructure](./testing-infrastructure.md) - Vitest setup, test patterns
- [Testing Strategy](../prd/11-testing-strategy.md) - Overall testing approach
- [Deployment Guide](./guides/deployment-troubleshooting.md) - Deploy workflows
- [Architecture Overview](./README.md) - System architecture

---

**Last Updated**: 2026-01-14
**Maintainer**: Family Budget Team
**Version**: 1.0

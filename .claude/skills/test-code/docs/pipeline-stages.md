# 7-Stage Testing Pipeline

Полное описание всех стадий тестирования в навыке test-code.

---

## STAGE 0: Context Detection (Adaptive)

Анализирует git diff для определения категории изменений и выбора релевантных тестов.

### Алгоритм

```bash
# Git diff analysis
git diff --name-only HEAD | grep -E '^backend/' → BACKEND_CHANGED=true
git diff --name-only HEAD | grep -E '^frontend/' → FRONTEND_CHANGED=true
git diff --name-only HEAD | grep -E '^tests/e2e/' → E2E_CHANGED=true
git diff --name-only HEAD | grep -E 'package\.json|requirements\.txt' → DEPS_CHANGED=true
git diff --name-only HEAD | grep -E '\.github/workflows/' → CI_CHANGED=true
```

### Логика выбора тестов

- `backend_changed=true` → pytest + e2e (всегда)
- `frontend_changed=true` → vitest + type-check + e2e (всегда)
- `dependencies_changed=true` → lockfile validation + security audit
- `e2e_changed=true` → только e2e tests
- `ci_changed=true` → все тесты (критическая инфраструктура)

### Duration Estimates

- Backend only: 3-4 min (pytest) + 5-6 min (e2e) = 8-10 min
- Frontend only: 1-2 min (vitest + type-check) + 5-6 min (e2e) = 6-8 min
- Both: 4-5 min (pytest + vitest) + 5-6 min (e2e) = 9-11 min
- CI changes: 10-15 min (full test suite)

---

## STAGE 1: Syntax Validation

Проверка корректности синтаксиса без выполнения кода.

### Python

```bash
# Syntax check
python -m py_compile backend/app/**/*.py
find backend/ -name "*.py" -exec python -m py_compile {} \; 2>&1 | tee syntax-errors.log
```

### TypeScript

```bash
# Type check (no emit)
npx tsc --noEmit -p config/tsconfig.json 2>&1 | tee ts-errors.log
```

### JSON/YAML

```bash
# JSON validation
find . -name "*.json" ! -path "*/node_modules/*" -exec jq empty {} \; 2>&1 | tee json-errors.log

# YAML validation
yamllint -c .yamllint.yml docs/architecture/**/*.yaml
```

### Auto-fix Proposals

- **TypeScript:** "Found N syntax errors. Apply tsc --fix?"
- **Python:** Manual fix required (py_compile не поддерживает auto-fix)

---

## STAGE 2: Quality Checks (Linting + Type Checking)

Проверка code quality, стиля, типов.

### Backend (Python)

```bash
# Ruff linting
ruff check backend/ --output-format=json > ruff-results.json

# MyPy type checking (non-blocking)
mypy backend/ || true > mypy-results.log

# Black formatting check
black --check backend/ 2>&1 | tee black-results.log
```

### Frontend (TypeScript/JavaScript)

```bash
# ESLint
npm run lint -- --format json > eslint-results.json

# Check max warnings threshold (5000)
WARNINGS=$(jq '.[] | .warningCount' eslint-results.json | awk '{sum+=$1} END {print sum}')
if [ $WARNINGS -gt 5000 ]; then echo "ESLint warnings exceeded threshold"; fi
```

### Auto-fix Proposals

- **Ruff:** "Found N errors (M fixable). Apply ruff --fix?"
- **Black:** "Found formatting issues. Apply black formatting?"
- **ESLint:** "Found N warnings. Apply eslint --fix?"

---

## STAGE 3: Runtime Testing (Unit + Integration)

Запуск unit и integration тестов.

### Backend (pytest)

```bash
cd backend
pytest tests/ \
  --cov=app \
  --cov-report=json:coverage.json \
  --cov-report=term \
  -v \
  -m "not e2e" \
  --maxfail=5 \
  --tb=short \
  --json-report \
  --json-report-file=pytest-results.json
```

### Frontend (Vitest)

```bash
npm run test:coverage -- --reporter=json --outputFile=vitest-results.json
```

### Known Failing Tests Handling

- Анализ pytest-results.json → найти skipped tests
- Сравнение с conftest.py comments
- Предложение автоматического исправления:
  - "tests/models/test_article.py" → "Add is_current attribute to Article model?"
  - "tests/services/test_import_executor.py" → "Add parse_tinkoff_amount method?"

### Coverage Thresholds

- **Backend:** минимум 30.0% lines
- **Frontend:** минимум 4.0% lines, 32.0% functions

---

## STAGE 4: Dependency Validation

Проверка lockfile consistency и security vulnerabilities.

### Backend (Python)

```bash
# Lockfile consistency
pip freeze > installed-packages.txt
diff requirements.txt installed-packages.txt > pip-diff.log

# Security audit
pip-audit --format json > pip-audit-results.json || true
```

### Frontend (Node.js)

```bash
# Lockfile consistency
npm ci --dry-run 2>&1 | tee npm-ci-dryrun.log

# Security audit
npm audit --json > npm-audit-results.json || true

# Outdated packages
npm outdated --json > npm-outdated-results.json || true
```

---

## STAGE 5: E2E Testing (Playwright)

Запуск Playwright E2E тестов (всегда, согласно требованиям).

### Commands

```bash
npm run test:e2e -- --reporter=json > playwright-results.json
```

### Test Projects (все 6)

- **setup** (authentication)
- **chromium** (desktop)
- **firefox** (desktop)
- **webkit** (desktop Safari)
- **Mobile Chrome** (Pixel 5)
- **Mobile Safari** (iPhone 12)

### Duration

~5-6 минут для 8 тестов × 6 проектов

### Если Failures

- Показать screenshot/video paths
- Показать trace файлы
- Предложить `npm run test:e2e:debug` для интерактивной отладки

---

## STAGE 6: Result Analysis

Агрегирование результатов и предложение действий.

### Aggregate Results

- **Status:** passed | partial | failed
- **Total duration**
- **Critical issues** (blocking)
- **Warnings** (non-blocking)
- **Autofix proposals** (interactive)

### TOON Format (для >= 5 test results)

```toon
test_results[5]{stage,status,duration,errors,warnings}:
  syntax_validation,passed,12s,0,0
  quality_checks,failed,45s,3,5
  runtime_testing,partial,3m24s,0,28
  dependency_validation,warning,18s,0,2
  e2e_testing,passed,5m42s,0,0
```

**Token savings:** ~40-50% для больших test suites (20+ тестов)

---

## STAGE 7: Auto-fix Execution (Interactive)

Применение автоисправлений с подтверждением.

### Для каждой категории спрашивать

```
Category: Linting (ruff)
Issues: 3 errors (2 fixable)
Proposed fix: ruff check backend/ --fix

Apply fix? [Y/n]
```

### Workflow

1. Syntax errors → Auto-fix → Re-validate syntax
2. Linting errors → Auto-fix → Re-run quality checks
3. Known failing tests → Apply fixes → Re-run pytest
4. Security vulnerabilities → Show `npm audit fix` command (НЕ применять автоматически)

### Behavior on Failure

- Если auto-fix не решает проблему → показать manual fix instructions
- Если конфликт между fixes → sequential execution + re-validate

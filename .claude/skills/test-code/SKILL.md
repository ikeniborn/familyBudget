---
name: test-code
description: Автоматизация тестирования изменений (syntax, quality, runtime, dependencies, e2e) с адаптивным выбором тестов на основе git diff
version: 1.0.0
author: Family Budget Team
tags:
  - testing
  - validation
  - quality-assurance
  - automation
dependencies:
  - thinking-framework
  - context-awareness
  - error-handling
  - git-workflow
architecture_refs:
  - $ref: ../../docs/architecture/operations/deployment-troubleshooting.md
  - $ref: ../_shared/validation-logic.md
  - $ref: ../_shared/syntax-commands.json
user-invocable: true
---

# Test Code - Comprehensive Testing Framework

Навык для комплексного тестирования изменений в проекте Family Budget с 7-stage testing pipeline, адаптивным выбором тестов на основе git diff анализа, интерактивными auto-fix proposals и TOON optimization для больших test suites.

---

## When to Use

**PHASE 4 (Validation)** - после code execution, перед git commit.

**Используйте test-code когда:**
- ✅ Завершили разработку feature/fix
- ✅ Готовы к validation перед commit
- ✅ Нужен полный coverage analysis (syntax → quality → runtime → e2e)
- ✅ Хотите автоматически обнаружить и исправить type errors, linting issues, failing tests

**НЕ используйте когда:**
- ❌ Trivial changes (typo fix, comment update)
- ❌ Work in progress (code не готов к тестированию)
- ❌ Хотите запустить только один вид тестов (используйте pytest/vitest напрямую)

**Workflow integration:**
```
PHASE 3: Execution → Code changes complete
   ↓
PHASE 4: Validation → @skill:test-code
   ↓ (if passed)
PHASE 5A: Git commit
   ↓ (if failed)
@skill:error-handling OR @skill:rollback-recovery
```

---

## How It Works

### 7-Stage Testing Pipeline

**STAGE 0: Context Detection (Adaptive)**

Анализирует git diff для определения категории изменений и выбора релевантных тестов.

**Алгоритм:**
```bash
# Git diff analysis
git diff --name-only HEAD | grep -E '^backend/' → BACKEND_CHANGED=true
git diff --name-only HEAD | grep -E '^frontend/' → FRONTEND_CHANGED=true
git diff --name-only HEAD | grep -E '^tests/e2e/' → E2E_CHANGED=true
git diff --name-only HEAD | grep -E 'package\.json|requirements\.txt' → DEPS_CHANGED=true
git diff --name-only HEAD | grep -E '\.github/workflows/' → CI_CHANGED=true
```

**Логика выбора тестов:**
- `backend_changed=true` → pytest + e2e (всегда)
- `frontend_changed=true` → vitest + type-check + e2e (всегда)
- `dependencies_changed=true` → lockfile validation + security audit
- `e2e_changed=true` → только e2e tests
- `ci_changed=true` → все тесты (критическая инфраструктура)

**Duration estimates:**
- Backend only: 3-4 min (pytest) + 5-6 min (e2e) = 8-10 min
- Frontend only: 1-2 min (vitest + type-check) + 5-6 min (e2e) = 6-8 min
- Both: 4-5 min (pytest + vitest) + 5-6 min (e2e) = 9-11 min
- CI changes: 10-15 min (full test suite)

---

**STAGE 1: Syntax Validation**

Проверка корректности синтаксиса без выполнения кода.

**Python:**
```bash
# Syntax check
python -m py_compile backend/app/**/*.py
find backend/ -name "*.py" -exec python -m py_compile {} \; 2>&1 | tee syntax-errors.log
```

**TypeScript:**
```bash
# Type check (no emit)
npx tsc --noEmit -p config/tsconfig.json 2>&1 | tee ts-errors.log
```

**JSON/YAML:**
```bash
# JSON validation
find . -name "*.json" ! -path "*/node_modules/*" -exec jq empty {} \; 2>&1 | tee json-errors.log

# YAML validation
yamllint -c .yamllint.yml docs/architecture/**/*.yaml
```

**Auto-fix proposal (если errors > 0):**
- TypeScript: "Found N syntax errors. Apply tsc --fix?"
- Python: Manual fix required (py_compile не поддерживает auto-fix)

---

**STAGE 2: Quality Checks (Linting + Type Checking)**

Проверка code quality, стиля, типов.

**Backend (Python):**
```bash
# Ruff linting
ruff check backend/ --output-format=json > ruff-results.json

# MyPy type checking (non-blocking)
mypy backend/ || true > mypy-results.log

# Black formatting check
black --check backend/ 2>&1 | tee black-results.log
```

**Frontend (TypeScript/JavaScript):**
```bash
# ESLint
npm run lint -- --format json > eslint-results.json

# Check max warnings threshold (5000)
WARNINGS=$(jq '.[] | .warningCount' eslint-results.json | awk '{sum+=$1} END {print sum}')
if [ $WARNINGS -gt 5000 ]; then echo "ESLint warnings exceeded threshold"; fi
```

**Auto-fix proposals:**
- Ruff: "Found N errors (M fixable). Apply ruff --fix?"
- Black: "Found formatting issues. Apply black formatting?"
- ESLint: "Found N warnings. Apply eslint --fix?"

---

**STAGE 3: Runtime Testing (Unit + Integration)**

Запуск unit и integration тестов.

**Backend (pytest):**
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

**Frontend (Vitest):**
```bash
npm run test:coverage -- --reporter=json --outputFile=vitest-results.json
```

**Known failing tests handling:**
- Анализ pytest-results.json → найти skipped tests
- Сравнение с conftest.py comments
- Предложение автоматического исправления:
  - "tests/models/test_article.py" → "Add is_current attribute to Article model?"
  - "tests/services/test_import_executor.py" → "Add parse_tinkoff_amount method?"

**Coverage thresholds:**
- Backend: минимум 30.0% lines
- Frontend: минимум 4.0% lines, 32.0% functions

---

**STAGE 4: Dependency Validation**

Проверка lockfile consistency и security vulnerabilities.

**Backend (Python):**
```bash
# Lockfile consistency
pip freeze > installed-packages.txt
diff requirements.txt installed-packages.txt > pip-diff.log

# Security audit
pip-audit --format json > pip-audit-results.json || true
```

**Frontend (Node.js):**
```bash
# Lockfile consistency
npm ci --dry-run 2>&1 | tee npm-ci-dryrun.log

# Security audit
npm audit --json > npm-audit-results.json || true

# Outdated packages
npm outdated --json > npm-outdated-results.json || true
```

---

**STAGE 5: E2E Testing (Playwright)**

Запуск Playwright E2E тестов (всегда, согласно требованиям).

**Commands:**
```bash
npm run test:e2e -- --reporter=json > playwright-results.json
```

**Test projects (все 6):**
- setup (authentication)
- chromium (desktop)
- firefox (desktop)
- webkit (desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

**Duration:** ~5-6 минут для 8 тестов × 6 проектов

**Если failures:**
- Показать screenshot/video paths
- Показать trace файлы
- Предложить `npm run test:e2e:debug` для интерактивной отладки

---

**STAGE 6: Result Analysis**

Агрегирование результатов и предложение действий.

**Aggregate results:**
- Status: passed | partial | failed
- Total duration
- Critical issues (blocking)
- Warnings (non-blocking)
- Autofix proposals (interactive)

**TOON format (для >= 5 test results):**
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

**STAGE 7: Auto-fix Execution (Interactive)**

Применение автоисправлений с подтверждением.

**Для каждой категории спрашивать:**
```
Category: Linting (ruff)
Issues: 3 errors (2 fixable)
Proposed fix: ruff check backend/ --fix

Apply fix? [Y/n]
```

**Workflow:**
1. Syntax errors → Auto-fix → Re-validate syntax
2. Linting errors → Auto-fix → Re-run quality checks
3. Known failing tests → Apply fixes → Re-run pytest
4. Security vulnerabilities → Show `npm audit fix` command (НЕ применять автоматически)

**Behavior on failure:**
- Если auto-fix не решает проблему → показать manual fix instructions
- Если конфликт между fixes → sequential execution + re-validate

---

## Output Format

### Structured JSON Output

```json
{
  "test_output": {
    "status": "passed | partial | failed",
    "total_duration": "7m 18s",
    "stages": {
      "syntax_validation": {
        "status": "passed | failed | warning",
        "errors": [],
        "warnings": []
      },
      "quality_checks": {
        "status": "passed | failed | warning",
        "ruff": {"status": "failed", "errors": 3, "fixable": 2},
        "mypy": {"status": "warning", "errors": 5, "blocking": false},
        "eslint": {"status": "passed", "warnings": 3421, "threshold": 5000}
      },
      "runtime_testing": {
        "status": "passed | partial | failed",
        "backend_pytest": {
          "total_tests": 87,
          "passed": 59,
          "failed": 0,
          "skipped": 28,
          "coverage": {"lines": 32.5, "threshold": 30.0, "passed": true}
        },
        "frontend_vitest": {
          "total_tests": 42,
          "passed": 42,
          "failed": 0,
          "coverage": {"lines": 4.2, "functions": 34.1}
        }
      },
      "dependency_validation": {
        "status": "passed | warning | failed",
        "backend_pip": {"lockfile_consistent": true, "security_vulnerabilities": 0},
        "frontend_npm": {"lockfile_consistent": true, "security_vulnerabilities": 2}
      },
      "e2e_testing": {
        "status": "passed | failed",
        "total_tests": 8,
        "passed": 8,
        "failed": 0,
        "duration": "5m 42s",
        "projects": {
          "chromium": {"status": "passed", "tests": 8, "duration": "1m 12s"},
          "firefox": {"status": "passed", "tests": 8, "duration": "1m 24s"},
          "webkit": {"status": "passed", "tests": 8, "duration": "1m 18s"},
          "mobile_chrome": {"status": "passed", "tests": 8, "duration": "1m 22s"},
          "mobile_safari": {"status": "passed", "tests": 8, "duration": "1m 11s"}
        }
      }
    },
    "critical_issues": [
      "Ruff linting: 3 errors (2 fixable)",
      "Backend pytest: 28 skipped tests (known issues)"
    ],
    "warnings": [
      "npm audit: 2 moderate vulnerabilities",
      "mypy: 5 type errors (non-blocking)"
    ],
    "autofix_proposals": [
      {
        "category": "linting",
        "tool": "ruff",
        "command": "ruff check backend/ --fix",
        "description": "Fix 2 auto-fixable linting errors"
      },
      {
        "category": "known_failing_tests",
        "file": "backend/app/models/article.py",
        "fix": "Add is_current: bool field to Article SQLModel",
        "description": "Fixes tests/models/test_article.py::test_article_scd2"
      }
    ],
    "toon": {
      "test_results_toon": "test_results[5]{stage,status,duration,errors,warnings}:...",
      "token_savings": "45.3%"
    }
  }
}
```

### TOON Format (для >= 5 test results)

Автоматически генерируется для оптимизации token usage.

**Example:**
```toon
test_results[7]{stage,status,duration,errors,warnings}:
  context_detection,passed,5s,0,0
  syntax_validation,passed,12s,0,0
  quality_checks,failed,45s,3,5
  runtime_testing,partial,3m24s,0,28
  dependency_validation,warning,18s,0,2
  e2e_testing,passed,5m42s,0,0
  result_analysis,completed,8s,0,0
```

**Token savings calculation:**
```
JSON tokens: 1847
TOON tokens: 1012
Savings: (1847 - 1012) / 1847 × 100% = 45.2%
```

---

## Templates

### @template:test-input

Input template для git diff context и test categories.

**Reference:** `templates/test-input.json`

**Key fields:**
- `git_diff_context`: {backend_changed, frontend_changed, e2e_changed, dependencies_changed, ci_changed, changed_files[]}
- `test_categories`: array of enum [syntax | quality | runtime | dependencies | e2e]
- `autofix_enabled`: boolean (default: true)
- `e2e_strategy`: enum [full | smoke | skip] (default: full)
- `coverage_threshold`: {backend_lines: 30.0, frontend_lines: 4.0, frontend_functions: 32.0}

---

### @template:test-output

Output template для test results с TOON support.

**Reference:** `templates/test-output.json`

**Key fields:**
- `status`: enum [passed | partial | failed]
- `total_duration`: string (pattern: /^\d+m \d+s$/)
- `stages`: {syntax_validation, quality_checks, runtime_testing, dependency_validation, e2e_testing}
- `critical_issues`: array of strings
- `warnings`: array of strings
- `autofix_proposals`: array of objects
- `toon`: {test_results_toon: string, token_savings: string} (optional)

---

### @template:autofix-proposal

Template для auto-fix proposals.

**Reference:** `templates/autofix-proposal.json`

**Key fields:**
- `category`: enum [syntax | linting | type-checking | known-failing-tests | security]
- `tool`: string (ruff, mypy, eslint, black, pytest, npm)
- `command`: string (bash command для auto-fix)
- `description`: string (min 10 chars)
- `file`: string (optional - файл для manual fix)
- `fix`: string (optional - code snippet для manual fix)
- `user_confirmation_required`: boolean (default: true)

---

## Schemas

### @schema:test-input

JSON Schema для валидации test-input.json.

**Reference:** `schemas/test-input.schema.json`

**Auto-generated from:** `templates/test-input.json`

---

### @schema:test-output

JSON Schema для валидации test-output.json.

**Reference:** `schemas/test-output.schema.json`

**Auto-generated from:** `templates/test-output.json`

---

### @schema:autofix-proposal

JSON Schema для валидации autofix-proposal.json.

**Reference:** `schemas/autofix-proposal.schema.json`

**Auto-generated from:** `templates/autofix-proposal.json`

---

## Examples

### Example 1: Backend Validation

**Scenario:** Developer modified `backend/app/api/v1/endpoints/articles.py` to add new filter parameter.

**Reference:** `examples/backend-validation.md`

**Flow:**
1. Context Detection → backend_changed: true → pytest + e2e
2. Syntax Validation → passed
3. Quality Checks → ruff failed (3 errors, 2 fixable)
4. Runtime Testing → partial (59 passed, 28 skipped)
5. Dependency Validation → passed
6. E2E Testing → passed (5m 42s)
7. Result Analysis → Status: PARTIAL

**Auto-fix proposals:**
- ruff --fix (2 fixes)
- Add Article.is_current attribute (28 skipped tests)

**Duration:** 7m 18s

---

### Example 2: Frontend Validation

**Scenario:** Developer modified `frontend/src/budgetWsClient.ts` to add new WebSocket event handler.

**Reference:** `examples/frontend-validation.md`

**Flow:**
1. Context Detection → frontend_changed: true → vitest + type-check + e2e
2. Syntax Validation → TypeScript failed (1 error)
3. Quality Checks → ESLint passed (3421 warnings < 5000 threshold)
4. Runtime Testing → Vitest passed (42 tests)
5. Dependency Validation → npm audit warning (2 moderate vulnerabilities)
6. E2E Testing → passed (5m 42s)
7. Result Analysis → Status: FAILED

**Auto-fix proposals:**
- tsc --fix (1 TypeScript error)
- npm audit fix (manual review required)

**Duration:** 6m 30s

---

### Example 3: E2E Validation

**Scenario:** E2E тесты всегда запускаются (согласно требованиям пользователя).

**Reference:** `examples/e2e-validation.md`

**Flow:**
1. Context Detection → e2e_strategy: full (всегда)
2. Playwright запускается для всех 6 проектов (setup, chromium, firefox, webkit, mobile_chrome, mobile_safari)
3. 8 тестов × 6 проектов = 48 test runs
4. Duration: 5m 42s
5. Result: All passed

**Projects:**
- setup: 15s
- chromium: 1m 12s (8 tests)
- firefox: 1m 24s (8 tests)
- webkit: 1m 18s (8 tests)
- mobile_chrome: 1m 22s (8 tests)
- mobile_safari: 1m 11s (8 tests)

---

### Example 4: Fixing Known Failing Tests

**Scenario:** Навык test-code обнаружил 28 skipped tests и предлагает автоматическое исправление.

**Reference:** `examples/failing-tests-fix.md`

**Analysis:**
- `tests/models/test_article.py` → Missing Article.is_current attribute
- `tests/services/test_import_executor.py` → Missing parse_tinkoff_amount method

**Proposed Fixes:**
1. **Article model** (backend/app/models/article.py)
   ```python
   class Article(SQLModel, table=True):
       ...
       is_current: bool = True  # Add this field
   ```

2. **ImportExecutor service** (backend/app/services/import_executor.py)
   ```python
   def parse_tinkoff_amount(self, raw_amount: str) -> Decimal:
       return Decimal(raw_amount.replace(' ', '').replace(',', '.'))
   ```

**User Confirmation:**
```
Found 28 skipped tests with known issues.
Apply fixes? [Y/n]
```

**After Fixes:**
- Re-run pytest → 87 passed, 0 skipped
- Coverage increased: 30.0% → 45.2%

---

## Rules

### @rules:best-practices

Best practices для testing strategies, coverage thresholds, common pitfalls.

**Reference:** `rules/best-practices.md`

**Sections:**
1. **Testing Strategies** - Adaptive testing, Test pyramid, Coverage thresholds
2. **Common Pitfalls** - Running unnecessary tests, Ignoring failing tests, Auto-fixing blindly
3. **Performance Tips** - Parallel execution, Smoke tests, Caching
4. **Known Issues** - 28 failing tests, Coverage thresholds lowered, MyPy non-blocking

---

## Adaptive Testing Logic

### Git Diff Analysis Algorithm

```python
def detect_changed_areas(git_diff_output):
    """
    Анализирует git diff для определения категорий изменений.

    Returns:
        dict: {
            'backend_changed': bool,
            'frontend_changed': bool,
            'e2e_changed': bool,
            'dependencies_changed': bool,
            'ci_changed': bool,
            'changed_files': list[str]
        }
    """
    changed_files = git_diff_output.split('\n')

    return {
        'backend_changed': any(f.startswith('backend/') for f in changed_files),
        'frontend_changed': any(f.startswith('frontend/') for f in changed_files),
        'e2e_changed': any(f.startswith('tests/e2e/') for f in changed_files),
        'dependencies_changed': any(f in ['package.json', 'requirements.txt'] for f in changed_files),
        'ci_changed': any(f.startswith('.github/workflows/') for f in changed_files),
        'changed_files': changed_files
    }
```

### Test Selection Logic

| Condition | Tests to Run | Duration Estimate |
|-----------|--------------|-------------------|
| `backend_changed=true` | pytest + e2e | 8-10 min |
| `frontend_changed=true` | vitest + type-check + e2e | 6-8 min |
| `backend_changed=true` AND `frontend_changed=true` | pytest + vitest + e2e | 9-11 min |
| `dependencies_changed=true` | lockfile validation + security audit + (backend OR frontend tests) | 7-9 min |
| `e2e_changed=true` | только e2e tests | 5-6 min |
| `ci_changed=true` | ВСЕ тесты (критическая инфраструктура) | 10-15 min |

**Note:** E2E тесты **ВСЕГДА** запускаются (согласно требованиям пользователя), даже если только backend или frontend изменены.

### Duration Breakdown

**Backend Tests (pytest):**
- Unit tests: 1-2 min (59 passing)
- Integration tests: 1-2 min
- Coverage report: 30s
- **Total:** 3-4 min

**Frontend Tests (vitest + type-check):**
- TypeScript type checking: 30s
- Vitest unit tests: 30-60s (42 tests)
- Coverage report: 15s
- **Total:** 1-2 min

**E2E Tests (Playwright):**
- Setup (authentication): 15s
- Chromium: 1m 12s (8 tests)
- Firefox: 1m 24s (8 tests)
- Webkit: 1m 18s (8 tests)
- Mobile Chrome: 1m 22s (8 tests)
- Mobile Safari: 1m 11s (8 tests)
- **Total:** 5m 42s

---

## Auto-fix Execution

### Interactive Confirmation Process

Для каждой категории ошибок навык спрашивает подтверждение перед применением auto-fix.

**Workflow:**

```
┌─────────────────────────────────────────────┐
│ Category: Syntax Errors (TypeScript)        │
│ Issues: 1 error                             │
│ File: frontend/src/budgetWsClient.ts:45     │
│ Error: Property 'userId' does not exist     │
│                                             │
│ Proposed fix: tsc --fix                     │
│                                             │
│ Apply fix? [Y/n] ▊                          │
└─────────────────────────────────────────────┘
```

**If approved (Y):**
1. Execute fix command
2. Re-validate syntax
3. Show diff of changes
4. Continue to next category

**If denied (n):**
1. Skip auto-fix
2. Show manual fix instructions
3. Continue to next category

### Fix Categories

**1. Syntax Errors**
- **TypeScript:** `npx tsc --fix` (если поддерживается)
- **Python:** Manual fix required (py_compile не поддерживает auto-fix)
- **JSON/YAML:** Manual fix required

**2. Linting Errors**
- **Ruff (Python):** `ruff check backend/ --fix`
- **ESLint (JavaScript/TypeScript):** `npm run lint -- --fix`
- **Black (Python formatting):** `black backend/`

**3. Type Checking Errors**
- **MyPy (Python):** Manual fix required (mypy не поддерживает auto-fix)
- **TypeScript:** Часть ошибок фиксится через `tsc --fix`

**4. Known Failing Tests**
- **Article.is_current:** Add field to SQLModel
- **parse_tinkoff_amount:** Add method to ImportExecutor service
- **Fixture issues:** Update conftest.py fixtures

**5. Security Vulnerabilities**
- **npm audit:** Show `npm audit fix` command (НЕ применять автоматически)
- **pip-audit:** Show upgrade commands (НЕ применять автоматически)

### Sequential Execution

Auto-fixes применяются последовательно для избежания конфликтов:

1. **Syntax errors** → Apply → Re-validate syntax → Continue
2. **Linting errors** → Apply → Re-run linting → Continue
3. **Type checking errors** → Apply → Re-run type check → Continue
4. **Known failing tests** → Apply → Re-run pytest → Continue
5. **Security vulnerabilities** → Show manual commands → Skip

**If any fix fails:**
- Rollback changes (git restore)
- Show error message
- Show manual fix instructions
- Ask user how to proceed

---

## Integration Points

### Input Dependencies

**1. thinking-framework**
- **Purpose:** Analysis thinking для test strategy selection
- **When:** STAGE 0 (Context Detection) - определение какие тесты запускать
- **Example:** "Should we run E2E tests if only backend changed? → Yes (always per requirements)"

**2. context-awareness**
- **Purpose:** Project context (language, frameworks, testing tools)
- **When:** STAGE 0 (Context Detection) - определение доступных test runners
- **Example:** "Project uses pytest + vitest → run both for full coverage"

**3. git-workflow**
- **Purpose:** Git diff context для adaptive testing
- **When:** STAGE 0 (Context Detection) - анализ git diff --name-only
- **Example:** "backend/app/api/v1/endpoints/articles.py changed → run pytest + e2e"

### Output Consumers

**1. error-handling**
- **Purpose:** Обработка критических test failures
- **When:** STAGE 6 (Result Analysis) - если status == "failed"
- **Example:** "E2E tests failed → trigger rollback-recovery"

**2. rollback-recovery**
- **Purpose:** Откат изменений при failed validation
- **When:** Critical failures (coverage drop, E2E failures, security vulnerabilities)
- **Example:** "Coverage dropped from 45% to 28% → rollback changes"

**3. git-workflow**
- **Purpose:** Commit fixes после auto-fix execution
- **When:** STAGE 7 (Auto-fix Execution) - после успешного auto-fix
- **Example:** "Applied ruff --fix → commit changes with message 'fix: apply ruff auto-fix'"

**4. User**
- **Purpose:** Review test results + approve auto-fixes
- **When:** STAGE 6 (Result Analysis) + STAGE 7 (Auto-fix Execution)
- **Example:** "Show test summary → User approves ruff --fix → Apply fix"

### Workflow Integration Example

```
PHASE 4: Validation
   ↓
@skill:test-code
   ├─ STAGE 0: Context Detection
   │    └─ Input: @skill:git-workflow (git diff)
   │    └─ Input: @skill:context-awareness (project context)
   ├─ STAGE 1-5: Execute tests
   ├─ STAGE 6: Result Analysis
   │    └─ Output: {test_results} → if failed → @skill:error-handling
   └─ STAGE 7: Auto-fix Execution
        └─ Output: {fixes_applied} → @skill:git-workflow (commit fixes)
        └─ Output: {rollback_needed} → @skill:rollback-recovery
```

---

## Version History

### v1.0.0 (2026-02-08)

- ✅ Initial release
- ✅ 7-stage testing pipeline (Context Detection → Result Analysis)
- ✅ Adaptive testing на основе git diff
- ✅ Interactive auto-fix proposals (syntax, linting, type-checking, known-failing-tests)
- ✅ TOON format support для >= 5 test results (40-50% token savings)
- ✅ E2E testing always enabled (user requirement)
- ✅ Known failing tests detection (28 tests в conftest.py)
- ✅ Integration с PHASE 4 (Validation) workflow
- ✅ 12 файлов: SKILL.md + 3 templates + 3 schemas + 4 examples + 1 rules

---

**Author:** Family Budget Team
**License:** MIT
**Support:** См. examples/ для real-world scenarios, rules/best-practices.md для testing strategies

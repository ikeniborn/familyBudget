# Example: Backend Validation Workflow

## Scenario

Developer modified `backend/app/api/v1/endpoints/articles.py` to add new filter parameter `category_id` для фильтрации статей по категории.

**Changes:**
- `backend/app/api/v1/endpoints/articles.py` - добавлен query parameter `category_id: Optional[int]`
- `backend/app/services/article_service.py` - добавлен метод `filter_by_category(category_id)`
- `tests/endpoints/test_articles.py` - добавлен тест для нового параметра

---

## Input (test-input.json)

```json
{
  "test_input": {
    "git_diff_context": {
      "backend_changed": true,
      "frontend_changed": false,
      "e2e_changed": false,
      "dependencies_changed": false,
      "ci_changed": false,
      "changed_files": [
        "backend/app/api/v1/endpoints/articles.py",
        "backend/app/services/article_service.py",
        "tests/endpoints/test_articles.py"
      ]
    },
    "test_categories": ["syntax", "quality", "runtime", "e2e"],
    "autofix_enabled": true,
    "e2e_strategy": "full",
    "coverage_threshold": {
      "backend_lines": 30.0,
      "frontend_lines": 4.0,
      "frontend_functions": 32.0
    }
  }
}
```

---

## Execution Flow

### STAGE 0: Context Detection

**Analysis:**
- `backend_changed=true` → Запустить pytest + e2e
- `frontend_changed=false` → Пропустить vitest/type-check
- Test categories: [syntax, quality, runtime, e2e]

**Estimated duration:** 8-10 min (3-4 min pytest + 5-6 min e2e)

---

### STAGE 1: Syntax Validation

**Commands executed:**
```bash
# Python syntax check
find backend/ -name "*.py" -exec python -m py_compile {} \; 2>&1
```

**Result:**
```json
{
  "syntax_validation": {
    "status": "passed",
    "python": {"status": "passed", "errors": []},
    "typescript": {"status": "skipped"},
    "json": {"status": "passed", "errors": []},
    "yaml": {"status": "passed", "warnings": []}
  }
}
```

**Duration:** 12s

---

### STAGE 2: Quality Checks

**Commands executed:**
```bash
# Ruff linting
ruff check backend/ --output-format=json > ruff-results.json

# MyPy type checking
mypy backend/ || true > mypy-results.log

# Black formatting check
black --check backend/ 2>&1
```

**Result:**
```json
{
  "quality_checks": {
    "status": "failed",
    "ruff": {
      "status": "failed",
      "errors": 3,
      "fixable": 2,
      "details": [
        {
          "file": "backend/app/api/v1/endpoints/articles.py",
          "line": 45,
          "rule": "F401",
          "message": "Unused import: 'HTTPException'"
        },
        {
          "file": "backend/app/services/article_service.py",
          "line": 78,
          "rule": "E501",
          "message": "Line too long (92 > 88 characters)"
        },
        {
          "file": "backend/app/services/article_service.py",
          "line": 85,
          "rule": "W291",
          "message": "Trailing whitespace"
        }
      ]
    },
    "mypy": {
      "status": "warning",
      "errors": 5,
      "blocking": false
    },
    "eslint": {
      "status": "skipped"
    }
  }
}
```

**Auto-fix proposal:**
```
Category: Linting (ruff)
Issues: 3 errors (2 fixable)
Proposed fix: ruff check backend/ --fix

Apply fix? [Y/n]
```

**Duration:** 45s

---

### STAGE 3: Runtime Testing

**Commands executed:**
```bash
cd backend
pytest tests/ \
  --cov=app \
  --cov-report=json:coverage.json \
  -v \
  -m "not e2e" \
  --maxfail=5 \
  --json-report-file=pytest-results.json
```

**Result:**
```json
{
  "runtime_testing": {
    "status": "partial",
    "backend_pytest": {
      "status": "partial",
      "total_tests": 87,
      "passed": 59,
      "failed": 0,
      "skipped": 28,
      "coverage": {
        "lines": 32.5,
        "threshold": 30.0,
        "passed": true
      },
      "known_failing_tests": [
        "tests/endpoints/test_articles.py::test_create_article",
        "tests/integration/backend/test_user_api.py::test_update_user",
        "tests/models/test_article.py::test_article_scd2",
        "tests/services/test_import_executor.py::test_parse_tinkoff"
      ]
    },
    "frontend_vitest": {
      "status": "skipped"
    }
  }
}
```

**Known failing tests detected:**
- 28 skipped tests в conftest.py
- Причины: missing is_current attribute, parse_tinkoff_amount method

**Auto-fix proposal:**
```
Category: Known Failing Tests
Issues: 28 skipped tests (fixture issues, missing attributes)
Proposed fixes:
  1. Add is_current: bool field to Article model
  2. Add parse_tinkoff_amount method to ImportExecutor

Apply fixes? [Y/n]
```

**Duration:** 3m 24s

---

### STAGE 4: Dependency Validation

**Commands executed:**
```bash
# Lockfile consistency
pip freeze > installed-packages.txt
diff requirements.txt installed-packages.txt

# Security audit
pip-audit --format json > pip-audit-results.json || true
```

**Result:**
```json
{
  "dependency_validation": {
    "status": "passed",
    "backend_pip": {
      "status": "passed",
      "lockfile_consistent": true,
      "security_vulnerabilities": 0
    },
    "frontend_npm": {
      "status": "skipped"
    }
  }
}
```

**Duration:** 18s

---

### STAGE 5: E2E Testing

**Commands executed:**
```bash
npm run test:e2e -- --reporter=json > playwright-results.json
```

**Result:**
```json
{
  "e2e_testing": {
    "status": "passed",
    "total_tests": 8,
    "passed": 8,
    "failed": 0,
    "duration": "5m 42s",
    "projects": {
      "setup": {"status": "passed", "duration": "15s"},
      "chromium": {"status": "passed", "tests": 8, "duration": "1m 12s"},
      "firefox": {"status": "passed", "tests": 8, "duration": "1m 24s"},
      "webkit": {"status": "passed", "tests": 8, "duration": "1m 18s"},
      "mobile_chrome": {"status": "passed", "tests": 8, "duration": "1m 22s"},
      "mobile_safari": {"status": "passed", "tests": 8, "duration": "1m 11s"}
    },
    "test_files": [
      "tests/e2e/webapp/test_webapp_loading.spec.ts",
      "tests/e2e/webapp/test_form_submission.spec.ts",
      "tests/e2e/webapp/test_offline_functionality.spec.ts",
      "tests/e2e/webapp/test_mobile_navigation.spec.ts"
    ]
  }
}
```

**Duration:** 5m 42s

---

### STAGE 6: Result Analysis

**Aggregate results:**
```json
{
  "test_summary": {
    "status": "partial",
    "total_duration": "7m 18s",
    "stages": {
      "syntax_validation": "passed",
      "quality_checks": "failed",
      "runtime_testing": "partial",
      "dependency_validation": "passed",
      "e2e_testing": "passed"
    },
    "critical_issues": [
      "Ruff linting: 3 errors (2 fixable)",
      "Backend pytest: 28 skipped tests (known issues)"
    ],
    "warnings": [
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
    ]
  }
}
```

**TOON format:**
```toon
test_results[5]{stage,status,duration,errors,warnings}:
  syntax_validation,passed,12s,0,0
  quality_checks,failed,45s,3,5
  runtime_testing,partial,3m24s,0,28
  dependency_validation,passed,18s,0,0
  e2e_testing,passed,5m42s,0,0
```

**Token savings:** 45.3% (JSON: 1847 tokens, TOON: 1012 tokens)

---

### STAGE 7: Auto-fix Execution

**User interactions:**

**1. Linting fix:**
```
Category: Linting (ruff)
Issues: 3 errors (2 fixable)
Proposed fix: ruff check backend/ --fix

Apply fix? [Y/n] Y
```

**Applied:**
```bash
ruff check backend/ --fix
```

**Result:**
- ✅ Removed unused import 'HTTPException'
- ✅ Removed trailing whitespace
- ❌ Line too long (requires manual fix)

**2. Known failing tests fix:**
```
Category: Known Failing Tests
Issues: 28 skipped tests
Proposed fix: Add is_current field to Article model

Apply fix? [Y/n] Y
```

**Applied:**
```python
# backend/app/models/article.py
class Article(SQLModel, table=True):
    ...
    is_current: bool = True  # Added
```

**Re-run pytest:**
```bash
pytest tests/models/test_article.py -v
```

**Result:**
- ✅ test_article_scd2 PASSED (was skipped)
- Coverage: 32.5% → 34.1% (improved)

---

## Output (test-output.json)

```json
{
  "test_output": {
    "status": "partial",
    "total_duration": "7m 18s",
    "stages": { ... },
    "critical_issues": [
      "Ruff linting: 1 error remaining (line too long - manual fix required)",
      "Backend pytest: 27 skipped tests remaining"
    ],
    "warnings": [
      "mypy: 5 type errors (non-blocking)"
    ],
    "autofix_proposals": [],
    "toon": {
      "test_results_toon": "test_results[5]{stage,status,duration,errors,warnings}:...",
      "token_savings": "45.3%"
    }
  }
}
```

---

## Summary

**Workflow result:**
- ✅ Syntax validation: passed
- ⚠️ Quality checks: 1 error remaining (manual fix)
- ⚠️ Runtime testing: 27 skipped tests remaining (1 fixed)
- ✅ Dependency validation: passed
- ✅ E2E testing: passed
- **Overall status:** PARTIAL (ready to commit with known issues)

**Auto-fixes applied:**
- Ruff: 2 of 3 fixes applied
- Known failing tests: 1 of 28 fixed

**Next steps:**
1. Manually fix line too long error
2. Continue fixing remaining 27 skipped tests (or document as known issues)
3. Commit changes with message: "feat: add category filter to articles endpoint"

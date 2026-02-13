# Output Format

Структура output данных навыка test-code.

---

## Structured JSON Output

### Main Structure

```json
{
  "test_output": {
    "status": "passed | partial | failed",
    "total_duration": "7m 18s",
    "stages": { ... },
    "critical_issues": [...],
    "warnings": [...],
    "autofix_proposals": [...],
    "toon": { ... }
  }
}
```

---

## Stages Object

### syntax_validation

```json
{
  "syntax_validation": {
    "status": "passed | failed | warning",
    "python": {
      "status": "passed | failed",
      "errors": []
    },
    "typescript": {
      "status": "passed | failed",
      "errors": [
        {
          "file": "frontend/src/budgetWsClient.ts",
          "line": 45,
          "message": "Property 'userId' does not exist on type 'User'"
        }
      ]
    },
    "json": {
      "status": "passed | failed",
      "errors": []
    },
    "yaml": {
      "status": "passed | warning",
      "warnings": ["Trailing whitespace in docs/architecture/core/authentication.md"]
    }
  }
}
```

---

### quality_checks

```json
{
  "quality_checks": {
    "status": "passed | failed | warning",
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
        }
      ]
    },
    "mypy": {
      "status": "warning",
      "errors": 5,
      "blocking": false
    },
    "eslint": {
      "status": "passed",
      "warnings": 3421,
      "threshold": 5000
    }
  }
}
```

---

### runtime_testing

```json
{
  "runtime_testing": {
    "status": "passed | partial | failed",
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
        "tests/integration/backend/test_user_api.py::test_update_user"
      ]
    },
    "frontend_vitest": {
      "status": "passed",
      "total_tests": 42,
      "passed": 42,
      "failed": 0,
      "coverage": {
        "lines": 4.2,
        "functions": 34.1,
        "branches": 61.3,
        "statements": 4.5
      }
    }
  }
}
```

---

### dependency_validation

```json
{
  "dependency_validation": {
    "status": "passed | warning | failed",
    "backend_pip": {
      "status": "passed",
      "lockfile_consistent": true,
      "security_vulnerabilities": 0
    },
    "frontend_npm": {
      "status": "warning",
      "lockfile_consistent": true,
      "security_vulnerabilities": 2,
      "vulnerabilities": [
        {
          "package": "axios",
          "severity": "moderate",
          "cve": "CVE-2024-12345"
        }
      ],
      "outdated_packages": 12
    }
  }
}
```

---

### e2e_testing

```json
{
  "e2e_testing": {
    "status": "passed | failed",
    "total_tests": 8,
    "passed": 8,
    "failed": 0,
    "duration": "5m 42s",
    "projects": {
      "setup": {
        "status": "passed",
        "duration": "15s"
      },
      "chromium": {
        "status": "passed",
        "tests": 8,
        "duration": "1m 12s"
      },
      "firefox": {
        "status": "passed",
        "tests": 8,
        "duration": "1m 24s"
      },
      "webkit": {
        "status": "passed",
        "tests": 8,
        "duration": "1m 18s"
      },
      "mobile_chrome": {
        "status": "passed",
        "tests": 8,
        "duration": "1m 22s"
      },
      "mobile_safari": {
        "status": "passed",
        "tests": 8,
        "duration": "1m 11s"
      }
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

---

## Arrays

### critical_issues

```json
{
  "critical_issues": [
    "Ruff linting: 3 errors (2 fixable)",
    "Backend pytest: 28 skipped tests (known issues)"
  ]
}
```

---

### warnings

```json
{
  "warnings": [
    "npm audit: 2 moderate vulnerabilities",
    "mypy: 5 type errors (non-blocking)"
  ]
}
```

---

### autofix_proposals

```json
{
  "autofix_proposals": [
    {
      "category": "linting",
      "tool": "ruff",
      "command": "ruff check backend/ --fix",
      "description": "Fix 2 auto-fixable linting errors",
      "user_confirmation_required": true
    },
    {
      "category": "known_failing_tests",
      "file": "backend/app/models/article.py",
      "fix": "Add is_current: bool field to Article SQLModel",
      "description": "Fixes tests/models/test_article.py::test_article_scd2",
      "user_confirmation_required": true
    }
  ]
}
```

---

## TOON Format

Генерируется автоматически для >= 5 test results.

### Example

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

### TOON Object

```json
{
  "toon": {
    "test_results_toon": "test_results[5]{stage,status,duration,errors,warnings}:...",
    "token_savings": "45.3%",
    "size_comparison": "JSON: 1847 tokens, TOON: 1012 tokens"
  }
}
```

### Token Savings Calculation

```
JSON tokens: 1847
TOON tokens: 1012
Savings: (1847 - 1012) / 1847 × 100% = 45.2%
```

---

## Status Values

### Overall Status

- **passed:** Все тесты прошли, нет critical issues
- **partial:** Некоторые тесты skipped или warnings, но coverage passed
- **failed:** Critical failures (syntax errors, E2E failures, coverage below threshold)

### Stage Status

- **passed:** Stage успешно завершен без ошибок
- **warning:** Non-blocking issues (MyPy errors, npm vulnerabilities)
- **failed:** Blocking issues требуют исправления

---

## Full Example

См. `examples/backend-validation.md` для полного примера с output.

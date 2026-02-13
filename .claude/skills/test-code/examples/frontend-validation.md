# Example: Frontend Validation Workflow

## Scenario

Developer modified `frontend/src/budgetWsClient.ts` to add new WebSocket event handler `onCategoryUpdate` для real-time обновления категорий.

**Changes:**
- `frontend/src/budgetWsClient.ts` - добавлен `onCategoryUpdate(data: CategoryUpdateEvent)` handler
- `frontend/src/types/websocket.ts` - добавлен `CategoryUpdateEvent` interface
- `tests/unit/budgetWsClient.test.ts` - добавлен unit test для нового handler

---

## Input (test-input.json)

```json
{
  "test_input": {
    "git_diff_context": {
      "backend_changed": false,
      "frontend_changed": true,
      "e2e_changed": false,
      "dependencies_changed": false,
      "ci_changed": false,
      "changed_files": [
        "frontend/src/budgetWsClient.ts",
        "frontend/src/types/websocket.ts",
        "tests/unit/budgetWsClient.test.ts"
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

## Execution Flow Summary

### STAGE 0: Context Detection
- `frontend_changed=true` → vitest + type-check + e2e
- **Estimated duration:** 6-8 min

### STAGE 1: Syntax Validation (TypeScript)
**Command:**
```bash
npx tsc --noEmit -p config/tsconfig.json 2>&1
```

**Result:** ❌ FAILED
```json
{
  "typescript": {
    "status": "failed",
    "errors": [
      {
        "file": "frontend/src/budgetWsClient.ts",
        "line": 45,
        "message": "Property 'userId' does not exist on type 'CategoryUpdateEvent'"
      }
    ]
  }
}
```

**Auto-fix proposal:**
```
Category: Syntax Errors (TypeScript)
Issues: 1 error
File: frontend/src/budgetWsClient.ts:45
Error: Property 'userId' does not exist on type 'CategoryUpdateEvent'

Proposed fix: Add userId field to CategoryUpdateEvent interface

Apply fix? [Y/n] Y
```

**Duration:** 30s

---

### STAGE 2: Quality Checks (ESLint)
**Command:**
```bash
npm run lint -- --format json > eslint-results.json
```

**Result:** ✅ PASSED
```json
{
  "eslint": {
    "status": "passed",
    "warnings": 3421,
    "threshold": 5000
  }
}
```

**Duration:** 45s

---

### STAGE 3: Runtime Testing (Vitest)
**Command:**
```bash
npm run test:coverage -- --reporter=json --outputFile=vitest-results.json
```

**Result:** ✅ PASSED
```json
{
  "frontend_vitest": {
    "status": "passed",
    "total_tests": 43,
    "passed": 43,
    "failed": 0,
    "coverage": {
      "lines": 4.5,
      "functions": 34.8,
      "branches": 62.1,
      "statements": 4.7
    }
  }
}
```

**Duration:** 1m 15s

---

### STAGE 4: Dependency Validation (npm)
**Command:**
```bash
npm audit --json > npm-audit-results.json
```

**Result:** ⚠️ WARNING
```json
{
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
    ]
  }
}
```

**Auto-fix proposal:**
```
Category: Security
Issues: 2 moderate vulnerabilities
Manual command: npm audit fix

Apply fix? [Y/n] n (requires manual review)
```

**Duration:** 20s

---

### STAGE 5: E2E Testing
**Result:** ✅ PASSED (5m 42s)

---

### STAGE 6: Result Analysis

**Status:** FAILED (due to TypeScript syntax error)

**TOON format:**
```toon
test_results[5]{stage,status,duration,errors,warnings}:
  syntax_validation,failed,30s,1,0
  quality_checks,passed,45s,0,3421
  runtime_testing,passed,1m15s,0,0
  dependency_validation,warning,20s,0,2
  e2e_testing,passed,5m42s,0,0
```

---

### STAGE 7: Auto-fix Execution

**1. TypeScript syntax error:**
```bash
# Applied fix:
# Added userId: number to CategoryUpdateEvent interface
```

**Re-run type check:**
```bash
npx tsc --noEmit -p config/tsconfig.json
# ✅ No errors
```

---

## Output Summary

**Total duration:** 6m 30s

**Result:**
- ✅ Syntax validation: PASSED (after auto-fix)
- ✅ Quality checks: PASSED
- ✅ Runtime testing: PASSED
- ⚠️ Dependency validation: WARNING (2 vulnerabilities - manual review required)
- ✅ E2E testing: PASSED

**Overall status:** WARNING (ready to commit, but review npm vulnerabilities)

**Auto-fixes applied:**
- TypeScript: Added userId field to CategoryUpdateEvent interface

**Next steps:**
1. Review npm audit vulnerabilities (axios moderate severity)
2. Commit changes: "feat: add WebSocket category update handler"

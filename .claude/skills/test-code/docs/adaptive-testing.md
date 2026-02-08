# Adaptive Testing Logic

Адаптивный выбор тестов на основе git diff анализа.

---

## Git Diff Analysis Algorithm

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

---

## Test Selection Logic

| Condition | Tests to Run | Duration Estimate |
|-----------|--------------|-------------------|
| `backend_changed=true` | pytest + e2e | 8-10 min |
| `frontend_changed=true` | vitest + type-check + e2e | 6-8 min |
| `backend_changed=true` AND `frontend_changed=true` | pytest + vitest + e2e | 9-11 min |
| `dependencies_changed=true` | lockfile validation + security audit + (backend OR frontend tests) | 7-9 min |
| `e2e_changed=true` | только e2e tests | 5-6 min |
| `ci_changed=true` | ВСЕ тесты (критическая инфраструктура) | 10-15 min |

**Note:** E2E тесты **ВСЕГДА** запускаются (согласно требованиям пользователя), даже если только backend или frontend изменены.

---

## Duration Breakdown

### Backend Tests (pytest)

- **Unit tests:** 1-2 min (59 passing)
- **Integration tests:** 1-2 min
- **Coverage report:** 30s
- **Total:** 3-4 min

### Frontend Tests (vitest + type-check)

- **TypeScript type checking:** 30s
- **Vitest unit tests:** 30-60s (42 tests)
- **Coverage report:** 15s
- **Total:** 1-2 min

### E2E Tests (Playwright)

- **Setup (authentication):** 15s
- **Chromium:** 1m 12s (8 tests)
- **Firefox:** 1m 24s (8 tests)
- **Webkit:** 1m 18s (8 tests)
- **Mobile Chrome:** 1m 22s (8 tests)
- **Mobile Safari:** 1m 11s (8 tests)
- **Total:** 5m 42s

---

## Why E2E Always Runs

**User requirement:**
> "E2E strategy: Всегда запускать E2E тесты (полное покрытие, ~5-10 мин)"

**Reasons:**

1. **Regression prevention:** Backend changes могут сломать frontend workflow
2. **Cross-browser coverage:** Убедиться что все 5 браузеров работают
3. **Integration testing:** Проверить full stack (backend API + frontend UI + WebSocket)
4. **Production readiness:** E2E тесты имитируют real user scenarios

**Trade-off:**
- ⏱️ Adds 5-6 min to every validation
- 💰 CI/CD cost (6 parallel browser instances)
- ✅ Confidence: Critical flows tested before deploy

---

## Examples

### Example 1: Backend Only Changes

**Input:**
```json
{
  "git_diff_context": {
    "backend_changed": true,
    "frontend_changed": false,
    "e2e_changed": false,
    "dependencies_changed": false,
    "ci_changed": false,
    "changed_files": ["backend/app/api/v1/endpoints/articles.py"]
  }
}
```

**Selected tests:**
- ✅ pytest (3-4 min)
- ✅ e2e (5-6 min)
- ❌ vitest (skipped)
- ❌ type-check (skipped)

**Duration:** 8-10 min

---

### Example 2: Frontend Only Changes

**Input:**
```json
{
  "git_diff_context": {
    "backend_changed": false,
    "frontend_changed": true,
    "e2e_changed": false,
    "dependencies_changed": false,
    "ci_changed": false,
    "changed_files": ["frontend/src/budgetWsClient.ts"]
  }
}
```

**Selected tests:**
- ❌ pytest (skipped)
- ✅ vitest (1-2 min)
- ✅ type-check (30s)
- ✅ e2e (5-6 min)

**Duration:** 6-8 min

---

### Example 3: Dependencies Changed

**Input:**
```json
{
  "git_diff_context": {
    "backend_changed": false,
    "frontend_changed": false,
    "e2e_changed": false,
    "dependencies_changed": true,
    "ci_changed": false,
    "changed_files": ["package.json", "requirements.txt"]
  }
}
```

**Selected tests:**
- ✅ lockfile validation (pip freeze diff, npm ci --dry-run)
- ✅ security audit (pip-audit, npm audit)
- ✅ pytest (dependencies may affect backend)
- ✅ vitest (dependencies may affect frontend)
- ✅ e2e (always)

**Duration:** 9-11 min

---

### Example 4: CI/CD Changes

**Input:**
```json
{
  "git_diff_context": {
    "backend_changed": false,
    "frontend_changed": false,
    "e2e_changed": false,
    "dependencies_changed": false,
    "ci_changed": true,
    "changed_files": [".github/workflows/pr-checks.yml"]
  }
}
```

**Selected tests:**
- ✅ ALL tests (критическая инфраструктура)

**Duration:** 10-15 min

**Rationale:** CI/CD изменения могут сломать весь pipeline → run everything для проверки.

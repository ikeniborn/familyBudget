# Testing Best Practices

Руководство по testing strategies, coverage thresholds, common pitfalls, и performance tips для проекта Family Budget.

---

## 1. Testing Strategies

### Test Pyramid

**Принцип:** Больше unit tests, меньше E2E tests.

```
         E2E Tests (8 tests, ~5-6 min)
        ─────────────────────
      Integration Tests (30 tests, ~2 min)
    ──────────────────────────────────
  Unit Tests (87 tests, ~3-4 min total)
──────────────────────────────────────────
```

**Rationale:**
- **Unit tests:** Fast, isolated, cheap to maintain
- **Integration tests:** Medium speed, test component interaction
- **E2E tests:** Slow, expensive, test full user flows

**Current state:**
- Unit: 87 tests (pytest + vitest)
- Integration: ~30 tests (backend API + frontend components)
- E2E: 8 tests × 6 browsers = 48 test runs

**Ideal ratio:** 70% unit, 20% integration, 10% E2E

---

### Adaptive Testing (Git Diff Analysis)

**Principle:** Запускать только релевантные тесты на основе изменений.

**Algorithm:**
```python
if backend_changed:
    run pytest + e2e
elif frontend_changed:
    run vitest + type-check + e2e
elif dependencies_changed:
    run lockfile validation + security audit + (backend OR frontend tests)
elif ci_changed:
    run ALL tests (critical infrastructure)
else:
    run e2e only (smoke test)
```

**Benefits:**
- ⏱️ Faster feedback loop (6-8 min vs 10-15 min for full suite)
- 💰 Lower CI/CD costs (fewer unnecessary test runs)
- 🎯 Relevant test coverage для конкретных изменений

**Trade-off:**
- ⚠️ E2E tests **ВСЕГДА** запускаются (user requirement) → No time savings on E2E

---

### Coverage Thresholds

**Backend (Python):**
- **Lines:** Minimum 30.0% (current: 32.5%)
- **Branches:** Not enforced (future: 25.0%)
- **Functions:** Not enforced (future: 40.0%)

**Frontend (TypeScript/JavaScript):**
- **Lines:** Minimum 4.0% (current: 4.5%)
- **Functions:** Minimum 32.0% (current: 34.8%)
- **Branches:** Minimum 60.0% (current: 62.1%)
- **Statements:** Minimum 4.0% (current: 4.7%)

**Why thresholds lowered?**
- Legacy code without tests (pre-existing codebase)
- 28 known failing tests skipped (fixture issues, missing attributes)
- Gradual improvement strategy (increase thresholds incrementally)

**Future goals:**
- Backend: 30% → 50% → 70% (over 6 months)
- Frontend: 4% → 20% → 40% (over 6 months)

---

## 2. Common Pitfalls

### ❌ Pitfall 1: Running E2E Tests Without Backend Changes

**Problem:**
```bash
# Changed only documentation
git diff --name-only
> docs/architecture/README.md

# But E2E tests still run (5-6 min wasted)
npm run test:e2e  # ← Unnecessary
```

**Solution:**
- **User requirement:** E2E tests ВСЕГДА запускаются (no workaround)
- Alternative: Use `e2e_strategy: smoke` для быстрого smoke test (2 tests instead of 8)

---

### ❌ Pitfall 2: Ignoring Known Failing Tests

**Problem:**
```python
# tests/conftest.py
@pytest.mark.skip(reason="Missing is_current attribute")
def test_article_scd2():
    ...  # Test never runs → Bug accumulates
```

**Consequences:**
- 🐛 Tech debt accumulates (28 skipped tests)
- 📉 Coverage artificially lowered (30% instead of 45%)
- 🔥 Production bugs slip through

**Solution:**
- **Proactive approach:** Use test-code skill для auto-detection + auto-fix proposals
- **Regular cleanup:** Review skipped tests quarterly
- **Track progress:** Document fixes в GitHub Issues

---

### ❌ Pitfall 3: Auto-fixing Without Understanding

**Problem:**
```bash
# Blindly apply auto-fix
ruff check backend/ --fix  # ← What did it change?

# Commit without review
git commit -m "fix: apply ruff auto-fix"
```

**Consequences:**
- 🐛 Introduces new bugs (e.g., removed wrong import)
- 🔍 Hard to debug (no understanding of changes)
- 🔄 Reverts needed (rollback entire commit)

**Solution:**
- **Review diff:** `git diff` after auto-fix, before commit
- **Understand changes:** Read auto-fix descriptions
- **Test after fix:** Re-run tests to verify fix didn't break anything
- **Sequential fixes:** Apply syntax → linting → type-checking (one at a time)

---

### ❌ Pitfall 4: Running Tests Without Latest Dependencies

**Problem:**
```bash
# Outdated dependencies
pip freeze | grep fastapi
> fastapi==0.95.0  # Current: 0.121.2 in requirements.txt

# Tests pass locally, fail in CI
pytest tests/  # ✅ Passed (but wrong environment)
```

**Consequences:**
- ❌ CI/CD failures (different behavior)
- 🐛 Production bugs (dependency mismatch)

**Solution:**
- **Lockfile consistency check:** `pip freeze` vs `requirements.txt`
- **CI/CD alignment:** Use same Python/Node versions as CI
- **Pre-commit hook:** Validate dependencies before commit

---

## 3. Performance Tips

### ⚡ Tip 1: Parallel Test Execution

**Backend (pytest-xdist):**
```bash
# Sequential (slow)
pytest tests/  # 3m 45s

# Parallel (4 workers)
pytest tests/ -n 4  # 1m 12s (3x faster)
```

**Configuration:**
```ini
# pytest.ini
[pytest]
addopts = -n auto  # Auto-detect CPU cores
```

**Frontend (Vitest):**
```javascript
// vitest.config.ts
export default {
  test: {
    threads: true,  // Enable parallel execution
    maxThreads: 4   // Limit to 4 workers
  }
}
```

**Performance gain:** ~60% faster test runs

---

### ⚡ Tip 2: E2E Smoke Tests for Quick Validation

**Full E2E suite:**
```bash
npm run test:e2e  # 8 tests × 6 browsers = 5m 42s
```

**Smoke tests (fast subset):**
```bash
npm run test:e2e -- --grep "@smoke"  # 2 tests × 6 browsers = 1m 30s
```

**When to use smoke tests:**
- Quick validation during development
- Pre-commit checks (before pushing)
- Non-critical changes (docs, styling)

**When to use full suite:**
- Before merging to main
- Critical backend/frontend changes
- Release candidates

---

### ⚡ Tip 3: Cache Dependency Validation Results

**Problem:**
```bash
# Re-run security audit every time (slow)
npm audit  # 18s
pip-audit  # 15s
```

**Solution: Cache results for 24 hours**
```bash
# Cache file
CACHE_FILE=".test-cache/npm-audit-$(date +%Y-%m-%d).json"

if [ -f "$CACHE_FILE" ]; then
    echo "Using cached npm audit results"
    cat "$CACHE_FILE"
else
    npm audit --json > "$CACHE_FILE"
fi
```

**Performance gain:** 18s → 0.5s (36x faster)

**Invalidation:**
- Daily (new cache file each day)
- On dependencies change (`package.json` modified)

---

### ⚡ Tip 4: Skip Syntax Validation for Unchanged Files

**Problem:**
```bash
# Re-check all files (slow)
find backend/ -name "*.py" -exec python -m py_compile {} \;  # 12s
```

**Solution: Check only changed files**
```bash
# Git diff + syntax check
git diff --name-only --diff-filter=ACMR | grep '\.py$' | xargs python -m py_compile
# 12s → 2s (6x faster)
```

**Performance gain:** 83% reduction in syntax validation time

---

## 4. Known Issues

### Issue 1: 28 Failing Tests in conftest.py

**Locations:**
- `tests/endpoints/test_articles.py` (5 tests)
- `tests/models/test_article.py` (4 tests)
- `tests/services/test_import_executor.py` (6 tests)
- `tests/integration/backend/test_user_api.py` (3 tests)
- Others (10 tests)

**Causes:**
1. **Fixture issues:** JWT token refresh, Closure Table setup
2. **Missing attributes:** `Article.is_current`, `parse_tinkoff_amount`
3. **Constraint violations:** SCD Type 2 validation, shared budget permissions

**Impact:**
- Coverage lowered: 45% → 30%
- Tech debt accumulation
- Production bugs risk

**Mitigation:**
- Use test-code skill для auto-detection + fix proposals
- Track progress в GitHub Issues
- Prioritize fixes based on feature roadmap

---

### Issue 2: Coverage Thresholds Lowered Due to Pre-existing Issues

**Original thresholds:**
- Backend: 50% lines
- Frontend: 20% lines, 40% functions

**Current thresholds:**
- Backend: 30% lines (lowered by 20%)
- Frontend: 4% lines, 32% functions (lowered by 16-8%)

**Reason:**
- Legacy code without tests
- 28 skipped tests reduce denominator
- Gradual improvement strategy

**Recovery plan:**
1. Fix 28 skipped tests → Coverage: 30% → 45%
2. Add tests for critical paths → Coverage: 45% → 60%
3. Incremental threshold increases (5% per month)

---

### Issue 3: MyPy Errors Non-blocking (|| true in CI)

**Problem:**
```bash
# MyPy type checking failures don't block CI
mypy backend/ || true  # ← Errors ignored
```

**Reason:**
- 5 type errors в legacy code
- Blocking CI would prevent all merges
- Temporary workaround до fix

**Known errors:**
1. `article_service.py:45` - Missing return type annotation
2. `user_service.py:78` - Incompatible types in assignment
3. Others (3 errors)

**Recovery plan:**
1. Document all MyPy errors в GitHub Issues
2. Fix 1 error per week
3. Remove `|| true` when errors reach 0

---

## 5. References

**Internal documentation:**
- `@shared:validation-logic.md` - Validation commands, strategies
- `@shared:syntax-commands.json` - Syntax check commands per language
- `docs/architecture/operations/deployment-troubleshooting.md` - CI/CD testing

**External resources:**
- [Pytest Best Practices](https://docs.pytest.org/en/stable/goodpractices.html)
- [Vitest Configuration](https://vitest.dev/config/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

**Version:** 1.0.0
**Last updated:** 2026-02-08
**Author:** Family Budget Team

# Fix CI/CD Test Failures: Import Ordering & SCD Type 1 Migration

## Context

CI/CD pipeline провалился в ветке `fix/shopping-list-deletion-sync` (run ID: 22061624411) из-за трёх независимых проблем:

### Problem 1: Ruff Lint I001 Violations
- **Rule**: I001 требует правильного порядка импортов (stdlib → third-party → first-party)
- **Issue**: `backend/app/services/redis_service.py` чередует third-party и first-party импорты
- **Impact**: Backend Quality Checks workflow fails

### Problem 2: Missing admin_client Fixture
- **Error**: `fixture 'admin_client' not found` в test_admin_stats.py
- **Root Cause**: Тесты используют `admin_client`, но он не определен в `tests/conftest.py`
- **Impact**: 5 тестов в test_admin_stats.py выдают ERROR (fixture not found)

### Problem 3: SCD Type 2 Legacy Fields in Tests
- **Error**: `IntegrityError: insert or update on table "t_d_article" violates foreign key constraint`
- **Root Cause**: Модели мигрированы на SCD Type 1 (commit 366c7cae), но тесты создают Article с удаленными полями `is_current`, `valid_from`, `valid_to`
- **Files**: test_admin_stats.py (lines 68-70, 77-79), test_admin_delete.py (lines 52-55, 69-71)
- **Impact**: Тесты провалятся при создании Article/FinancialCenter с несуществующими полями

**Why this change is being made**: Модели были мигрированы на SCD Type 1, но тестовые fixtures не обновлены. Дополнительно, глобальный conftest.py не содержит admin_client fixture, который используется в integration tests. Это блокирует CI/CD pipeline.

## Investigation Results

### Verified Facts

1. **Ruff I001 Violation**: ✅ Confirmed in `backend/app/services/redis_service.py`
   - Lines 21-28: Import block mixes third-party and first-party imports
   - Fixable with `ruff check --select I001 --fix`

2. **Missing admin_client Fixture**: ✅ Confirmed
   - File: `tests/conftest.py` does NOT define `admin_client`
   - Used by: `test_admin_stats.py` lines 130, 158, 180, 210
   - Error: `fixture 'admin_client' not found`

3. **SCD Type 2 Legacy Fields**: ✅ Found in two files
   - ❌ `tests/integration/backend/test_admin_delete.py` (lines 52-55, 69-71)
   - ❌ `tests/integration/backend/test_admin_stats.py` (lines 68-70, 77-79)
   - Fields to remove: `is_current`, `valid_from`, `valid_to`

4. **User Model**: ✅ Already migrated to SCD Type 1
   - File: `backend/app/models/user.py:24-36`
   - Pattern: Stable PK, in-place updates, separate history table
   - No `is_current`, `valid_from`, `valid_to` fields

## Implementation Plan

### Phase 1: Auto-Fix Import Ordering (1 minute)

**Command**:
```bash
cd /home/ikeniborn/Documents/Project/familyBudget
ruff check backend/ --select I001 --fix
```

**Expected Change** (`backend/app/services/redis_service.py`):
```python
# BEFORE (lines 26-28):
import redis.asyncio as redis
from backend.app.core.config import get_settings  # ❌ first-party
from redis.asyncio import ConnectionPool, Redis   # ❌ back to third-party

# AFTER:
import redis.asyncio as redis
from redis.asyncio import ConnectionPool, Redis   # ✅ group third-party

from backend.app.core.config import get_settings  # ✅ first-party after blank line
```

**Verification**:
```bash
ruff check backend/ --select I001
# Expected: "All checks passed!"
```

---

### Phase 2: Add admin_client Fixture to Global conftest.py (5 minutes)

**File**: `tests/conftest.py`

**Problem**: test_admin_stats.py uses `admin_client` fixture, but it's not defined in conftest.py

**Insert after line 175** (after `authenticated_client` fixture):

```python
@pytest.fixture
async def admin_user(db_session: AsyncSession, admin_user_data):
    """
    Create and persist admin user in database.

    Returns User model instance with admin privileges (SCD Type 1).
    """
    from backend.app.models.user import User

    user = User(
        telegram_id=admin_user_data["telegram_id"],
        username=admin_user_data["username"],
        first_name=admin_user_data["first_name"],
        last_name=admin_user_data["last_name"],
        is_admin=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest.fixture
async def admin_client(client: AsyncClient, admin_user):
    """
    HTTP client authenticated as admin user.

    Creates admin user and returns client for making authenticated requests.
    For now, returns unauthenticated client (JWT auth not yet implemented).
    """
    # TODO: Add JWT token to client.headers once auth is implemented
    # client.headers["Authorization"] = f"Bearer {jwt_token}"
    return client
```

**Why**: test_admin_stats.py requires admin_client fixture, but it's not available globally. Adding it prevents "fixture not found" errors.

---

### Phase 3: Migrate test_admin_delete.py to SCD Type 1 (8 minutes)

**File**: `tests/integration/backend/test_admin_delete.py`

**Problem**: test_article and test_financial_center fixtures use deleted SCD Type 2 fields

#### Step 3.1: Keep Local admin_user Fixture

**NO CHANGES** to lines 27-43 (admin_user fixture is correctly implemented)

#### Step 3.2: Update test_article Fixture

**Find lines 45-60** and remove SCD Type 2 fields:
```python
@pytest.fixture
async def test_article(self, db_session: AsyncSession, admin_user: User):
    """Create test article for facts (SCD Type 1)."""
    article = Article(
        name="Test Category",
        type="expense",
        parent_id=None,
        user_id=admin_user.id,
        # ❌ REMOVED: is_current=True, valid_from=datetime.now(), valid_to=datetime(9999, 12, 31)
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    return article
```

#### Step 3.3: Update test_financial_center Fixture

**Find lines 62-76** and remove SCD Type 2 fields:
```python
@pytest.fixture
async def test_financial_center(self, db_session: AsyncSession, admin_user: User):
    """Create test financial center (SCD Type 1)."""
    fc = FinancialCenter(
        name="Test ЦФО",
        description="Test Financial Center",
        user_id=admin_user.id,
        # ❌ REMOVED: is_current=True, valid_from=datetime.now(), valid_to=datetime(9999, 12, 31)
    )
    db_session.add(fc)
    await db_session.commit()
    await db_session.refresh(fc)
    return fc
```

**No changes needed**: `mock_admin_dependency` fixture (lines 102-112) already correct

---

### Phase 4: Migrate test_admin_stats.py to SCD Type 1 (6 minutes)

**File**: `tests/integration/backend/test_admin_stats.py`

**Problem**: test_articles fixture creates Article with deleted SCD Type 2 fields

#### Step 4.1: Update test_articles Fixture

**Find lines 63-80** (two Article instances) and remove SCD Type 2 fields:

```python
@pytest.fixture
async def test_articles(self, db_session: AsyncSession, admin_user: User):
    """Create test articles."""
    articles = [
        Article(
            name="Продукты",
            type="expense",
            parent_id=None,
            user_id=admin_user.id,
            # ❌ REMOVED: is_current=True, valid_from=datetime.now(), valid_to=datetime(9999, 12, 31)
        ),
        Article(
            name="Зарплата",
            type="income",
            parent_id=None,
            user_id=admin_user.id,
            # ❌ REMOVED: is_current=True, valid_from=datetime.now(), valid_to=datetime(9999, 12, 31)
        ),
    ]
    for article in articles:
        db_session.add(article)
    await db_session.commit()
    for article in articles:
        await db_session.refresh(article)
    return articles
```

#### Step 4.2: No User Changes Needed

admin_user and regular_user fixtures (lines 24-57) are already correct - they use SCD Type 1 (no is_current/valid_from/valid_to)

---

### Phase 5: Local Verification (3 minutes)

```bash
# Step 1: Verify Ruff lint fix
ruff check backend/app/services/redis_service.py --select I001
# Expected: "All checks passed!"

# Step 2: Start test database
docker-compose -f docker-compose-test.yml up -d

# Step 3: Run affected test files
DATABASE_URL="postgresql://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/test_admin_delete.py \
                           tests/integration/backend/test_admin_stats.py \
                           -v --tb=short

# Step 4: Verify full Ruff lint
ruff check backend/
```

**Expected Output**:
- ✅ Zero Ruff I001 violations
- ✅ All 3 tests in `test_admin_delete.py` pass (no FK violations)
- ✅ All 5 tests in `test_admin_stats.py` pass (no fixture not found errors)
- ✅ No `IntegrityError` for SCD Type 2 fields

---

## Critical Files to Modify

| File | Changes | Lines |
|------|---------|-------|
| `backend/app/services/redis_service.py` | Auto-fix I001 (reorder imports) | 21-28 |
| `tests/conftest.py` | Add `admin_user` and `admin_client` fixtures | After 175 |
| `tests/integration/backend/test_admin_delete.py` | Remove SCD Type 2 fields from Article/FinancialCenter | 45-76 |
| `tests/integration/backend/test_admin_stats.py` | Remove SCD Type 2 fields from Article fixtures | 63-80 |

## Existing Functions to Reuse

- ✅ `tests/conftest.py:test_user_data()` - Dict with test user data (reused by new `test_user()`)
- ✅ `tests/conftest.py:admin_user_data()` - Dict with admin user data (reused by new `admin_user()`)
- ✅ `tests/conftest.py:db_session` - AsyncSession fixture (already used by tests)

## Verification End-to-End

### Local Testing
```bash
# 1. Fix imports
ruff check backend/ --select I001 --fix

# 2. Apply test changes (manual edits in IDE)

# 3. Run tests
docker-compose -f docker-compose-test.yml up -d
DATABASE_URL="postgresql://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/ -v

# 4. Check Ruff
ruff check backend/

# Expected: All tests pass, zero lint violations
```

### CI/CD Pipeline
After push to `test` branch:
1. **Backend Quality Checks** workflow runs
   - Verify: Ruff lint passes (no I001 violations)
2. **Backend Integration Tests** workflow runs
   - Verify: All integration tests pass
   - Verify: No FK constraint violations
3. **Post-deploy Tests** run on https://fbd.ikeniborn.ru/
   - Verify: E2E tests pass

### Success Criteria
- ✅ Zero Ruff I001 violations
- ✅ All integration tests pass (test_admin_delete.py, test_admin_stats.py)
- ✅ No FK constraint violations
- ✅ GitHub Actions workflow green checkmarks
- ✅ No regressions in other tests

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|-----------|
| User fixture conflicts with existing tests | Medium | Fixture names match existing patterns, isolated to integration tests |
| Ruff auto-fix breaks imports | Low | Ruff follows PEP 8, changes are standard import ordering |
| Other tests depend on SCD Type 2 fields | High | Run full test suite (`pytest tests/integration/`) to catch regressions |
| Production code still uses SCD Type 2 | Critical | Models already migrated (verified: User, Article, FinancialCenter use SCD Type 1) |

---

## Estimated Time

| Phase | Task | Time |
|-------|------|------|
| 1 | Auto-fix import ordering | 1 min |
| 2 | Add admin_user and admin_client to conftest.py | 5 min |
| 3 | Migrate test_admin_delete.py (remove SCD Type 2 fields) | 8 min |
| 4 | Migrate test_admin_stats.py (remove SCD Type 2 fields) | 6 min |
| 5 | Local verification | 3 min |
| **Total** | | **23 minutes** |

---

## Rollback Plan

If integration tests fail after changes:

```bash
# Revert commit
git revert HEAD

# Investigate specific failure
# 1. Check PostgreSQL logs for FK violations
# 2. Verify User model SCD Type 1 compliance
# 3. Check if admin_user fixture is properly injected
# 4. Run single test with verbose output:
#    pytest tests/integration/backend/test_admin_delete.py::TestAdminDeleteEndpoint::test_delete_existing_fact_returns_success -vv --tb=long
```

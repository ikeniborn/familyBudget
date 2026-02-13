# Example: Fixing 28 Known Failing Tests

## Scenario

Навык test-code обнаружил 28 skipped tests в conftest.py и предлагает автоматическое исправление.

**Current state:**
- `tests/conftest.py` - 28 тестов помечены как skipped
- Reason: fixture issues, missing attributes, constraint violations
- Coverage: 30.0% (lowered из-за skipped tests)

---

## Analysis

### Skipped Tests Breakdown

**1. Model Tests (12 tests):**
```python
# tests/models/test_article.py (5 tests)
pytest.mark.skip(reason="Missing is_current attribute in Article model")

# tests/models/test_category.py (4 tests)
pytest.mark.skip(reason="Closure Table fixture issues")

# tests/models/test_transaction.py (3 tests)
pytest.mark.skip(reason="SCD Type 2 validation errors")
```

**2. Service Tests (10 tests):**
```python
# tests/services/test_import_executor.py (6 tests)
pytest.mark.skip(reason="Missing parse_tinkoff_amount method")

# tests/services/test_transfer_service.py (4 tests)
pytest.mark.skip(reason="Deduplication logic not implemented")
```

**3. Integration Tests (6 tests):**
```python
# tests/integration/backend/test_user_api.py (3 tests)
pytest.mark.skip(reason="JWT token refresh fixture broken")

# tests/integration/backend/test_transaction_api.py (3 tests)
pytest.mark.skip(reason="Shared budget constraint violations")
```

---

## Proposed Fixes

### Fix 1: Add `is_current` Attribute to Article Model

**File:** `backend/app/models/article.py`

**Current code:**
```python
class Article(SQLModel, table=True):
    __tablename__ = "articles"

    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    title: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # Missing: is_current field для SCD Type 2
```

**Proposed fix:**
```python
class Article(SQLModel, table=True):
    __tablename__ = "articles"

    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="users.id")
    title: str
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    is_current: bool = True  # ✅ Added for SCD Type 2 pattern
```

**Migration required:**
```bash
alembic revision --autogenerate -m "Add is_current to articles table"
alembic upgrade head
```

**Tests fixed:** 5 tests в test_article.py

---

### Fix 2: Add `parse_tinkoff_amount` Method to ImportExecutor

**File:** `backend/app/services/import_executor.py`

**Current code:**
```python
class ImportExecutor:
    def __init__(self, db: Session):
        self.db = db

    def import_transactions(self, file_path: str) -> List[Transaction]:
        # Implementation for CSV import
        pass

    # Missing: parse_tinkoff_amount method
```

**Proposed fix:**
```python
class ImportExecutor:
    def __init__(self, db: Session):
        self.db = db

    def import_transactions(self, file_path: str) -> List[Transaction]:
        # Implementation for CSV import
        pass

    def parse_tinkoff_amount(self, raw_amount: str) -> Decimal:
        """
        Parse Tinkoff bank amount format: '1 234,56 ₽' → Decimal('1234.56')

        Args:
            raw_amount: String like '1 234,56 ₽' or '1 234,56'

        Returns:
            Decimal amount
        """
        # ✅ Added for Tinkoff CSV import
        # Remove currency symbol and spaces
        cleaned = raw_amount.replace(' ', '').replace('₽', '').strip()
        # Replace comma with dot (Russian decimal separator)
        cleaned = cleaned.replace(',', '.')
        return Decimal(cleaned)
```

**Tests fixed:** 6 tests в test_import_executor.py

---

### Fix 3: Fix JWT Token Refresh Fixture

**File:** `tests/integration/backend/conftest.py`

**Current code:**
```python
@pytest.fixture
def auth_token(client: TestClient) -> str:
    response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    return response.json()["access_token"]
    # Missing: Refresh token logic
```

**Proposed fix:**
```python
@pytest.fixture
def auth_token(client: TestClient) -> dict:
    """
    Returns dict with access_token and refresh_token for integration tests.
    """
    response = client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "testpass123"
    })
    data = response.json()
    return {
        "access_token": data["access_token"],
        "refresh_token": data.get("refresh_token"),  # ✅ Added
        "expires_at": data.get("expires_at")  # ✅ Added
    }
```

**Tests fixed:** 3 tests в test_user_api.py

---

### Fix 4: Deduplication Logic for TransferService

**File:** `backend/app/services/transfer_service.py`

**Current code:**
```python
class TransferService:
    def create_transfer(self, from_account_id: int, to_account_id: int, amount: Decimal) -> Transfer:
        # Create transfer
        # Missing: Deduplication check
        pass
```

**Proposed fix:**
```python
class TransferService:
    def create_transfer(self, from_account_id: int, to_account_id: int, amount: Decimal) -> Transfer:
        # ✅ Added: Check for duplicate transfer (within last 5 minutes, same amount)
        existing = self.db.query(Transfer).filter(
            Transfer.from_account_id == from_account_id,
            Transfer.to_account_id == to_account_id,
            Transfer.amount == amount,
            Transfer.created_at >= datetime.utcnow() - timedelta(minutes=5)
        ).first()

        if existing:
            logger.warning(f"Duplicate transfer detected: {existing.id}")
            return existing

        # Create new transfer
        transfer = Transfer(
            from_account_id=from_account_id,
            to_account_id=to_account_id,
            amount=amount
        )
        self.db.add(transfer)
        self.db.commit()
        return transfer
```

**Tests fixed:** 4 tests в test_transfer_service.py

---

## User Confirmation

**Interactive prompt:**
```
┌──────────────────────────────────────────────────────┐
│ Found 28 skipped tests with known issues            │
│                                                      │
│ Proposed fixes:                                      │
│  1. Add is_current field to Article model (5 tests) │
│  2. Add parse_tinkoff_amount method (6 tests)       │
│  3. Fix JWT refresh fixture (3 tests)               │
│  4. Add transfer deduplication (4 tests)            │
│  5. Other fixes (10 tests - manual review needed)   │
│                                                      │
│ Apply automatic fixes (1-4)? [Y/n] ▊                │
└──────────────────────────────────────────────────────┘
```

**User input:** `Y`

---

## Execution

### Step 1: Apply Fix 1 (Article.is_current)
```bash
# Edit backend/app/models/article.py (add is_current field)
# Create migration
alembic revision --autogenerate -m "Add is_current to articles"
alembic upgrade head
```

**Result:** ✅ Migration applied

### Step 2: Apply Fix 2 (parse_tinkoff_amount)
```bash
# Edit backend/app/services/import_executor.py (add method)
```

**Result:** ✅ Method added

### Step 3: Apply Fix 3 (JWT fixture)
```bash
# Edit tests/integration/backend/conftest.py (fix fixture)
```

**Result:** ✅ Fixture fixed

### Step 4: Apply Fix 4 (Transfer deduplication)
```bash
# Edit backend/app/services/transfer_service.py (add deduplication)
```

**Result:** ✅ Deduplication added

---

## Re-run pytest

**Command:**
```bash
pytest tests/ -v --tb=short
```

**Result:**
```
collected 87 items

tests/endpoints/test_articles.py::test_get_articles PASSED
tests/endpoints/test_articles.py::test_create_article PASSED  # ✅ Was skipped
tests/models/test_article.py::test_article_scd2 PASSED  # ✅ Was skipped
tests/models/test_article.py::test_article_is_current PASSED  # ✅ Was skipped
tests/services/test_import_executor.py::test_parse_tinkoff PASSED  # ✅ Was skipped
tests/integration/backend/test_user_api.py::test_token_refresh PASSED  # ✅ Was skipped
...

================== 87 passed, 10 skipped in 3.45s ==================

Coverage:
  Lines: 45.2% (was 30.0%)  # ✅ Increased by 15.2%
```

**Summary:**
- ✅ Fixed: 18 tests (из 28)
- ⚠️ Remaining: 10 tests (require manual review)
- 📈 Coverage: 30.0% → 45.2% (+15.2%)

---

## Remaining Issues (10 tests)

**Manual review required:**

1. **Closure Table fixture issues (4 tests):**
   - Complex fixture dependencies
   - Requires understanding of category hierarchy logic
   - Recommendation: Create isolated fixture с sample hierarchy

2. **SCD Type 2 validation errors (3 tests):**
   - Constraint violations в transaction history
   - Requires database schema review
   - Recommendation: Update constraints в migration

3. **Shared budget constraint violations (3 tests):**
   - Multi-user budget access issues
   - Requires permission system implementation
   - Recommendation: Implement budget sharing logic first

**Next steps:**
1. Document remaining 10 issues в GitHub Issues
2. Prioritize fixes based on feature roadmap
3. Continue with commit (18 fixes applied)

---

## After Fixes

**Git commit:**
```bash
git add backend/app/models/article.py
git add backend/app/services/import_executor.py
git add backend/app/services/transfer_service.py
git add tests/integration/backend/conftest.py
git add migrations/versions/*_add_is_current_to_articles.py

git commit -m "$(cat <<'EOF'
fix: resolve 18 of 28 known failing tests

- Add is_current field to Article model for SCD Type 2 (5 tests fixed)
- Add parse_tinkoff_amount method to ImportExecutor (6 tests fixed)
- Fix JWT token refresh fixture for integration tests (3 tests fixed)
- Add transfer deduplication logic to prevent duplicates (4 tests fixed)

Coverage increased: 30.0% → 45.2% (+15.2%)
Remaining: 10 tests require manual review (documented in #123)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**Result:**
- ✅ 18 tests fixed
- ✅ Coverage improved by 15.2%
- ⏭️ 10 tests deferred to future iteration
- 📋 Created GitHub Issue #123 for remaining tests

# Running Tests - Shopping List Deletion

Инструкции по запуску Priority 1 тестов для PR #424.

---

## Quick Start

```bash
# 1. Setup Python environment (one-time)
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt -r requirements.txt
cd ..

# 2. Run backend tests
./tests/run-tests.sh backend

# 3. Run E2E tests (requires dev server running)
npm run test:e2e -- test_shopping_lists.spec.ts
```

---

## Backend Integration Tests

### Prerequisites

**1. Test Database Running:**
```bash
docker ps | grep postgres-test
# Should show: familybudget-postgres-test on port 5433
```

If not running:
```bash
docker-compose -f docker-compose-test.yml up -d
```

**2. Python Virtual Environment:**
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt -r requirements.txt
cd ..
```

**3. Apply Migrations:**
```bash
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/alembic -c backend/db/migrations/alembic.ini upgrade head
```

### Run Tests

**All shopping list tests:**
```bash
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/test_shopping_lists.py -v
```

**Specific test:**
```bash
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_success -v
```

**With coverage:**
```bash
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/test_shopping_lists.py \
    --cov=backend.app.api.v1.endpoints.shopping_lists \
    --cov-report=term-missing
```

### Expected Output

```
tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_success PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_not_owner_forbidden PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_not_found PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_cascades_items PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_broadcasts_websocket PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDelete::test_delete_shopping_list_already_deleted PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDeleteEdgeCases::test_delete_with_invalid_id_format PASSED
tests/integration/backend/test_shopping_lists.py::TestShoppingListDeleteEdgeCases::test_delete_websocket_broadcast_failure_does_not_block PASSED

====================================== 8 passed in 2.45s ======================================
```

---

## E2E Tests (Playwright)

### Prerequisites

**1. Playwright Installed:**
```bash
npx playwright install
```

**2. Environment Variables:**
```bash
cat > .env.test << 'EOF'
TEST_USER_EMAIL=e2e-test@example.com
TEST_USER_PASSWORD=E2eTestPassword123!
BASE_URL=https://fbd.ikeniborn.ru
EOF
```

**3. Dev Server Running** (if testing locally):
```bash
# В отдельном терминале
docker-compose up
```

### Run Tests

**All shopping list E2E tests:**
```bash
npm run test:e2e -- test_shopping_lists.spec.ts
```

**Only deletion tests:**
```bash
npm run test:e2e -- test_shopping_lists.spec.ts -g "Deletion"
```

**UI Mode (interactive debugging):**
```bash
npm run test:e2e:ui -- test_shopping_lists.spec.ts
```

**Headed Mode (see browser):**
```bash
npm run test:e2e:headed -- test_shopping_lists.spec.ts
```

**Specific test:**
```bash
npm run test:e2e -- test_shopping_lists.spec.ts -g "should delete shopping list and remove from UI"
```

### Expected Output

```
Running 2 tests using 1 worker

  ✓  test_shopping_lists.spec.ts:361:3 › Shopping Lists - Deletion › should delete shopping list and remove from UI (3.2s)
  ✓  test_shopping_lists.spec.ts:443:3 › Shopping Lists - Deletion › should handle double deletion attempt gracefully (2.1s)

  2 passed (5.3s)
```

---

## All Tests Together

**Using run-tests.sh script:**

```bash
# All tests (backend + frontend + E2E)
./tests/run-tests.sh all

# Only backend
./tests/run-tests.sh backend

# Only E2E
./tests/run-tests.sh e2e
```

---

## Troubleshooting

### Problem: "backend/.venv/bin/pytest: No such file or directory"

**Solution:** Create Python virtual environment:
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt -r requirements.txt
cd ..
```

### Problem: "relation does not exist"

**Solution:** Apply migrations:
```bash
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/alembic -c backend/db/migrations/alembic.ini upgrade head
```

### Problem: Test database not running

**Solution:** Start test database:
```bash
docker-compose -f docker-compose-test.yml up -d
```

### Problem: Auth headers not working

**Note:** Backend tests use simplified auth headers (`X-User-ID`).

If tests fail with auth errors, update `create_auth_headers()` in test file to generate proper JWT tokens.

### Problem: E2E tests can't find delete button

**Solution:** Check UI selectors in test. Delete button may have different class/title.

Update locators in test:
```typescript
const deleteButton = firstList.locator('button[title*="Удалить" i]').first();
```

### Problem: WebSocket mock not working

**Solution:** Ensure `unittest.mock` is available:
```bash
backend/.venv/bin/pip install pytest-mock
```

---

## CI/CD

Tests will run automatically in GitHub Actions when PR is pushed.

**Check CI/CD results:**
- Go to PR #424
- Click "Checks" tab
- View "Tests" workflow

**Expected CI/CD workflow:**
1. Setup Python environment
2. Start test database
3. Apply migrations
4. Run pytest (backend)
5. Setup Node.js
6. Install Playwright
7. Run E2E tests
8. Generate coverage report

---

## Test Coverage

After running tests, check coverage:

**Backend:**
```bash
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/test_shopping_lists.py \
    --cov=backend.app.api.v1.endpoints \
    --cov-report=html

# Open htmlcov/index.html in browser
```

**E2E:**
```bash
npm run test:e2e -- test_shopping_lists.spec.ts --reporter=html

# Open playwright-report/index.html in browser
```

---

## Manual Testing

After automated tests pass, perform manual testing:

**Follow:** `frontend/web/static/js/lists/listsManager/testing/TESTING.md`

**Quick manual test:**
```bash
# 1. Open https://fbd.ikeniborn.ru/lists
# 2. Open DevTools Console
# 3. Run:
window.shoppingListDebug.help()

# 4. Test scenarios:
window.shoppingListDebug.enableSlowNetwork(3000)
# Delete a list → verify it disappears
```

---

## Summary

**Prerequisites:**
- ✅ Test DB running (port 5433)
- ✅ Python venv with dependencies
- ✅ Migrations applied
- ✅ Playwright installed

**Run Commands:**
```bash
# Backend (8 tests)
DATABASE_URL="postgresql+asyncpg://familybudget:test_password_12345678901234567890@localhost:5433/familybudget_test" \
  backend/.venv/bin/pytest tests/integration/backend/test_shopping_lists.py -v

# E2E (2 tests)
npm run test:e2e -- test_shopping_lists.spec.ts -g "Deletion"
```

**Expected Results:**
- ✅ 8 backend tests PASSED
- ✅ 2 E2E tests PASSED
- ✅ Coverage >= 35%

---

**Last Updated:** 2026-02-16
**PR:** #424
**Branch:** fix/shopping-list-deletion-sync

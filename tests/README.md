# Testing Infrastructure

Comprehensive testing setup for Family Budget Web Apps migration.

## Overview

Three levels of testing:
- **Unit Tests** - Fast, isolated tests for individual functions/modules
- **Integration Tests** - API endpoint tests with database interactions
- **E2E Tests** - Full user flow tests with Playwright

---

## Directory Structure

```
tests/
├── unit/
│   ├── backend/        # Backend unit tests
│   └── webapp/         # Frontend unit tests (TODO)
├── integration/
│   ├── backend/        # Backend API integration tests
│   └── webapp/         # Web App integration tests
├── e2e/
│   └── webapp/         # Playwright E2E tests
├── conftest.py         # Shared pytest fixtures
└── README.md           # This file
```

---

## Running Tests

### Prerequisites

```bash
# Install Python test dependencies
pip install pytest pytest-asyncio pytest-cov httpx

# Install Playwright
npm install -D @playwright/test
npx playwright install
```

### Unit Tests

```bash
# Run all unit tests
pytest tests/unit -v

# Run specific test file
pytest tests/unit/backend/test_webapp_auth.py -v

# Run with markers
pytest -m unit
```

### Integration Tests

```bash
# Run all integration tests
pytest tests/integration -v

# Run with database setup
pytest -m integration

# Run specific backend tests
pytest tests/integration/backend/ -v
```

### E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific test file
npx playwright test tests/e2e/webapp/test_webapp_loading.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run specific browser
npx playwright test --project=chromium
```

### All Tests

```bash
# Run unit + integration tests
pytest tests/ -v

# Then run E2E tests
npx playwright test
```

---

## Test Coverage

```bash
# Run with coverage report
pytest --cov=backend --cov-report=html tests/

# Open coverage report
open htmlcov/index.html
```

---

## Test Markers

Use markers to filter tests:

```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# E2E tests (use Playwright)
npx playwright test

# Backend tests only
pytest -m backend

# Web App tests only
pytest -m webapp

# Slow tests
pytest -m slow
```

---

## Writing Tests

### Unit Test Example

```python
# tests/unit/backend/test_example.py
import pytest

@pytest.mark.unit
@pytest.mark.backend
def test_something():
    result = my_function()
    assert result == expected_value
```

### Integration Test Example

```python
# tests/integration/backend/test_example.py
import pytest
from httpx import AsyncClient

@pytest.mark.integration
@pytest.mark.backend
async def test_endpoint(client: AsyncClient):
    response = await client.post("/api/v1/endpoint", json={...})
    assert response.status_code == 200
```

### E2E Test Example

```typescript
// tests/e2e/webapp/test_example.spec.ts
import { test, expect } from '@playwright/test';

test('user can perform action', async ({ page }) => {
  await page.goto('/webapp/index.html');
  await page.click('#button');
  await expect(page.locator('#result')).toBeVisible();
});
```

---

## Fixtures

### Available Pytest Fixtures

- `db_session` - Async database session (auto-rollback)
- `client` - Async HTTP client for API testing
- `test_user_data` - Sample user data dictionary
- `admin_user_data` - Sample admin user data
- `authenticated_client` - HTTP client with JWT auth (TODO)
- `mock_telegram_initdata` - Mock Telegram initData for testing

### Example Usage

```python
async def test_with_db(db_session):
    # Use db_session for database operations
    result = await db_session.execute(...)

async def test_with_client(client):
    # Use client for API requests
    response = await client.get("/api/v1/endpoint")
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      # Python tests
      - name: Run unit tests
        run: pytest tests/unit -v

      - name: Run integration tests
        run: pytest tests/integration -v

      # E2E tests
      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npx playwright test
```

---

## Test Database Setup

Integration tests use a separate test database to avoid data loss.

**Configuration:**

Set `TEST_DATABASE_URL` environment variable:

```bash
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/familybudget_test"
```

**Database is automatically:**
- Created at test session start
- Tables created from SQLModel metadata
- Cleaned after each test (auto-rollback)
- Dropped at test session end

---

## Troubleshooting

### Tests fail with "ModuleNotFoundError"

```bash
# Ensure you're in project root
pwd  # Should be /path/to/familyBudget

# Install test dependencies
pip install -r requirements-dev.txt
```

### Integration tests fail with database errors

```bash
# Ensure test database exists
psql -U postgres -c "CREATE DATABASE familybudget_test;"

# Check DATABASE_URL in conftest.py
# Should use separate test database
```

### E2E tests timeout

```bash
# Increase timeout in playwright.config.ts
# Or ensure backend is running:
cd backend && uvicorn backend.app.main:app
```

### Playwright browser installation issues

```bash
# Install browsers with system dependencies
npx playwright install --with-deps
```

---

## Next Steps

1. ✅ Unit tests for webapp_auth.py
2. ✅ Integration tests for validate endpoint
3. ✅ E2E test infrastructure
4. ⏳ Add unit tests for JS modules (Phase 1)
5. ⏳ Add integration tests for facts/articles endpoints (Phase 1)
6. ⏳ Add E2E tests for add transaction flow (Phase 1)

---

## Resources

- [Pytest Documentation](https://docs.pytest.org/)
- [Playwright Documentation](https://playwright.dev/)
- [FastAPI Testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [pytest-asyncio](https://github.com/pytest-dev/pytest-asyncio)

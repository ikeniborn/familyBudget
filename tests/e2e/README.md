# E2E Tests

End-to-end tests for Family Budget web application using Playwright.

---

## Quick Start

### 1. Install Dependencies

```bash
# Install Node.js dependencies (if not already done)
npm install

# Install Playwright browsers
npx playwright install chromium
```

### 2. Setup Test User

**Create test user** via one of these methods:
- UI Registration: https://fbd.ikeniborn.ru/register
- API Registration: `curl -X POST https://fbd.ikeniborn.ru/api/v1/auth/register ...`
- Admin Panel (if available)

**See detailed instructions:** `docs/testing/e2e-test-user-setup.md`

### 3. Configure Credentials

```bash
# Copy example file
cp .env.test.example .env.test

# Edit .env.test with real credentials
nano .env.test
```

**Example `.env.test`:**
```bash
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=YourStrongPassword123!
BASE_URL=https://fbd.ikeniborn.ru
```

**Important:** `.env.test` is excluded from git for security.

### 4. Run Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with visible browser (headed mode)
npm run test:e2e:headed

# Run specific test file
npx playwright test tests/e2e/webapp/test_mobile_navigation.spec.ts

# Run with specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Interactive UI mode
npm run test:e2e:ui

# View HTML report
npm run test:e2e:report
```

---

## Test Structure

```
tests/e2e/
├── README.md                           # This file
├── helpers/
│   └── auth.ts                         # Authentication helper (login/logout)
└── webapp/
    └── test_mobile_navigation.spec.ts  # Mobile navigation tests (9 tests)
```

---

## Available Tests

### Mobile Navigation (`test_mobile_navigation.spec.ts`)

**Test Categories:**

1. **Responsive Design (6 tests)**
   - Mobile nav visibility (< 1024px)
   - Desktop FAB visibility (≥ 1024px)
   - Breakpoint transition (1024px boundary)
   - Speed Dial menu on mobile
   - Tablet viewport handling (768px)
   - iOS Safari protection verification

2. **User Interactions (2 tests)**
   - Navigate via mobile nav buttons
   - Hidden desktop FAB not clickable

3. **Performance (1 test)**
   - Mobile navigation load time (< 5s)

**Run mobile navigation tests only:**
```bash
npx playwright test test_mobile_navigation
```

---

## Authentication

Tests use email/password authentication via `tests/e2e/helpers/auth.ts`.

**Authentication flow:**
1. Read credentials from `.env.test` or environment variables
2. Navigate to `/login` page
3. Fill email and password fields
4. Submit form
5. Verify redirect to main page
6. Check for user menu (logged in indicator)

**Credentials sources (priority order):**
1. `.env.test` file (local development)
2. Environment variables (CI/CD)

**Example usage in tests:**
```typescript
import { login } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  // Login before each test
  await login(page);

  // Navigate to app
  await page.goto('https://fbd.ikeniborn.ru');
});
```

---

## Configuration

### Playwright Config (`playwright.config.ts`)

Key settings:
- **Base URL:** `https://fbd.ikeniborn.ru` (production)
- **Browsers:** Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari
- **Screenshots:** On failure only
- **Video:** Retained on failure
- **Trace:** On first retry

**Change base URL:**
```bash
# Test against local server (NOT recommended, violates project policy)
BASE_URL=http://localhost:8000 npm run test:e2e

# Test against staging
BASE_URL=https://staging.fbd.ikeniborn.ru npm run test:e2e
```

### Test Environment Variables

| Variable | Description | Default | Source |
|----------|-------------|---------|--------|
| `TEST_USER_EMAIL` | Test user email | - | `.env.test` or env |
| `TEST_USER_PASSWORD` | Test user password | - | `.env.test` or env |
| `BASE_URL` | Application URL | `https://fbd.ikeniborn.ru` | `.env.test` or env |
| `CI` | CI/CD mode | `false` | GitHub Actions |

---

## Troubleshooting

### Issue: Tests fail with "element not found"

**Possible causes:**
1. Not logged in (authentication failed)
2. Wrong element selector
3. Page not fully loaded

**Debug steps:**
```bash
# Run in headed mode to see browser
npm run test:e2e:headed

# Enable verbose logging
DEBUG=pw:api npm run test:e2e

# Take screenshots on failure (automatic)
# Check: test-results/*/test-failed-*.png
```

### Issue: Authentication fails

**Error:** "Login failed. Still on login page"

**Solutions:**
1. Verify credentials in `.env.test` are correct
2. Test login manually: https://fbd.ikeniborn.ru/login
3. Check if test user exists (see `docs/testing/e2e-test-user-setup.md`)
4. Check password meets requirements (8+ chars, uppercase, lowercase, number, special char)

**Test credentials manually:**
```bash
curl -X POST https://fbd.ikeniborn.ru/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-test-user@example.com",
    "password": "YourPassword123!"
  }'
```

### Issue: ".env.test not found"

**Error:** `.env.test not found. Create it from .env.test.example...`

**Solution:**
```bash
# Copy example file
cp .env.test.example .env.test

# Edit with your credentials
nano .env.test
```

### Issue: Browser not installed

**Error:** `Executable doesn't exist at .../chromium...`

**Solution:**
```bash
npx playwright install chromium
```

### Issue: Tests timeout

**Possible causes:**
- Network latency (production server slow)
- Page not loading (check BASE_URL)
- Element selector changed (update test)

**Solutions:**
```bash
# Increase timeout (playwright.config.ts)
# Or use --timeout flag
npx playwright test --timeout=60000
```

---

## CI/CD Integration

### GitHub Actions Setup

**Add secrets to repository:**
1. Go to Settings → Secrets and variables → Actions
2. Add `TEST_USER_EMAIL` secret
3. Add `TEST_USER_PASSWORD` secret

**Example workflow (`.github/workflows/e2e-tests.yml`):**
```yaml
name: E2E Tests

on:
  push:
    branches: [main, test]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          BASE_URL: https://fbd.ikeniborn.ru
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

---

## Best Practices

### 1. Test Independence

Each test should be independent:
- ✅ Use `beforeEach` for setup
- ✅ Use `afterEach` for cleanup
- ❌ Don't rely on test execution order

### 2. Selectors

Prefer stable selectors:
- ✅ `data-testid` attributes
- ✅ ID selectors (`#element-id`)
- ✅ Semantic selectors (`button[type="submit"]`)
- ❌ CSS class names (may change)
- ❌ Text content (may be translated)

### 3. Waits

Use explicit waits:
- ✅ `await page.waitForSelector('#element')`
- ✅ `await page.waitForLoadState('networkidle')`
- ✅ `await expect(element).toBeVisible()`
- ❌ `await page.waitForTimeout(5000)` (flaky)

### 4. Authentication

Reuse login helper:
```typescript
import { login } from '../helpers/auth';

test.beforeEach(async ({ page }) => {
  await login(page);
});
```

### 5. Cleanup

Always clean up after tests:
```typescript
test.afterEach(async ({ page }) => {
  // Clear test data
  // Logout (optional, new session per test)
});
```

---

## Resources

- **Playwright Documentation:** https://playwright.dev/
- **Test User Setup:** `docs/testing/e2e-test-user-setup.md`
- **Browser Workarounds:** `docs/architecture/guides/browser-testing-workarounds.md`
- **Testing Infrastructure:** `docs/architecture/testing-infrastructure.md`
- **Playwright Config:** `playwright.config.ts`

---

**Last Updated:** 2026-01-27

# Browser Testing Workarounds

## resize_window Tool Limitation

**Issue:** Claude in Chrome extension's `resize_window(tabId, width, height)` tool does not reliably change browser viewport size. The tool returns success, but `window.innerWidth` remains unchanged.

**Root Cause:** MCP tool bug or Chrome extension API limitation (not a Family Budget project issue).

**Impact:**
- Cannot test responsive design with browser automation
- Mobile navigation testing blocked
- Breakpoint transitions (< 1024px ↔ ≥ 1024px) cannot be verified
- Speed Dial menu (mobile only) cannot be tested

---

## Workaround: Playwright E2E Tests

**Recommended Solution:** Use Playwright's `page.setViewportSize()` for reliable viewport control.

### Example Usage

```typescript
import { test, expect } from '@playwright/test';

test('mobile viewport', async ({ page }) => {
  await page.goto('https://fbd.ikeniborn.ru/');

  // Set mobile viewport (reliable)
  await page.setViewportSize({ width: 375, height: 667 });

  // Verify viewport changed
  const width = await page.evaluate(() => window.innerWidth);
  expect(width).toBe(375);

  // Test mobile-specific UI
  const mobileNav = page.locator('#mobile-navigation-bar');
  await expect(mobileNav).toBeVisible();
});
```

### Common Viewport Sizes

```typescript
// Mobile (iPhone 12 mini)
await page.setViewportSize({ width: 375, height: 667 });

// Tablet (iPad)
await page.setViewportSize({ width: 768, height: 1024 });

// Desktop
await page.setViewportSize({ width: 1920, height: 1080 });
```

---

## Alternative: Manual DevTools Testing

For quick manual verification:

1. Open https://fbd.ikeniborn.ru/ in Chrome
2. Press **F12** → Toggle device toolbar (**Ctrl+Shift+M**)
3. Select device preset (e.g., "iPhone 12") or custom dimensions
4. Verify mobile navigation visible at bottom
5. Switch to desktop size (1920px) → verify desktop FAB visible

**Advantages:**
- No code changes required
- Quick manual verification

**Disadvantages:**
- Not automated
- Not reproducible in CI/CD

---

## Fallback: CSS Media Query Injection

If actual resize is blocked, simulate breakpoint matching:

```typescript
await page.addInitScript(`
  window.simulateMobileViewport = () => {
    // Override matchMedia to return mobile breakpoint
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = (query) => {
      if (query.includes('max-width: 1023px')) {
        return { matches: true, media: query };
      }
      return originalMatchMedia(query);
    };

    // Trigger resize event
    window.dispatchEvent(new Event('resize'));
  };
`);

await page.evaluate(() => window.simulateMobileViewport());
```

**Note:** This is a hacky workaround and may not trigger all resize handlers correctly. Use Playwright viewport control when possible.

---

## Running E2E Tests

### Prerequisites

**Authentication Required:**
- Production URL (`https://fbd.ikeniborn.ru`) requires authentication
- Tests fail on login page without valid credentials
- **Solution:** Configure authentication in Playwright config or use authenticated session storage

**Browser Installation:**
```bash
# Install Chromium browser (first time only)
npx playwright install chromium
```

### Running Tests

```bash
# Run mobile navigation test
npx playwright test tests/e2e/webapp/test_mobile_navigation.spec.ts --headed

# Run with specific browser
npx playwright test --project="Mobile Chrome"

# Run all E2E tests
npx playwright test tests/e2e/

# Generate HTML report
npx playwright test --reporter=html
npx playwright show-report
```

### Current Limitations

⚠️ **Authentication Barrier:**
- Tests navigate to production URL but encounter login page
- No authentication configured in test setup
- **Workaround:** Add authentication setup in `beforeEach` hook or use storage state

**Example authentication setup** (future improvement):
```typescript
test.beforeEach(async ({ page }) => {
  // Option 1: Use saved auth state
  await page.context().addCookies([/* saved cookies */]);

  // Option 2: Login programmatically
  await page.goto('https://fbd.ikeniborn.ru/login');
  await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL);
  await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL('https://fbd.ikeniborn.ru/');
});
```

---

## Project Configuration

**Playwright already installed:**
- `playwright.config.ts` - Multi-device support configured
- Device presets: Desktop Chrome, Mobile Chrome, iPhone 12
- Screenshots on failure enabled
- Video on first retry enabled

**Test location:**
- `tests/e2e/webapp/test_mobile_navigation.spec.ts` - Mobile navigation test
- More E2E tests can be added following same pattern

---

## See Also

- **Testing Infrastructure:** `docs/architecture/testing-infrastructure.md`
- **Responsive Design:** `docs/architecture/frontend/responsive-design.md`
- **Playwright Config:** `playwright.config.ts`
- **Example Test:** `tests/e2e/webapp/test_mobile_navigation.spec.ts`

---

## Future Improvements

- [ ] Add tablet breakpoint testing (768px)
- [ ] Test dynamic resize behavior (`window.addEventListener('resize')`)
- [ ] Visual regression testing (Percy, Playwright screenshots)
- [ ] CI/CD integration for E2E tests

---

## Related Issues

- **Testing Report:** `FAB-MODAL-TEST-REPORT-2026-01-27.md`
- **GitHub Issue:** [Link to Claude in Chrome extension issue if reported]

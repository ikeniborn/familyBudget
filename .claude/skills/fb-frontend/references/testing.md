# Frontend Testing

## Unit Tests (Vitest)

**Run:**
```bash
npm run test:coverage        # all unit tests + coverage report
npm run test:coverage -- --reporter=verbose  # verbose output
```

**Config:** `config/vitest.config.ts` — environment: `happy-dom`.

**Location:** `tests/unit/web/[feature].test.ts`

### Pattern

```typescript
// tests/unit/web/factsController.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderFactsTable } from '@web/facts/operations/factsController';
import { initializeState, updateState } from '@web/facts/core/stateManager';

describe('renderFactsTable', () => {
    beforeEach(() => {
        // Reset state before each test
        initializeState();
        // Set up a minimal DOM
        document.body.innerHTML = '<div id="facts-table-container"></div>';
    });

    it('renders empty state when no facts', () => {
        renderFactsTable();
        const container = document.getElementById('facts-table-container')!;
        expect(container.innerHTML).toContain('No records');
    });

    it('renders rows for each fact', () => {
        updateState({
            facts: [
                { id: 1, date: '2026-01-01', amount: 100, description: 'Test' },
            ],
        } as any);
        renderFactsTable();
        const container = document.getElementById('facts-table-container')!;
        expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    });
});
```

### Mocking fetch

```typescript
import { vi } from 'vitest';

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ items: [], total: 0 }),
}));
```

### Coverage Thresholds

New feature code should aim for 80%+ line coverage. Legacy monoliths (dashboard, lists) have lower thresholds — don't decrease them.

---

## E2E Tests (Playwright)

**Run:**
```bash
npm run test:e2e             # headless Chromium + Mobile Safari
npm run test:e2e:headed      # with visible browser
npm run test:e2e -- --grep "My Feature"  # run specific tests
```

**Config:** `config/playwright.config.ts`
**Base URL:** `https://fbd.ikeniborn.ru` (test server — must be running)
**Auth:** stored in `tests/e2e/.auth/user.json` (global setup runs once)

**Location:** `tests/e2e/webapp/[feature].spec.ts`

### Pattern

```typescript
// tests/e2e/webapp/myfeature.spec.ts
import { test, expect } from '@playwright/test';

test.describe('My Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/myfeature');
        await page.waitForLoadState('networkidle');
    });

    test('shows items list', async ({ page }) => {
        // Wait for JS to populate the container
        await page.waitForSelector('#items-container table');
        const rows = await page.locator('#items-container tbody tr').count();
        expect(rows).toBeGreaterThan(0);
    });

    test('opens add modal', async ({ page }) => {
        await page.click('[data-action="add-item"]');
        await expect(page.locator('#modal_myfeature')).toBeVisible();
    });

    test('mobile layout', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });
        await page.goto('/myfeature');
        // Verify no horizontal overflow
        const scrollWidth = await page.evaluate(() =>
            document.documentElement.scrollWidth
        );
        expect(scrollWidth).toBeLessThanOrEqual(375);
    });
});
```

### Testing WebSocket Updates

```typescript
test('incremental update via WebSocket', async ({ page }) => {
    await page.goto('/facts');
    await page.waitForLoadState('networkidle');

    const initialCount = await page.locator('#facts-table-container tbody tr').count();

    // Trigger WS event via API (easier than simulating WS directly)
    await page.request.post('/api/v1/facts', {
        data: { amount: 999, date: '2026-01-01', description: 'E2E test' },
    });

    // Wait for table to update
    await page.waitForFunction(
        (prev) => document.querySelectorAll('#facts-table-container tbody tr').length > prev,
        initialCount,
        { timeout: 5000 }
    );
});
```

---

## What to Test

**Unit tests — good for:**
- State management logic (filters, pagination, selection)
- Pure transformation functions (formatCurrency, parseDate)
- API response parsing
- Table rendering with known state

**E2E tests — good for:**
- Full user flows (create → appears in list)
- Mobile viewport layout
- Modal open/close/submit
- WebSocket incremental updates
- Offline behavior (service worker)

**Skip testing:**
- Trivial wrappers (`() => fn()`)
- External library behavior (DaisyUI, Choices.js)
- CSS visual correctness (use screenshots manually)

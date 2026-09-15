/**
 * E2E Tests: Visual Regression Testing
 *
 * Tests visual consistency of critical UI components using Playwright screenshot comparison:
 * - Dashboard (desktop + mobile viewports)
 * - Transaction Modal (tabs, form states)
 * - Lists Page (empty state, with items)
 * - Mobile Navigation (bottom nav bar)
 *
 * Authentication: Uses storage state from global setup (tests/e2e/setup/auth.setup.ts)
 *
 * NOTE: First run creates baseline screenshots, subsequent runs compare against baseline
 * Baselines stored in: tests/e2e/webapp/test_visual_regression.spec.ts-snapshots/
 *
 * Update baselines: npm run test:e2e -- --update-snapshots
 */

import { test, expect } from '@playwright/test';

// Viewport sizes for responsive testing
const VIEWPORTS = {
  mobile: { width: 375, height: 667 },   // iPhone 12 mini
  desktop: { width: 1920, height: 1080 }, // Desktop
};

type Page = import('@playwright/test').Page;

/**
 * Wait for the FAB that matches the current viewport: the mobile #fab-btn
 * below 1024px, the desktop #desktop-fab-btn at 1024px and above. Call this
 * only after setViewportSize — the other button stays hidden by CSS.
 */
async function waitForVisibleFab(page: Page): Promise<void> {
  await expect(page.locator('#fab-btn:visible, #desktop-fab-btn:visible').first())
    .toBeVisible({ timeout: 10000 });
}

/**
 * Open the fact (transaction) modal through whichever FAB is visible:
 * desktop FAB opens a menu with an "Добавить факт" item, the mobile FAB
 * either opens the speed dial (on /) or triggers the page-context action.
 */
async function openFactModal(page: Page): Promise<void> {
  const desktopFab = page.locator('#desktop-fab-btn');
  if (await desktopFab.isVisible().catch(() => false)) {
    await desktopFab.click();
    await page.locator('#desktop-fab-wrapper button[aria-label="Добавить фактическую транзакцию"]')
      .click({ timeout: 5000 });
  } else {
    await page.locator('#fab-btn').click();
    const speedDial = page.locator('#fab-speed-dial-menu');
    if (await speedDial.isVisible({ timeout: 1500 }).catch(() => false)) {
      await speedDial.locator('button[aria-label="Добавить фактическую транзакцию"]').click();
    }
  }
  await expect(page.locator('dialog[open]').first()).toBeVisible({ timeout: 5000 });
}

test.describe('Visual Regression - Dashboard', () => {
  test.skip(!!process.env.CI, 'Visual baselines are local — *.png is gitignored, CI has no baselines');
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Close cookie consent if present
    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match dashboard screenshot on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await waitForVisibleFab(page);

    // Wait for lazy HTMX fragments to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Full page screenshot; user data sections are masked — their content
    // changes as other tests create transactions
    await expect(page).toHaveScreenshot('dashboard-desktop.png', {
      fullPage: true,
      maxDiffPixels: 100, // Allow minor rendering differences
      mask: [page.locator('#quick-stats'), page.locator('#account-balances'), page.locator('#recent-transactions'), page.locator('.navbar-end')],
    });
  });

  test('should match dashboard screenshot on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await waitForVisibleFab(page);

    // Wait for lazy HTMX fragments to settle
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('dashboard-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
      mask: [page.locator('#quick-stats'), page.locator('#account-balances'), page.locator('#recent-transactions'), page.locator('.navbar-end')],
    });
  });

  test('should match summary cards section', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Locate summary cards container
    const summaryCards = page.locator('.stats, [class*="summary"], [class*="card"]').first();
    const cardsVisible = await summaryCards.isVisible({ timeout: 3000 }).catch(() => false);

    if (cardsVisible) {
      await expect(summaryCards).toHaveScreenshot('dashboard-summary-cards.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Regression - Transaction Modal', () => {
  test.skip(!!process.env.CI, 'Visual baselines are local — *.png is gitignored, CI has no baselines');
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match empty transaction modal on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await waitForVisibleFab(page);

    await openFactModal(page);
    const modal = page.locator('dialog[open]').first();

    // Wait for modal animation
    await page.waitForTimeout(500);

    // Screenshot of empty modal; date inputs are prefilled with today
    await expect(modal).toHaveScreenshot('transaction-modal-empty-desktop.png', {
      maxDiffPixels: 100,
      mask: [modal.locator('input[type="date"], input[id*="date" i], input[name*="date" i]')],
    });
  });

  test('should match transaction modal with tabs', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await waitForVisibleFab(page);

    await openFactModal(page);
    const modal = page.locator('dialog[open]').first();

    // Check for tab navigation (Расход/Доход/Перевод)
    const tabs = modal.locator('button[role="tab"], .tabs button');
    const tabsCount = await tabs.count();

    if (tabsCount > 0) {
      // Screenshot with tabs visible
      await expect(modal).toHaveScreenshot('transaction-modal-with-tabs.png', {
        maxDiffPixels: 100,
      });

      // Switch to Income tab if exists
      const incomeTab = modal.locator('button:has-text("Доход")');
      const incomeTabVisible = await incomeTab.isVisible().catch(() => false);

      if (incomeTabVisible) {
        await incomeTab.click();
        await page.waitForTimeout(300);

        await expect(modal).toHaveScreenshot('transaction-modal-income-tab.png', {
          maxDiffPixels: 100,
        });
      }
    }
  });

  test('should match transaction modal on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await waitForVisibleFab(page);

    await openFactModal(page);
    const modal = page.locator('dialog[open]').first();

    // Wait for mobile layout adjustments
    await page.waitForTimeout(500);

    // Screenshot of mobile modal
    await expect(modal).toHaveScreenshot('transaction-modal-mobile.png', {
      maxDiffPixels: 100,
    });
  });
});

test.describe('Visual Regression - Lists Page', () => {
  test.skip(!!process.env.CI, 'Visual baselines are local — *.png is gitignored, CI has no baselines');
  test.beforeEach(async ({ page }) => {
    await page.goto('/lists');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match lists page on desktop', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Wait for page content to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Full page screenshot; list content is masked — other tests create and
    // delete shopping lists
    await expect(page).toHaveScreenshot('lists-page-desktop.png', {
      fullPage: true,
      maxDiffPixels: 100,
      mask: [page.locator('#lists-content'), page.locator('.navbar-end')],
    });
  });

  test('should match lists page on mobile', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Wait for mobile layout
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('lists-page-mobile.png', {
      fullPage: true,
      maxDiffPixels: 100,
      mask: [page.locator('#lists-content'), page.locator('.navbar-end')],
    });
  });

  test('should match empty state if no lists', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Check for empty state message
    const emptyState = page.locator('text=/нет списков|empty|создайте первый/i');
    const emptyStateVisible = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    if (emptyStateVisible) {
      const emptyContainer = emptyState.locator('..').locator('..');
      await expect(emptyContainer).toHaveScreenshot('lists-empty-state.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match list item card', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);

    // Look for first list item
    const listItem = page.locator('a[href^="/lists/"], .list-item, tr[data-list-id]').first();
    const itemVisible = await listItem.isVisible({ timeout: 3000 }).catch(() => false);

    if (itemVisible) {
      await expect(listItem).toHaveScreenshot('lists-item-card.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });
});

test.describe('Visual Regression - Mobile Navigation', () => {
  test.skip(!!process.env.CI, 'Visual baselines are local — *.png is gitignored, CI has no baselines');
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const acceptAllButton = page.locator('button:has-text("Принять все")');
    const isVisible = await acceptAllButton.isVisible({ timeout: 3000 }).catch(() => false);
    if (isVisible) {
      await acceptAllButton.click();
      await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
  });

  test('should match mobile bottom navigation bar', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Wait for bottom nav to render
    await page.waitForTimeout(1500);

    // Look for bottom navigation
    const bottomNav = page.locator('.btm-nav, [class*="bottom-nav"], nav[class*="fixed"]').first();
    const navVisible = await bottomNav.isVisible({ timeout: 3000 }).catch(() => false);

    if (navVisible) {
      await expect(bottomNav).toHaveScreenshot('mobile-bottom-nav.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match mobile navigation with active state', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Navigate to different page to see active state
    await page.goto('/facts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);

    const bottomNav = page.locator('.btm-nav, [class*="bottom-nav"]').first();
    const navVisible = await bottomNav.isVisible({ timeout: 3000 }).catch(() => false);

    if (navVisible) {
      await expect(bottomNav).toHaveScreenshot('mobile-bottom-nav-facts-active.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match mobile header on different pages', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // Test header on Facts page
    await page.goto('/facts');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const header = page.locator('header, .navbar, [class*="header"]').first();
    const headerVisible = await header.isVisible({ timeout: 3000 }).catch(() => false);

    if (headerVisible) {
      await expect(header).toHaveScreenshot('mobile-header-facts.png', {
        maxDiffPixels: 50,
      });

      // Test header on Plans page
      await page.goto('/plan');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);

      await expect(header).toHaveScreenshot('mobile-header-plans.png', {
        maxDiffPixels: 50,
      });
    } else {
      test.skip();
    }
  });

  test('should match FAB button states', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);

    // FAB button closed state
    const fabButton = page.locator('#fab-btn');
    await expect(fabButton).toBeVisible({ timeout: 5000 });

    // The round button's transparent corners show the page behind it —
    // allow corner noise from that background
    await expect(fabButton).toHaveScreenshot('fab-closed.png', {
      maxDiffPixels: 200,
    });

    // FAB button opened state (Speed Dial). Let async content settle first:
    // the AI menu item appears after /api/v1/ai/status resolves, and the page
    // data behind the translucent menu changes as other tests write records.
    await page.waitForLoadState('networkidle');
    await fabButton.click();
    await page.waitForTimeout(500);

    const speedDialMenu = page.locator('#fab-speed-dial-menu');
    const speedDialVisible = await speedDialMenu.isVisible({ timeout: 1000 }).catch(() => false);

    if (speedDialVisible) {
      // Screenshot of full Speed Dial menu
      const fabContainer = page.locator('#fab-btn, #fab-speed-dial-menu');
      await expect(fabContainer.first()).toHaveScreenshot('fab-speed-dial-open.png', {
        maxDiffPixels: 200,
        mask: [page.locator('#recent-transactions-card'), page.locator('#account-balances')],
      });
    }
  });
});

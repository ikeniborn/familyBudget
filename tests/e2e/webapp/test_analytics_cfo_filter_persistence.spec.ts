/**
 * E2E: /analytics page — saved account (CFO) filter is applied to the initial
 * chart data loads after reopening the page.
 *
 * Regression for the init race: loadCFOList() restored budgetCFOFilter from
 * localStorage asynchronously, while the initial load*Data() calls had already
 * fired without cfo_id — charts showed "all accounts" despite the select
 * displaying the saved account.
 *
 * Auth: storage state from global setup.
 */
import { test, expect } from '@playwright/test';

const DESKTOP = { width: 1280, height: 800 };

async function navigateToAnalytics(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/analytics');
    await page.waitForLoadState('domcontentloaded');
    const cookieBtn = page.locator('button:has-text("Принять все")');
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cookieBtn.click();
        await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
}

test.describe('Analytics CFO filter persistence', () => {
    test('initial chart loads include saved cfo_id from localStorage', async ({ page }) => {
        await page.setViewportSize(DESKTOP);

        // Pick a real financial center id via the authenticated API
        const resp = await page.request.get('/api/v1/financial-centers/?limit=1000');
        expect(resp.ok()).toBeTruthy();
        const data = await resp.json();
        const centers: Array<{ id: number }> = data.financial_centers || [];
        test.skip(centers.length === 0, 'No financial centers available for test user');
        const cfoId = centers[0].id;

        // Seed the saved filter before any page script runs (simulates reopening)
        await page.addInitScript((id: number) => {
            window.localStorage.setItem('budgetCFOFilter', String(id));
        }, cfoId);

        // Capture every analytics data request issued by the page
        const analyticsRequests: string[] = [];
        page.on('request', (req) => {
            if (req.url().includes('/api/v1/analytics/')) {
                analyticsRequests.push(req.url());
            }
        });

        await navigateToAnalytics(page);

        // Wait for the initial round of charts to render
        await page.locator('#chart-waterfall canvas').first().waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('#chart-plan-fact canvas').first().waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(1000);

        // The select must show the restored account
        await expect(page.locator('#cfo-filter')).toHaveValue(String(cfoId));

        // Every initial analytics request must carry the saved account filter
        expect(analyticsRequests.length).toBeGreaterThan(0);
        for (const url of analyticsRequests) {
            expect(url, `analytics request missing cfo_id: ${url}`).toContain(`cfo_id=${cfoId}`);
        }
    });
});

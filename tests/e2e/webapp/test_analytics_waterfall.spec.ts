/**
 * E2E: /analytics page — Waterfall chart shows transfers series in legend.
 *
 * Auth: storage state from global setup.
 */
import { test, expect } from '@playwright/test';

const VIEWPORTS = {
    mobile: { width: 375, height: 667 },
    tablet: { width: 768, height: 1024 },
    desktop: { width: 1280, height: 800 },
};

async function navigateToAnalytics(page: import('@playwright/test').Page): Promise<void> {
    await page.goto('/analytics');
    await page.waitForLoadState('domcontentloaded');
    const cookieBtn = page.locator('button:has-text("Принять все")');
    if (await cookieBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cookieBtn.click();
        await page.waitForSelector('#cookie-consent-banner', { state: 'hidden', timeout: 5000 });
    }
}

test.describe('Analytics Waterfall - transfers series', () => {
    test('legend contains Пополнение and Списание as lines (with_balance mode)', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        const chart = page.locator('#chart-waterfall canvas').first();
        await chart.waitFor({ state: 'visible', timeout: 10000 });

        const seriesInfo: Array<{ name: string; type: string }> = await page.evaluate(() => {
            const dom = document.getElementById('chart-waterfall');
            // @ts-expect-error global echarts
            const inst = window.echarts.getInstanceByDom(dom);
            const opt = inst.getOption();
            return (opt.series || []).map((s: { name: string; type: string }) => ({ name: s.name, type: s.type }));
        });

        const names = seriesInfo.map(s => s.name);
        expect(names).toContain('Пополнение');
        expect(names).toContain('Списание');

        const transfers = seriesInfo.filter(s => s.name === 'Пополнение' || s.name === 'Списание');
        for (const s of transfers) {
            expect(s.type).toBe('line');
        }
    });

    test('without_balance mode shows transfer series as lines', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        await page.locator('#chart-waterfall canvas').first().waitFor({ state: 'visible' });
        await page.locator('#waterfall-mode-without-balance').click();
        await page.waitForTimeout(500);

        const seriesInfo: Array<{ name: string; type: string }> = await page.evaluate(() => {
            const dom = document.getElementById('chart-waterfall');
            // @ts-expect-error global echarts
            const inst = window.echarts.getInstanceByDom(dom);
            const opt = inst.getOption();
            return (opt.series || []).map((s: { name: string; type: string }) => ({ name: s.name, type: s.type }));
        });

        const names = seriesInfo.map(s => s.name);
        expect(names).toContain('Пополнение');
        expect(names).toContain('Списание');

        const transfers = seriesInfo.filter(s => s.name === 'Пополнение' || s.name === 'Списание');
        for (const s of transfers) {
            expect(s.type).toBe('line');
        }
    });

    test('renders at mobile breakpoint', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.mobile);
        await navigateToAnalytics(page);
        await expect(page.locator('#chart-waterfall canvas').first()).toBeVisible({ timeout: 10000 });
    });

    test('renders at tablet breakpoint', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.tablet);
        await navigateToAnalytics(page);
        await expect(page.locator('#chart-waterfall canvas').first()).toBeVisible({ timeout: 10000 });
    });
});

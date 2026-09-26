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

/**
 * Wait until the waterfall chart has received its data (echarts option carries
 * a non-empty series) and return the series info. The canvas appears during the
 * loading state, before setOption — reading getOption() at that point yields
 * undefined, so canvas visibility alone is not enough.
 */
async function getWaterfallSeries(page: import('@playwright/test').Page): Promise<Array<{ name: string; type: string; yAxisIndex?: number }>> {
    await page.waitForFunction(() => {
        const dom = document.getElementById('chart-waterfall');
        // @ts-expect-error global echarts
        const inst = window.echarts.getInstanceByDom(dom);
        const opt = inst && inst.getOption();
        return !!(opt && Array.isArray(opt.series) && opt.series.length > 0);
    }, undefined, { timeout: 15000 });

    return page.evaluate(() => {
        const dom = document.getElementById('chart-waterfall');
        // @ts-expect-error global echarts
        const inst = window.echarts.getInstanceByDom(dom);
        const opt = inst.getOption();
        return (opt.series || []).map((s: { name: string; type: string; yAxisIndex?: number }) => ({ name: s.name, type: s.type, yAxisIndex: s.yAxisIndex }));
    });
}

/** Positions of the waterfall value axes, in option order (bars first). */
async function getWaterfallAxisPositions(page: import('@playwright/test').Page): Promise<string[]> {
    return page.evaluate(() => {
        const dom = document.getElementById('chart-waterfall');
        // @ts-expect-error global echarts
        const inst = window.echarts.getInstanceByDom(dom);
        const yAxis = inst.getOption().yAxis || [];
        return yAxis.map((axis: { position?: string }) => axis.position ?? 'left');
    });
}

test.describe('Analytics Waterfall - transfers series', () => {
    test('legend contains Пополнение and Списание as lines (with_balance mode)', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        const chart = page.locator('#chart-waterfall canvas').first();
        await chart.waitFor({ state: 'visible', timeout: 10000 });

        const seriesInfo = await getWaterfallSeries(page);

        const names = seriesInfo.map(s => s.name);
        expect(names).toContain('Пополнение');
        expect(names).toContain('Списание');

        const transfers = seriesInfo.filter(s => s.name === 'Пополнение' || s.name === 'Списание');
        for (const s of transfers) {
            expect(s.type).toBe('line');
        }
    });

    test('bars use the left axis and transfer lines the right one', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        await page.locator('#chart-waterfall canvas').first().waitFor({ state: 'visible', timeout: 10000 });
        const seriesInfo = await getWaterfallSeries(page);

        expect(await getWaterfallAxisPositions(page)).toEqual(['left', 'right']);
        const bars = seriesInfo.filter(s => s.type === 'bar');
        expect(bars.length).toBeGreaterThan(0);
        for (const s of bars) {
            expect(s.yAxisIndex ?? 0).toBe(0);
        }
        const transfers = seriesInfo.filter(s => s.name === 'Пополнение' || s.name === 'Списание');
        expect(transfers).toHaveLength(2);
        for (const s of transfers) {
            expect(s.yAxisIndex).toBe(1);
        }
    });

    test('without_balance mode shows transfer series as lines', async ({ page }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await navigateToAnalytics(page);

        await page.locator('#chart-waterfall canvas').first().waitFor({ state: 'visible' });
        // Wait for the initial data before switching modes, so the click acts on a loaded chart
        await getWaterfallSeries(page);
        await page.locator('#waterfall-mode-without-balance').click();
        await page.waitForTimeout(500);

        const seriesInfo = await getWaterfallSeries(page);

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

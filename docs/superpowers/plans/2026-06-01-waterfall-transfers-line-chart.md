---
chain:
  intent: docs/superpowers/intents/2026-06-01-waterfall-transfers-line-chart-intent.md
  spec: docs/superpowers/specs/2026-06-01-waterfall-transfers-line-chart-design.md
review:
  plan_hash: 765376ec39554bfb
  spec_hash: 9026336ff3f17679
  last_run: 2026-06-01
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings: []
---
# Waterfall Transfers Line Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace bar-chart transfers series in `updateWaterfallChart()` with line series visible in both waterfall modes.

**Architecture:** Single-file surgical edit — swap `type: 'bar'` + `stack: 'flow'` + mode conditional for `type: 'line'` with per-mode data padding. No backend or API changes.

**Tech Stack:** ECharts (browser), Jinja2 template, Playwright E2E

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `frontend/web/templates/analytics.html` lines 1682–1697 | Replace bar series block with line series |
| Modify | `tests/e2e/webapp/test_analytics_waterfall.spec.ts` | Fix `without_balance` test — series must be present, not absent |

---

### Task 1: Update E2E test to reflect new behavior (TDD red step)

**Files:**
- Modify: `tests/e2e/webapp/test_analytics_waterfall.spec.ts`

The existing test `'without_balance mode hides transfer series'` asserts `.not.toContain('Пополнение')`. Per spec, transfers now render in **both** modes — so this assertion is wrong. Additionally, verify series type is `'line'` in `with_balance` mode.

- [ ] **Step 1: Replace the `without_balance` test**

Replace lines 44–62 in `tests/e2e/webapp/test_analytics_waterfall.spec.ts`:

```typescript
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
```

- [ ] **Step 2: Add type assertion to `with_balance` test**

Replace the existing `'legend contains Пополнение and Списание (with_balance mode)'` test body (lines 25–42) with:

```typescript
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
```

- [ ] **Step 3: Commit updated tests**

```bash
git add tests/e2e/webapp/test_analytics_waterfall.spec.ts
git commit -m "test(e2e): update waterfall transfers tests — lines visible in both modes"
```

---

### Task 2: Implement the series change in `analytics.html`

**Files:**
- Modify: `frontend/web/templates/analytics.html` lines 1682–1697

- [ ] **Step 1: Replace the bar series block**

In `frontend/web/templates/analytics.html`, replace lines 1682–1697:

```javascript
            ...(currentWaterfallMode === 'with_balance' ? [
                {
                    name: 'Пополнение',
                    type: 'bar',
                    stack: 'flow',
                    data: [0, ...transfersIn, 0],
                    itemStyle: { color: '#60a5fa' }
                },
                {
                    name: 'Списание',
                    type: 'bar',
                    stack: 'flow',
                    data: [0, ...transfersOut.map(x => -x), 0],
                    itemStyle: { color: '#fbbf24' }
                }
            ] : [])
```

with:

```javascript
            {
                name: 'Пополнение',
                type: 'line',
                smooth: true,
                data: currentWaterfallMode === 'with_balance' ? [0, ...transfersIn, 0] : transfersIn,
                lineStyle: { color: '#60a5fa', width: 2 },
                itemStyle: { color: '#60a5fa' },
                symbol: 'circle',
                symbolSize: 5
            },
            {
                name: 'Списание',
                type: 'line',
                smooth: true,
                data: currentWaterfallMode === 'with_balance' ? [0, ...transfersOut, 0] : transfersOut,
                lineStyle: { color: '#fbbf24', width: 2 },
                itemStyle: { color: '#fbbf24' },
                symbol: 'circle',
                symbolSize: 5
            }
```

Note: `transfersOut` is **not negated** — line shows real positive amounts (negation was a bar-chart convention).

- [ ] **Step 2: Commit the implementation**

```bash
git add frontend/web/templates/analytics.html
git commit -m "fix(analytics): render transfers as line chart in both waterfall modes"
```

---

### Task 3: Verify E2E tests pass

**Files:** none (verification only)

- [ ] **Step 1: Run the waterfall E2E tests**

```bash
cd tests && npm run test:e2e -- --grep "Analytics Waterfall"
```

Expected: all 4 tests PASS.

- [ ] **Step 2: Run full E2E suite for regression check**

```bash
cd tests && npm run test:e2e
```

Expected: no regressions.

- [ ] **Step 3: Manual browser verification**

Start dev server and navigate to `/analytics`. Check:
1. `with_balance` mode: Пополнение (blue line) and Списание (yellow line) overlay the waterfall bars
2. `without_balance` mode: both lines visible, data starts at index 0 (no leading zero pad)
3. Tooltip shows correct values for both series
4. Mobile (375px) and tablet (768px) render correctly

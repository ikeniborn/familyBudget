# Design: Waterfall Chart — Transfers as Line Chart

**Date:** 2026-06-01
**Status:** approved
**Intent:** `docs/superpowers/intents/2026-06-01-waterfall-transfers-line-chart-intent.md`

## Problem

In `updateWaterfallChart()` (`analytics.html`), the "Пополнение" (transfers_in) and "Списание" (transfers_out) series use `type: 'bar'` with `stack: 'flow'`. This creates two bar groups per X-axis value, expanding the horizontal axis beyond spec. In `without_balance` mode, both series are hidden entirely via an empty array spread.

## Solution

Replace both series with `type: 'line'`, remove `stack: 'flow'`, and move them outside the mode conditional so they render in both modes.

## Change — `analytics.html`, `updateWaterfallChart()`, series array

### Before (lines 1682–1697)

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

### After

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

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Remove `stack: 'flow'` | Stack caused separate bar groups per X value — the core bug |
| Series outside mode conditional | Both modes must show transfers per intent |
| `[0, ...data, 0]` padding in `with_balance` only | Aligns with Начало/Итого labels; `without_balance` has no padding labels |
| `transfersOut` not negated | Line shows real transfer amounts (positive); negation was a bar-chart convention to show below zero |
| `smooth: true` | Consistent with `chart-trends` line style in this codebase |
| Colors unchanged | `#60a5fa` Пополнение, `#fbbf24` Списание per IDD constraints |

## Invariants Preserved

- Waterfall main series (`stack: 'main'`) unchanged
- Tooltip formatter unchanged — already shows Пополнение/Списание as text
- `dataIndex` offset (+1 in `with_balance`) in click handler unchanged
- Backend `/api/v1/analytics/waterfall` unchanged — already returns `transfers_in`/`transfers_out` in all modes

## Scope

Single file: `frontend/web/templates/analytics.html`
Lines affected: 1682–1697 (replace ~16 lines with ~20 lines)
No backend changes required.

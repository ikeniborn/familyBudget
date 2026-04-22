/**
 * Regression guard for BUG-007 (2026-04-22): when the server broadcasts
 * `fact_deleted` / `plan_deleted`, the row must disappear from #recent-transactions
 * without a manual reload. The live bug (direct API DELETE from DevTools does
 * not update UI) is diagnosed on the test server via Playwright MCP; this test
 * locks in the invariant on the client side so a future refactor cannot drop it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve(
  __dirname,
  '../../../web/static/js/budget/incrementalUpdates.js'
);

interface IU {
  removeRecentTransaction: (id: number) => void;
  onFactDeleted: (data: { id: number }) => void;
  onPlanDeleted: (data: { id: number }) => void;
  fallbackRefresh: (w: string) => void;
  fallbackRefreshDebounced: (w: string) => void;
  _debounceTimers: Record<string, unknown>;
  _debounceDelay: number;
}

function loadIncrementalUpdates(): IU {
  const source = readFileSync(SRC, 'utf8');
  // The file is an IIFE that assigns `window.IncrementalUpdates`. Execute it
  // in the current realm so the happy-dom `window` gets the module installed.
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('window', source)(window);
  const iu = (window as any).IncrementalUpdates;
  if (!iu) throw new Error('window.IncrementalUpdates not set after load');
  return iu as IU;
}

describe('IncrementalUpdates — fact/plan deletion removes DOM row (BUG-007)', () => {
  let IU: IU;

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="recent-transactions">
        <table><tbody>
          <tr data-fact-id="8784"><td>row 8784</td></tr>
          <tr data-fact-id="8785"><td>row 8785</td></tr>
        </tbody></table>
      </div>
    `;
    (window as any).HTMXWidgets = { refreshWidget: vi.fn() };
    IU = loadIncrementalUpdates();
  });

  it('onFactDeleted removes the row with matching data-fact-id', () => {
    IU.onFactDeleted({ id: 8785 });

    expect(document.querySelector('tr[data-fact-id="8785"]')).toBeNull();
    expect(document.querySelector('tr[data-fact-id="8784"]')).not.toBeNull();
  });

  it('onPlanDeleted removes the row with matching data-fact-id', () => {
    IU.onPlanDeleted({ id: 8784 });

    expect(document.querySelector('tr[data-fact-id="8784"]')).toBeNull();
    expect(document.querySelector('tr[data-fact-id="8785"]')).not.toBeNull();
  });

  it('falls back to widget refresh when list empties after removal', () => {
    const refresh = (window as any).HTMXWidgets.refreshWidget as ReturnType<typeof vi.fn>;

    IU.onFactDeleted({ id: 8784 });
    IU.onFactDeleted({ id: 8785 });

    expect(refresh).toHaveBeenCalledWith('recent-transactions');
  });
});

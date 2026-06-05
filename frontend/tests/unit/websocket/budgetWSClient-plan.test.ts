/**
 * Source-level guards for legacy budgetWSClient.js (BUG-004, 2026-04-22).
 *
 * The file is a large IIFE-class loaded via <script>, not importable as a module,
 * so we assert invariants on the source text: one-time `plan_created` events must
 * NOT write to `recurringPlans`, since recurring plans arrive through a separate
 * `recurring_plan_created` broadcast (backend `budget_ws.py:1036`). Writing every
 * plan into `recurringPlans` was the root cause of the ghost recurring entries
 * reported on 2026-04-22 with plan_mode=regular.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const LEGACY_WS = resolve(
  __dirname,
  '../../../web/static/js/budget/budgetWSClient.js'
);

function extractMethod(source: string, name: string): string {
  // Match `    _handlePlanCreated(data) {` through the first `\n    }` (class-level 4-space indent).
  const pattern = new RegExp(
    `^    ${name}\\([^)]*\\)\\s*\\{([\\s\\S]*?)^    \\}`,
    'm'
  );
  const match = source.match(pattern);
  if (!match) throw new Error(`Method ${name} not found`);
  return match[0];
}

describe('budgetWSClient.js — plan_created must not populate recurringPlans (BUG-004)', () => {
  const source = readFileSync(LEGACY_WS, 'utf8');

  it('_handlePlanCreated does not unconditionally write to recurringPlans', () => {
    const body = extractMethod(source, '_handlePlanCreated');

    // Regression guard: the bug was an unconditional `recurringPlans.put(...)`.
    // The fix removes the write entirely OR gates it behind `recurring_plan_id`.
    const writesRecurring = /recurringPlans\s*\.\s*put\s*\(/.test(body);
    if (writesRecurring) {
      expect(body).toMatch(/recurring_plan_id/);
    } else {
      expect(writesRecurring).toBe(false);
    }
  });

  it('_handlePlanDeleted does not unconditionally delete from recurringPlans', () => {
    const body = extractMethod(source, '_handlePlanDeleted');

    // One-time plans live in budgetFacts, not recurringPlans. Deleting by id from
    // recurringPlans on every plan_deleted event risked collateral damage against
    // unrelated recurring rows that happen to share the primary key sequence.
    const deletesRecurring = /recurringPlans\s*\.\s*where\s*\(\s*['"]id['"]\s*\)/.test(body);
    if (deletesRecurring) {
      expect(body).toMatch(/recurring_plan_id/);
    } else {
      expect(deletesRecurring).toBe(false);
    }
  });

  it('handler still notifies UI handlers', () => {
    // Non-regression: we did not accidentally strip other side-effects.
    const created = extractMethod(source, '_handlePlanCreated');
    expect(created).toMatch(/_notifyHandlers\(\s*['"]plan_created['"]/);
  });
});

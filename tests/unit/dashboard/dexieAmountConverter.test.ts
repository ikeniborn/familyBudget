/**
 * Unit tests — toCents/fromCents amount converters (rubles ↔ kopecks).
 * Source: frontend/shared/db/dexie/core/database.ts
 *
 * Contract: all amounts persisted as integer cents to avoid float precision
 * issues; toCents uses Math.round() so float inputs round predictably.
 */
import { describe, it, expect } from 'vitest';

import { toCents, fromCents } from '@db/dexie/core/database';

describe('toCents / fromCents — rubles ↔ kopecks', () => {
  it('fromCents(1100) → 11.00 rubles', () => {
    expect(fromCents(1100)).toBe(11);
  });

  it('toCents(11.00) → 1100 kopecks', () => {
    expect(toCents(11.0)).toBe(1100);
  });

  it('roundtrips common amounts exactly', () => {
    const samples = [0, 0.01, 1, 1.23, 100.5, 1234.56, 999999.99];
    for (const rubles of samples) {
      expect(fromCents(toCents(rubles))).toBeCloseTo(rubles, 2);
    }
  });

  it('rounds float noise correctly (0.1 + 0.2)', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('handles zero and negative values (negative)', () => {
    expect(toCents(0)).toBe(0);
    expect(fromCents(0)).toBe(0);
    expect(toCents(-12.34)).toBe(-1234);
    expect(fromCents(-1234)).toBe(-12.34);
  });
});

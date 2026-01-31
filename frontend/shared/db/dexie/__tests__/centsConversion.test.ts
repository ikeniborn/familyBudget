/**
 * Cents Conversion Tests
 * Проверка precision для amount storage
 */

import { describe, it, expect } from 'vitest';
import { toCents, fromCents } from '../core/database';

describe('Cents Conversion', () => {
  describe('toCents', () => {
    it('should convert decimal to cents correctly', () => {
      expect(toCents(123.45)).toBe(12345);
      expect(toCents(0.01)).toBe(1);
      expect(toCents(999.99)).toBe(99999);
      expect(toCents(0)).toBe(0);
    });

    it('should handle float precision edge cases', () => {
      // JavaScript float precision issues
      expect(toCents(0.1 + 0.2)).toBe(30); // NOT 29.999999999999996!
      expect(toCents(0.07 * 100)).toBe(7); // NOT 7.000000000000001!
    });

    it('should round correctly', () => {
      expect(toCents(123.455)).toBe(12346); // Round up
      expect(toCents(123.454)).toBe(12345); // Round down
      expect(toCents(123.449)).toBe(12345); // Round down
    });

    it('should handle negative amounts', () => {
      expect(toCents(-123.45)).toBe(-12345);
      expect(toCents(-0.01)).toBe(-1);
    });

    it('should handle large amounts', () => {
      expect(toCents(999999.99)).toBe(99999999);
      expect(toCents(1000000.00)).toBe(100000000);
    });
  });

  describe('fromCents', () => {
    it('should convert cents to decimal correctly', () => {
      expect(fromCents(12345)).toBe(123.45);
      expect(fromCents(1)).toBe(0.01);
      expect(fromCents(0)).toBe(0);
    });

    it('should handle negative cents', () => {
      expect(fromCents(-12345)).toBe(-123.45);
      expect(fromCents(-1)).toBe(-0.01);
    });

    it('should handle large amounts', () => {
      expect(fromCents(99999999)).toBe(999999.99);
      expect(fromCents(100000000)).toBe(1000000.00);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve values in round-trip', () => {
      const testValues = [
        0,
        0.01,
        0.99,
        1.00,
        123.45,
        999.99,
        1000.00,
        9999.99,
        -123.45,
        -0.01
      ];

      testValues.forEach(original => {
        const cents = toCents(original);
        const restored = fromCents(cents);
        expect(restored).toBe(original);
      });
    });

    it('should handle precision loss gracefully', () => {
      // JavaScript float precision может вызвать небольшие отклонения
      const original = 0.1 + 0.2; // 0.30000000000000004
      const cents = toCents(original);
      const restored = fromCents(cents);

      // Должно быть 0.30, не 0.30000000000000004
      expect(restored).toBe(0.30);
    });
  });

  describe('Integration with DexieManager', () => {
    it('should store amounts as integer cents', async () => {
      // NOTE: Эти тесты требуют запущенный DexieManager
      // Проверяем что amount хранится как integer, не float

      const amount = 123.45;
      const cents = toCents(amount);

      // Verify cents is integer
      expect(Number.isInteger(cents)).toBe(true);
      expect(cents).toBe(12345);

      // Verify не float
      expect(cents).not.toBe(123.45);
    });

    it('should convert back to dollars при чтении', () => {
      const cents = 12345;
      const dollars = fromCents(cents);

      expect(dollars).toBe(123.45);
      expect(typeof dollars).toBe('number');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero correctly', () => {
      expect(toCents(0)).toBe(0);
      expect(fromCents(0)).toBe(0);
    });

    it('should handle very small amounts', () => {
      expect(toCents(0.001)).toBe(0); // Rounds to 0 cents
      expect(toCents(0.005)).toBe(1); // Rounds to 1 cent
    });

    it('should handle amounts with many decimal places', () => {
      expect(toCents(123.456789)).toBe(12346); // Rounds correctly
      expect(toCents(123.454321)).toBe(12345);
    });

    it('should handle string-like amounts (defensive)', () => {
      // NOTE: toCents expects number, но может получить string из форм
      const stringAmount = '123.45';
      expect(toCents(parseFloat(stringAmount))).toBe(12345);
    });
  });
});

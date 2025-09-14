/**
 * Comprehensive tests for periods management auto-generation functionality.
 * Tests utility functions for auto-generation of period names and date ranges.
 */
import { describe, it, expect } from 'vitest';

// Helper function to get Russian month abbreviation
function getMonthName(month: number): string {
  const months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                  'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
  return months[month - 1] || '';
}

// Generate period name from date
function generatePeriodName(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month] = dateStr.split('-');
  return `${year} ${getMonthName(parseInt(month))}`;
}

// Generate start and end dates for a month
function generateDateRange(dateStr: string): { start: Date, end: Date } {
  const [year, month] = dateStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // Last day of month
  return { start, end };
}

describe('Periods Auto-Generation Utility Functions', () => {
  describe('getMonthName Function', () => {
    it('returns correct Russian month abbreviations for all months', () => {
      expect(getMonthName(1)).toBe('Янв');
      expect(getMonthName(2)).toBe('Фев');
      expect(getMonthName(3)).toBe('Мар');
      expect(getMonthName(4)).toBe('Апр');
      expect(getMonthName(5)).toBe('Май');
      expect(getMonthName(6)).toBe('Июн');
      expect(getMonthName(7)).toBe('Июл');
      expect(getMonthName(8)).toBe('Авг');
      expect(getMonthName(9)).toBe('Сен');
      expect(getMonthName(10)).toBe('Окт');
      expect(getMonthName(11)).toBe('Ноя');
      expect(getMonthName(12)).toBe('Дек');
    });

    it('handles edge case months correctly', () => {
      // Test first month
      expect(getMonthName(1)).toBe('Янв');
      // Test last month
      expect(getMonthName(12)).toBe('Дек');
      // Test invalid month
      expect(getMonthName(0)).toBe('');
      expect(getMonthName(13)).toBe('');
      expect(getMonthName(-1)).toBe('');
    });

    it('handles non-integer inputs', () => {
      expect(getMonthName(1.5)).toBe('');
      expect(getMonthName(NaN)).toBe('');
    });
  });

  describe('generatePeriodName Function', () => {
    it('generates correct period names for all months', () => {
      expect(generatePeriodName('2025-01')).toBe('2025 Янв');
      expect(generatePeriodName('2025-02')).toBe('2025 Фев');
      expect(generatePeriodName('2025-03')).toBe('2025 Мар');
      expect(generatePeriodName('2025-04')).toBe('2025 Апр');
      expect(generatePeriodName('2025-05')).toBe('2025 Май');
      expect(generatePeriodName('2025-06')).toBe('2025 Июн');
      expect(generatePeriodName('2025-07')).toBe('2025 Июл');
      expect(generatePeriodName('2025-08')).toBe('2025 Авг');
      expect(generatePeriodName('2025-09')).toBe('2025 Сен');
      expect(generatePeriodName('2025-10')).toBe('2025 Окт');
      expect(generatePeriodName('2025-11')).toBe('2025 Ноя');
      expect(generatePeriodName('2025-12')).toBe('2025 Дек');
    });

    it('generates correct period names for different years', () => {
      expect(generatePeriodName('2023-06')).toBe('2023 Июн');
      expect(generatePeriodName('2024-12')).toBe('2024 Дек');
      expect(generatePeriodName('2025-01')).toBe('2025 Янв');
      expect(generatePeriodName('2026-08')).toBe('2026 Авг');
      expect(generatePeriodName('2020-03')).toBe('2020 Мар');
      expect(generatePeriodName('2030-11')).toBe('2030 Ноя');
    });

    it('handles edge cases correctly', () => {
      // Empty string
      expect(generatePeriodName('')).toBe('');
      // Undefined/null input
      expect(generatePeriodName(null as any)).toBe('');
      expect(generatePeriodName(undefined as any)).toBe('');
    });

    it('handles malformed date strings', () => {
      // Invalid format
      expect(generatePeriodName('2025')).toBe('2025 ');
      expect(generatePeriodName('invalid-date')).toBe('invalid '); // Month is invalid, so empty
      expect(generatePeriodName('2025-')).toBe('2025 ');
      expect(generatePeriodName('-01')).toBe(' Янв');
    });

    it('handles boundary months correctly', () => {
      // January (month 1)
      expect(generatePeriodName('2025-01')).toBe('2025 Янв');
      // December (month 12)
      expect(generatePeriodName('2025-12')).toBe('2025 Дек');
    });
  });

  describe('generateDateRange Function', () => {
    it('generates correct date ranges for months with 31 days', () => {
      // January
      const jan = generateDateRange('2025-01');
      expect(jan.start).toEqual(new Date(2025, 0, 1));
      expect(jan.end).toEqual(new Date(2025, 0, 31));

      // March
      const mar = generateDateRange('2025-03');
      expect(mar.start).toEqual(new Date(2025, 2, 1));
      expect(mar.end).toEqual(new Date(2025, 2, 31));

      // May
      const may = generateDateRange('2025-05');
      expect(may.start).toEqual(new Date(2025, 4, 1));
      expect(may.end).toEqual(new Date(2025, 4, 31));

      // July
      const jul = generateDateRange('2025-07');
      expect(jul.start).toEqual(new Date(2025, 6, 1));
      expect(jul.end).toEqual(new Date(2025, 6, 31));

      // August
      const aug = generateDateRange('2025-08');
      expect(aug.start).toEqual(new Date(2025, 7, 1));
      expect(aug.end).toEqual(new Date(2025, 7, 31));

      // October
      const oct = generateDateRange('2025-10');
      expect(oct.start).toEqual(new Date(2025, 9, 1));
      expect(oct.end).toEqual(new Date(2025, 9, 31));

      // December
      const dec = generateDateRange('2025-12');
      expect(dec.start).toEqual(new Date(2025, 11, 1));
      expect(dec.end).toEqual(new Date(2025, 11, 31));
    });

    it('generates correct date ranges for months with 30 days', () => {
      // April
      const apr = generateDateRange('2025-04');
      expect(apr.start).toEqual(new Date(2025, 3, 1));
      expect(apr.end).toEqual(new Date(2025, 3, 30));

      // June
      const jun = generateDateRange('2025-06');
      expect(jun.start).toEqual(new Date(2025, 5, 1));
      expect(jun.end).toEqual(new Date(2025, 5, 30));

      // September
      const sep = generateDateRange('2025-09');
      expect(sep.start).toEqual(new Date(2025, 8, 1));
      expect(sep.end).toEqual(new Date(2025, 8, 30));

      // November
      const nov = generateDateRange('2025-11');
      expect(nov.start).toEqual(new Date(2025, 10, 1));
      expect(nov.end).toEqual(new Date(2025, 10, 30));
    });

    it('handles February correctly in regular years', () => {
      // 2025 is not a leap year
      const feb2025 = generateDateRange('2025-02');
      expect(feb2025.start).toEqual(new Date(2025, 1, 1));
      expect(feb2025.end).toEqual(new Date(2025, 1, 28));

      // 2023 is not a leap year
      const feb2023 = generateDateRange('2023-02');
      expect(feb2023.start).toEqual(new Date(2023, 1, 1));
      expect(feb2023.end).toEqual(new Date(2023, 1, 28));
    });

    it('handles February correctly in leap years', () => {
      // 2024 is a leap year
      const feb2024 = generateDateRange('2024-02');
      expect(feb2024.start).toEqual(new Date(2024, 1, 1));
      expect(feb2024.end).toEqual(new Date(2024, 1, 29));

      // 2020 is a leap year
      const feb2020 = generateDateRange('2020-02');
      expect(feb2020.start).toEqual(new Date(2020, 1, 1));
      expect(feb2020.end).toEqual(new Date(2020, 1, 29));

      // 2028 is a leap year
      const feb2028 = generateDateRange('2028-02');
      expect(feb2028.start).toEqual(new Date(2028, 1, 1));
      expect(feb2028.end).toEqual(new Date(2028, 1, 29));
    });

    it('handles century leap years correctly', () => {
      // 2000 is a leap year (divisible by 400)
      const feb2000 = generateDateRange('2000-02');
      expect(feb2000.start).toEqual(new Date(2000, 1, 1));
      expect(feb2000.end).toEqual(new Date(2000, 1, 29));

      // 1900 is not a leap year (divisible by 100 but not 400)
      const feb1900 = generateDateRange('1900-02');
      expect(feb1900.start).toEqual(new Date(1900, 1, 1));
      expect(feb1900.end).toEqual(new Date(1900, 1, 28));
    });

    it('generates correct start dates for all months', () => {
      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const range = generateDateRange(`2025-${monthStr}`);
        expect(range.start.getDate()).toBe(1);
        expect(range.start.getMonth()).toBe(month - 1); // JavaScript months are 0-indexed
        expect(range.start.getFullYear()).toBe(2025);
      }
    });

    it('validates end dates are correct for each month', () => {
      const expectedDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

      for (let month = 1; month <= 12; month++) {
        const monthStr = month.toString().padStart(2, '0');
        const range = generateDateRange(`2025-${monthStr}`);

        expect(range.end.getDate()).toBe(expectedDays[month - 1]);
        expect(range.end.getMonth()).toBe(month - 1);
        expect(range.end.getFullYear()).toBe(2025);
      }
    });

    it('handles different years correctly', () => {
      // Test various years
      const years = [2020, 2023, 2024, 2025, 2026, 2030];

      for (const year of years) {
        const range = generateDateRange(`${year}-06`);
        expect(range.start).toEqual(new Date(year, 5, 1));
        expect(range.end).toEqual(new Date(year, 5, 30));
      }
    });
  });

  describe('Integration Tests', () => {
    it('period name and date range are consistent', () => {
      const testCases = [
        '2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
        '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
        '2024-02', '2023-06', '2026-12'
      ];

      for (const dateStr of testCases) {
        const periodName = generatePeriodName(dateStr);
        const dateRange = generateDateRange(dateStr);

        // Verify that the generated period name contains the year
        const year = dateStr.split('-')[0];
        expect(periodName).toContain(year);

        // Verify that the date range is within the same year and month
        const month = parseInt(dateStr.split('-')[1]) - 1; // JavaScript months are 0-indexed

        expect(dateRange.start.getFullYear()).toBe(parseInt(year));
        expect(dateRange.start.getMonth()).toBe(month);
        expect(dateRange.end.getFullYear()).toBe(parseInt(year));
        expect(dateRange.end.getMonth()).toBe(month);
      }
    });

    it('handles complete workflow for period creation', () => {
      const dateInput = '2025-07';

      // Step 1: Generate period name
      const periodName = generatePeriodName(dateInput);
      expect(periodName).toBe('2025 Июл');

      // Step 2: Generate date range
      const { start, end } = generateDateRange(dateInput);

      // Step 3: Verify consistency
      expect(start).toEqual(new Date(2025, 6, 1)); // July 1st, 2025
      expect(end).toEqual(new Date(2025, 6, 31)); // July 31st, 2025

      // Step 4: Verify date range spans entire month
      const daysDifference = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDifference).toBe(30); // July has 31 days, so difference is 30
    });

    it('maintains data consistency across leap year transitions', () => {
      const leapYearFeb = '2024-02';
      const regularYearFeb = '2025-02';

      // Leap year February
      const leapPeriodName = generatePeriodName(leapYearFeb);
      const leapRange = generateDateRange(leapYearFeb);
      expect(leapPeriodName).toBe('2024 Фев');
      expect(leapRange.end.getDate()).toBe(29);

      // Regular year February
      const regularPeriodName = generatePeriodName(regularYearFeb);
      const regularRange = generateDateRange(regularYearFeb);
      expect(regularPeriodName).toBe('2025 Фев');
      expect(regularRange.end.getDate()).toBe(28);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('handles malformed date inputs gracefully', () => {
      const malformedInputs = ['', 'invalid', '2025', '2025-', '-02', '2025-13', '2025-00'];

      for (const input of malformedInputs) {
        // Should not throw errors
        expect(() => generatePeriodName(input)).not.toThrow();
        expect(() => generateDateRange(input)).not.toThrow();
      }
    });

    it('handles boundary values correctly', () => {
      // Test minimum and maximum reasonable years
      expect(generatePeriodName('1900-01')).toBe('1900 Янв');
      expect(generatePeriodName('2100-12')).toBe('2100 Дек');

      // Test boundary months
      expect(generatePeriodName('2025-01')).toBe('2025 Янв');
      expect(generatePeriodName('2025-12')).toBe('2025 Дек');
    });

    it('preserves immutability of date objects', () => {
      const range = generateDateRange('2025-05');
      const originalStart = new Date(range.start);
      const originalEnd = new Date(range.end);

      // Modify returned dates
      range.start.setDate(15);
      range.end.setDate(20);

      // Generate again and verify original behavior is preserved
      const newRange = generateDateRange('2025-05');
      expect(newRange.start).toEqual(originalStart);
      expect(newRange.end).toEqual(originalEnd);
    });
  });
});

describe('Periods Auto-Generation Business Logic', () => {
  describe('Period Name Format Requirements', () => {
    it('follows consistent naming convention', () => {
      // Test that all generated names follow "YYYY МЕС" format
      const testData = [
        { input: '2025-01', expected: /^2025 [А-Яа-я]{3}$/ },
        { input: '2024-12', expected: /^2024 [А-Яа-я]{3}$/ },
        { input: '2023-06', expected: /^2023 [А-Яа-я]{3}$/ },
      ];

      for (const { input, expected } of testData) {
        const result = generatePeriodName(input);
        expect(result).toMatch(expected);
      }
    });

    it('uses correct Cyrillic month abbreviations', () => {
      // Ensure all abbreviations are in Cyrillic script
      const cyrillicPattern = /[А-Яа-я]/;

      for (let month = 1; month <= 12; month++) {
        const monthName = getMonthName(month);
        expect(monthName).toMatch(cyrillicPattern);
        expect(monthName.length).toBe(3); // All abbreviations should be 3 characters
      }
    });
  });

  describe('Date Range Business Rules', () => {
    it('ensures complete month coverage', () => {
      // Every date range should cover the complete month
      const testMonths = ['2025-01', '2025-02', '2025-04', '2025-06'];

      for (const month of testMonths) {
        const { start, end } = generateDateRange(month);

        // Start should be first day of month
        expect(start.getDate()).toBe(1);

        // End should be last day of month
        const nextMonth = new Date(end.getFullYear(), end.getMonth() + 1, 1);
        const lastDay = new Date(nextMonth.getTime() - 1);
        expect(end.getDate()).toBe(lastDay.getDate());
      }
    });

    it('maintains temporal consistency', () => {
      // End date should always be after start date
      const testDates = ['2025-01', '2025-02', '2025-06', '2025-12'];

      for (const date of testDates) {
        const { start, end } = generateDateRange(date);
        expect(end.getTime()).toBeGreaterThan(start.getTime());
      }
    });
  });
});
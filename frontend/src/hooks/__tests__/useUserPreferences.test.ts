import { renderHook, act } from '@testing-library/react';
import { useUserPreferences } from '../useUserPreferences';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('useUserPreferences', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('loads default preferences when localStorage is empty', () => {
      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.preferences).toEqual({
        reportsViewMode: 'table',
        reportsChartType: 'plan_fact_bar',
        chartsExportFormat: 'png',
        chartsTheme: 'light',
        dashboardLayout: 'grid',
      });
    });

    it('loads saved preferences from localStorage', () => {
      const savedPreferences = {
        reportsViewMode: 'chart',
        reportsChartType: 'category_pie',
        chartsTheme: 'dark',
      };

      mockLocalStorage.setItem(
        'familyBudget_userPreferences',
        JSON.stringify(savedPreferences)
      );

      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.preferences).toEqual({
        reportsViewMode: 'chart',
        reportsChartType: 'category_pie',
        chartsExportFormat: 'png', // default value
        chartsTheme: 'dark',
        dashboardLayout: 'grid', // default value
      });
    });

    it('handles corrupted localStorage data gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockLocalStorage.setItem('familyBudget_userPreferences', 'invalid json');

      const { result } = renderHook(() => useUserPreferences());

      expect(result.current.preferences).toEqual({
        reportsViewMode: 'table',
        reportsChartType: 'plan_fact_bar',
        chartsExportFormat: 'png',
        chartsTheme: 'light',
        dashboardLayout: 'grid',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load user preferences:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('sets isLoading to false after initialization', async () => {
      const { result } = renderHook(() => useUserPreferences());

      // Wait for the effect to complete
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('getPreference', () => {
    it('returns preference value when it exists', () => {
      const { result } = renderHook(() => useUserPreferences());

      const viewMode = result.current.getPreference('reportsViewMode');
      expect(viewMode).toBe('table');
    });

    it('returns fallback value when preference does not exist', () => {
      const { result } = renderHook(() => useUserPreferences());

      const customSetting = result.current.getPreference('customSetting' as any, 'fallback');
      expect(customSetting).toBe('fallback');
    });

    it('returns default value when no fallback is provided', () => {
      const { result } = renderHook(() => useUserPreferences());

      const chartType = result.current.getPreference('reportsChartType');
      expect(chartType).toBe('plan_fact_bar');
    });
  });

  describe('setPreference', () => {
    it('updates single preference and saves to localStorage', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
      });

      expect(result.current.preferences.reportsViewMode).toBe('chart');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'familyBudget_userPreferences',
        JSON.stringify({
          reportsViewMode: 'chart',
          reportsChartType: 'plan_fact_bar',
          chartsExportFormat: 'png',
          chartsTheme: 'light',
          dashboardLayout: 'grid',
        })
      );
    });

    it('updates multiple preferences correctly', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
      });

      act(() => {
        result.current.setPreference('chartsTheme', 'dark');
      });

      expect(result.current.preferences).toMatchObject({
        reportsViewMode: 'chart',
        chartsTheme: 'dark',
      });
    });

    it('handles localStorage save errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockLocalStorage.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded');
      });

      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to save user preferences:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('savePreferences', () => {
    it('updates multiple preferences at once', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.savePreferences({
          reportsViewMode: 'chart',
          reportsChartType: 'category_pie',
          chartsTheme: 'dark',
        });
      });

      expect(result.current.preferences).toMatchObject({
        reportsViewMode: 'chart',
        reportsChartType: 'category_pie',
        chartsTheme: 'dark',
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'familyBudget_userPreferences',
        expect.stringContaining('"reportsViewMode":"chart"')
      );
    });

    it('merges new preferences with existing ones', () => {
      const { result } = renderHook(() => useUserPreferences());

      // Set initial preference
      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
      });

      // Update with partial preferences
      act(() => {
        result.current.savePreferences({
          chartsTheme: 'dark',
        });
      });

      expect(result.current.preferences).toMatchObject({
        reportsViewMode: 'chart', // preserved
        chartsTheme: 'dark', // updated
        reportsChartType: 'plan_fact_bar', // default preserved
      });
    });
  });

  describe('resetPreferences', () => {
    it('resets all preferences to defaults', () => {
      const { result } = renderHook(() => useUserPreferences());

      // Set some custom preferences
      act(() => {
        result.current.savePreferences({
          reportsViewMode: 'chart',
          chartsTheme: 'dark',
        });
      });

      // Reset to defaults
      act(() => {
        result.current.resetPreferences();
      });

      expect(result.current.preferences).toEqual({
        reportsViewMode: 'table',
        reportsChartType: 'plan_fact_bar',
        chartsExportFormat: 'png',
        chartsTheme: 'light',
        dashboardLayout: 'grid',
      });

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith(
        'familyBudget_userPreferences'
      );
    });

    it('handles reset errors gracefully', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      mockLocalStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.resetPreferences();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to reset preferences:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('exportPreferences', () => {
    it('exports preferences as JSON string', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
      });

      const exported = result.current.exportPreferences();
      const parsed = JSON.parse(exported);

      expect(parsed).toMatchObject({
        reportsViewMode: 'chart',
        reportsChartType: 'plan_fact_bar',
        chartsExportFormat: 'png',
        chartsTheme: 'light',
        dashboardLayout: 'grid',
      });
    });

    it('formats JSON with proper indentation', () => {
      const { result } = renderHook(() => useUserPreferences());

      const exported = result.current.exportPreferences();

      expect(exported).toContain('\n');
      expect(exported).toContain('  ');
    });
  });

  describe('importPreferences', () => {
    it('imports valid JSON preferences', () => {
      const { result } = renderHook(() => useUserPreferences());

      const importData = JSON.stringify({
        reportsViewMode: 'chart',
        chartsTheme: 'dark',
      });

      let importResult: boolean;
      act(() => {
        importResult = result.current.importPreferences(importData);
      });

      expect(importResult!).toBe(true);
      expect(result.current.preferences).toMatchObject({
        reportsViewMode: 'chart',
        chartsTheme: 'dark',
      });
    });

    it('rejects invalid JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useUserPreferences());

      let importResult: boolean;
      act(() => {
        importResult = result.current.importPreferences('invalid json');
      });

      expect(importResult!).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to import preferences:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('rejects non-object JSON', () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const { result } = renderHook(() => useUserPreferences());

      let importResult: boolean;
      act(() => {
        importResult = result.current.importPreferences('"string value"');
      });

      expect(importResult!).toBe(false);

      consoleErrorSpy.mockRestore();
    });

    it('rejects null JSON', () => {
      const { result } = renderHook(() => useUserPreferences());

      let importResult: boolean;
      act(() => {
        importResult = result.current.importPreferences('null');
      });

      expect(importResult!).toBe(false);
    });
  });

  describe('localStorage integration', () => {
    it('uses correct storage key', () => {
      const { result } = renderHook(() => useUserPreferences());

      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'familyBudget_userPreferences',
        expect.any(String)
      );
    });

    it('handles localStorage not available', () => {
      const originalLocalStorage = window.localStorage;
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const { result } = renderHook(() => useUserPreferences());

      // Should still work with default preferences
      expect(result.current.preferences).toBeDefined();

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
      });
    });
  });

  describe('type safety', () => {
    it('maintains type safety for known preference keys', () => {
      const { result } = renderHook(() => useUserPreferences());

      // These should not cause TypeScript errors
      const viewMode = result.current.getPreference('reportsViewMode');
      const chartType = result.current.getPreference('reportsChartType');
      
      act(() => {
        result.current.setPreference('reportsViewMode', 'chart');
        result.current.setPreference('chartsTheme', 'dark');
      });

      expect(viewMode).toBeDefined();
      expect(chartType).toBeDefined();
    });
  });
});
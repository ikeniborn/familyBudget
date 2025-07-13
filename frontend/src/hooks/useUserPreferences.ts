import { useState, useEffect, useCallback } from 'react';

interface UserPreferences {
  reportsViewMode: 'table' | 'chart';
  reportsChartType: string;
  chartsExportFormat: 'png' | 'svg';
  chartsTheme: 'light' | 'dark';
  dashboardLayout: 'grid' | 'list';
  [key: string]: any;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  reportsViewMode: 'table',
  reportsChartType: 'plan_fact_bar',
  chartsExportFormat: 'png',
  chartsTheme: 'light',
  dashboardLayout: 'grid',
};

const STORAGE_KEY = 'familyBudget_userPreferences';

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setPreferences(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      console.warn('Failed to load user preferences:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPreferences: Partial<UserPreferences>) => {
    try {
      const updated = { ...preferences, ...newPreferences };
      setPreferences(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save user preferences:', error);
    }
  }, [preferences]);

  // Get specific preference with fallback
  const getPreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    fallback?: UserPreferences[K]
  ): UserPreferences[K] => {
    return preferences[key] ?? fallback ?? DEFAULT_PREFERENCES[key];
  }, [preferences]);

  // Set specific preference
  const setPreference = useCallback(<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) => {
    savePreferences({ [key]: value });
  }, [savePreferences]);

  // Reset all preferences to defaults
  const resetPreferences = useCallback(() => {
    try {
      setPreferences(DEFAULT_PREFERENCES);
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to reset preferences:', error);
    }
  }, []);

  // Export preferences as JSON
  const exportPreferences = useCallback(() => {
    return JSON.stringify(preferences, null, 2);
  }, [preferences]);

  // Import preferences from JSON
  const importPreferences = useCallback((json: string) => {
    try {
      const imported = JSON.parse(json);
      if (typeof imported === 'object' && imported !== null) {
        savePreferences(imported);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  }, [savePreferences]);

  return {
    preferences,
    isLoading,
    getPreference,
    setPreference,
    savePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,
  };
}

export default useUserPreferences;
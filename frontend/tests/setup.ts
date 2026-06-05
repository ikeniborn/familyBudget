import { expect, afterEach, vi, beforeAll, beforeEach } from 'vitest';

// Global test constants
global.TEST_USER_ID = 1;
global.TEST_API_URL = 'http://localhost:8000';

// Mock window globals used by modules
global.DEBUG_MODE = false;
global.budgetWSClient = null;
global.debugLog = vi.fn(); // Mock debugLog for budgetWSClient

// Mock browser dialogs (not available in Happy-DOM)
global.alert = vi.fn();
global.confirm = vi.fn(() => true);

// Mock BudgetShared (DateInput + ArticleSelect dependencies)
global.BudgetShared = {
  CalendarWidget: class CalendarWidget {
    constructor(private config: any) {
      // Mock calendar widget - does nothing in tests
      // DateInput will render but calendar won't be interactive
    }
    destroy() {
      // Cleanup
    }
  },
  DateFormatter: {
    /**
     * Format ISO date (YYYY-MM-DD) to display format (DD.MM.YYYY)
     */
    formatForDisplay(isoDate: string): string {
      if (!isoDate) return '';
      const [year, month, day] = isoDate.split('-');
      return `${day}.${month}.${year}`;
    },

    /**
     * Validate display format (DD.MM.YYYY)
     */
    isValidDisplayFormat(value: string): boolean {
      const regex = /^\d{2}\.\d{2}\.\d{4}$/;
      if (!regex.test(value)) return false;

      const [day, month, year] = value.split('.').map(Number);
      const date = new Date(year, month - 1, day);

      return date.getFullYear() === year &&
             date.getMonth() === month - 1 &&
             date.getDate() === day;
    }
  },
  ChoicesCategoryTree: class ChoicesCategoryTree {
    private selector: string;
    private selectElement: HTMLSelectElement | null = null;
    private initialized: boolean = false;

    constructor(selector: string, private options: any) {
      this.selector = selector;
      // Initialize synchronously for tests
      // Try to find element immediately, but defer population if not found
      this.initialize();
    }

    private initialize() {
      if (this.initialized) return;

      // Find the select element (might be detached, retry later)
      this.selectElement = document.querySelector(this.selector);

      // If element not found, it might be detached - retry after microtask
      if (!this.selectElement) {
        // Schedule retry after element is likely in DOM
        Promise.resolve().then(() => this.initialize());
        return;
      }

      // Add mock options to the select
      if (this.selectElement) {
        // Clear existing options
        this.selectElement.innerHTML = '';

        // Add placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Выберите категорию';
        this.selectElement.appendChild(placeholderOption);

        // Add mock category options
        for (let i = 1; i <= 5; i++) {
          const option = document.createElement('option');
          option.value = String(i);
          option.textContent = `Category ${i}`;
          this.selectElement.appendChild(option);
        }
        this.initialized = true;
      }
    }

    updateType(type: string) {
      this.ensureInitialized();
      // Mock method - would normally reload options based on type
    }

    updateFinancialCenter(fcId: number | null) {
      this.ensureInitialized();
      // Mock method - would normally filter options
    }

    getValue() {
      this.ensureInitialized();
      if (!this.selectElement || !this.selectElement.value) {
        return null;
      }
      const value = parseInt(this.selectElement.value);
      return isNaN(value) ? null : value;
    }

    setValue(value: any) {
      this.ensureInitialized();
      if (this.selectElement) {
        this.selectElement.value = String(value);
      }
    }

    setChoiceByValue(value: string) {
      this.ensureInitialized();
      if (this.selectElement) {
        this.selectElement.value = value;
      }
    }

    private ensureInitialized() {
      if (!this.initialized) {
        this.initialize();
      }
    }

    destroy() {
      // Cleanup
    }
  }
};

// Mock console methods in tests (suppress noise)
beforeAll(() => {
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: console.warn,  // Keep warnings
    error: console.error  // Keep errors
  };
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});

import { expect, afterEach, vi, beforeAll, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';  // Mock IndexedDB globally

// Global test constants
global.TEST_USER_ID = 1;
global.TEST_API_URL = 'http://localhost:8000';

// Mock window globals used by modules
global.DEBUG_MODE = false;
global.offlineManager = null;
global.budgetWSClient = null;

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

// Enable fake timers for each test (for retry logic testing)
beforeEach(() => {
  vi.useFakeTimers();
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  vi.useRealTimers();
});

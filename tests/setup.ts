/**
 * Test setup file for dashboard tests
 * Configures testing environment, mocks, and utilities
 */
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock console methods to reduce noise in tests
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.error = vi.fn((...args) => {
  // Only show errors that aren't from expected test scenarios
  if (!args.some(arg => typeof arg === 'string' && (
    arg.includes('Warning:') ||
    arg.includes('Not implemented:') ||
    arg.includes('Test error:')
  ))) {
    originalConsoleError.apply(console, args);
  }
});

console.warn = vi.fn((...args) => {
  // Suppress common warnings during tests
  if (!args.some(arg => typeof arg === 'string' && (
    arg.includes('Warning:') ||
    arg.includes('Not implemented:')
  ))) {
    originalConsoleWarn.apply(console, args);
  }
});

// Mock window.matchMedia for responsive design tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Global test utilities
export const waitForAsync = (ms: number = 0) => new Promise(resolve => setTimeout(resolve, ms));

export const createMockApiResponse = <T>(data: T, success = true) => ({
  success,
  data,
  ...(success ? {} : { error: 'Mock API error' })
});

export const createMockAxiosResponse = <T>(data: T, status = 200) => ({
  data,
  status,
  statusText: status === 200 ? 'OK' : 'Error',
  headers: {},
  config: {},
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();
  sessionStorageMock.clear.mockClear();
});

// Global error boundary for tests
window.addEventListener('error', (event) => {
  if (event.error && event.error.message && event.error.message.includes('Test error:')) {
    // Suppress expected test errors
    event.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('Test error:')) {
    // Suppress expected test promise rejections
    event.preventDefault();
  }
});
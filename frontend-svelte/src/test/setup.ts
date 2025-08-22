import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock SvelteKit environment - set browser to true for testing
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: 'test'
}));

// Mock SvelteKit navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  preloadData: vi.fn(),
  preloadCode: vi.fn(),
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn(),
  pushState: vi.fn(),
  replaceState: vi.fn()
}));

// Mock SvelteKit stores
vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn(() => () => {})
  },
  navigating: {
    subscribe: vi.fn(() => () => {})
  },
  updated: {
    subscribe: vi.fn(() => () => {})
  }
}));

// Mock localStorage for browser environment tests
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver if needed
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Ensure DOM environment is properly set up for Svelte 5
Object.defineProperty(global, 'window', {
  value: globalThis.window,
  writable: true,
});

Object.defineProperty(global, 'document', {
  value: globalThis.document,
  writable: true,
});

// Force client-side environment for Svelte 5
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        SSR: false,
        MODE: 'test'
      }
    }
  },
  writable: true,
});

// Ensure we're not in server environment for Svelte components
globalThis.process = globalThis.process || {};
globalThis.process.env = globalThis.process.env || {};
globalThis.process.env.NODE_ENV = 'test';

// Mock CSS computedStyle for tests
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    position: 'absolute',
    pointerEvents: 'none',
    fontWeight: '800',
    borderRadius: '1rem'
  }),
  writable: true,
});

// Mock getBoundingClientRect for tests
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  left: 0,
  top: 0,
  width: 400,
  height: 300,
  right: 400,
  bottom: 300,
  x: 0,
  y: 0,
  toJSON: () => {}
}));
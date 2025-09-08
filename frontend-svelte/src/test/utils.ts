import { render, type RenderOptions, type RenderResult } from '@testing-library/svelte';
import { vi } from 'vitest';
import type { ComponentType } from 'svelte';

/**
 * Custom render function with common setup for Svelte components
 */
export function renderComponent<T extends Record<string, any>>(
  component: ComponentType,
  options?: RenderOptions<T>
): RenderResult<T> {
  return render(component, {
    props: {} as T,
    ...options,
  });
}

/**
 * Create a mock API response
 */
export function createMockApiResponse<T>(data: T, success = true) {
  return {
    data: success ? data : undefined,
    success,
    message: success ? undefined : 'Error occurred',
  };
}

/**
 * Create a mock axios response
 */
export function createMockAxiosResponse<T>(data: T, status = 200) {
  return {
    data,
    status,
    statusText: 'OK',
    headers: {},
    config: {},
  };
}

/**
 * Mock a Svelte store
 */
export function createMockStore<T>(initialValue: T) {
  let value = initialValue;
  const subscribers = new Set<(value: T) => void>();

  return {
    subscribe: vi.fn((fn: (value: T) => void) => {
      subscribers.add(fn);
      fn(value);
      return () => subscribers.delete(fn);
    }),
    set: vi.fn((newValue: T) => {
      value = newValue;
      subscribers.forEach(fn => fn(value));
    }),
    update: vi.fn((updater: (value: T) => T) => {
      value = updater(value);
      subscribers.forEach(fn => fn(value));
    }),
    get: () => value
  };
}

/**
 * Wait for async operations to complete
 */
export function waitForAsync() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Create a mock user object
 */
export function createMockUser(overrides?: Partial<{
  id: number;
  telegram_id: string;
  username: string;
  first_name: string;
  last_name: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}>) {
  return {
    id: 1,
    telegram_id: '123456789',
    username: 'testuser',
    first_name: 'Test',
    last_name: 'User',
    user_name: 'Test User',
    user_email: 'test@example.com',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

/**
 * Create a mock period object
 */
export function createMockPeriod() {
  return {
    id: 1,
    name: 'Test Period',
    start_date: '2024-01-01',
    end_date: '2024-12-31',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a mock nomenclature object
 */
export function createMockNomenclature() {
  return {
    id: 1,
    name: 'Test Category',
    description: 'Test category description',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a mock financial center object
 */
export function createMockFinancialCenter() {
  return {
    id: 1,
    name: 'Test Financial Center',
    description: 'Test financial center description',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create a mock cost center object
 */
export function createMockCostCenter() {
  return {
    id: 1,
    name: 'Test Cost Center',
    description: 'Test cost center description',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Mock form validation error
 */
export function createMockValidationError(field: string, message: string) {
  return {
    [field]: message
  };
}
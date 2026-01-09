/**
 * MSW (Mock Service Worker) setup for tests
 *
 * This file sets up the mock server for intercepting HTTP requests
 * during tests. It should be imported in vitest.config.ts as a setup file.
 */

import { setupServer } from 'msw/node';
import { handlers } from './mswHandlers';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Create mock server with handlers
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn' // Warn about requests not handled by MSW
  });
});

// Reset handlers after each test to ensure test isolation
afterEach(() => {
  server.resetHandlers();
});

// Clean up after all tests
afterAll(() => {
  server.close();
});

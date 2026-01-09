/**
 * MSW Server Setup for Node.js (Vitest)
 * Mock Service Worker for API mocking in integration tests
 */

import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with default handlers
export const server = setupServer(...handlers);

// Server lifecycle hooks
export function setupMockServer() {
    // Start server before all tests
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

    // Reset handlers after each test
    afterEach(() => server.resetHandlers());

    // Clean up after all tests
    afterAll(() => server.close());
}

/**
 * Integration Test: WebSocket Message Routing
 *
 * Tests full flow: WebSocket → handleServerMessage → dispatchEvent → handlers → UI
 * Phase 2: Event Handlers Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { connect, disconnect } from '@web/budget/budgetWSClient/core/connectionManager';
import { on, off } from '@web/budget/budgetWSClient/integration/eventRegistration';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';

// Mock dependencies
vi.mock('@web/budget/budgetWSClient/fallback/longPolling', () => ({
  startLongPolling: vi.fn(),
  stopLongPolling: vi.fn(),
}));

vi.mock('@web/budget/budgetWSClient/features/healthCheck', () => ({
  handlePongReceived: vi.fn(),
}));

vi.mock('@web/budget/budgetWSClient/multiTab/tabCoordination', () => ({
  broadcastWSEvent: vi.fn(),
}));

describe('WebSocket Message Routing (Integration)', () => {
  let mockWebSocket: any;
  let mockFetch: any;
  let mockOfflineManager: any;
  let mockListsManager: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset state
    WSState.resetState();

    // Mock WebSocket
    mockWebSocket = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
      readyState: 0,
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
    };

    (global.WebSocket as any) = vi.fn(() => mockWebSocket);
    (global.WebSocket as any).OPEN = 1;

    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ token: 'test-token-123' }),
    });
    global.fetch = mockFetch;

    // Mock offlineManager
    mockOfflineManager = {
      refreshUICallback: vi.fn(),
      handleOfflineEvent: vi.fn(),
    };
    (window as any).offlineManager = mockOfflineManager;

    // Mock listsManager
    mockListsManager = {
      addItemToUI: vi.fn(),
      updateItemInUI: vi.fn(),
      removeItemFromUI: vi.fn(),
      toggleItemCompletedInUI: vi.fn(),
    };
    (window as any).listsManager = mockListsManager;

    // Mock window.location
    (global as any).window = {
      location: {
        protocol: 'https:',
        host: 'localhost:8000',
      },
      offlineManager: mockOfflineManager,
      listsManager: mockListsManager,
    };

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    disconnect();
    delete (window as any).offlineManager;
    delete (window as any).listsManager;
    vi.clearAllMocks();
  });

  it('should route fact_created from WebSocket to handler and offlineManager', async () => {
    // Setup handler
    const handler = vi.fn();
    on('fact_created', handler);

    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate incoming message
    const message = {
      event: 'fact_created',
      data: { id: 123, amount: 1000, article_id: 5 },
      connection_id: 'conn-123',
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify handler called
    expect(handler).toHaveBeenCalledWith(message.data);

    // Verify offlineManager called
    expect(mockOfflineManager.refreshUICallback).toHaveBeenCalledWith('fact_created', message.data);

    // Verify connection ID updated
    const state = WSState.getState();
    expect(state.connectionId).toBe('conn-123');
  });

  it('should route item_created from WebSocket to handler and listsManager', async () => {
    // Setup handler
    const handler = vi.fn();
    on('item_created', handler);

    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate incoming message
    const message = {
      event: 'item_created',
      data: { id: 101, name: 'Milk', shopping_list_id: 5 },
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify handler called
    expect(handler).toHaveBeenCalledWith(message.data);

    // Verify listsManager called
    expect(mockListsManager.addItemToUI).toHaveBeenCalledWith(message.data);
  });

  it('should handle ping event and update lastServerPing', async () => {
    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    const beforePing = Date.now();

    // Simulate ping message
    const message = {
      event: 'ping',
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify lastServerPing updated
    const state = WSState.getState();
    expect(state.lastServerPing).toBeGreaterThanOrEqual(beforePing);
  });

  it('should handle offline event and call offlineManager', async () => {
    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate offline message
    const message = {
      event: 'offline',
      data: { reason: 'server_maintenance' },
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify offlineManager.handleOfflineEvent called
    expect(mockOfflineManager.handleOfflineEvent).toHaveBeenCalledWith(message.data);
  });

  it('should route multiple event types correctly', async () => {
    // Setup handlers
    const factHandler = vi.fn();
    const planHandler = vi.fn();
    const transferHandler = vi.fn();
    const itemHandler = vi.fn();

    on('fact_created', factHandler);
    on('plan_created', planHandler);
    on('transfer_created', transferHandler);
    on('item_created', itemHandler);

    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Send multiple messages
    const messages = [
      { event: 'fact_created', data: { id: 1 } },
      { event: 'plan_created', data: { id: 2 } },
      { event: 'transfer_created', data: { id: 3 } },
      { event: 'item_created', data: { id: 4 } },
    ];

    for (const message of messages) {
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage(
          new MessageEvent('message', {
            data: JSON.stringify(message),
          })
        );
      }
    }

    // Verify all handlers called
    expect(factHandler).toHaveBeenCalledWith({ id: 1 });
    expect(planHandler).toHaveBeenCalledWith({ id: 2 });
    expect(transferHandler).toHaveBeenCalledWith({ id: 3 });
    expect(itemHandler).toHaveBeenCalledWith({ id: 4 });

    // Verify offlineManager called for budget events
    expect(mockOfflineManager.refreshUICallback).toHaveBeenCalledTimes(3);
    expect(mockListsManager.addItemToUI).toHaveBeenCalledWith({ id: 4 });
  });

  it('should handle unknown event types gracefully', async () => {
    // Setup handler for custom event
    const handler = vi.fn();
    on('custom_event', handler);

    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate unknown event
    const message = {
      event: 'custom_event',
      data: { foo: 'bar' },
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify handler called
    expect(handler).toHaveBeenCalledWith(message.data);
  });

  it('should broadcast events to follower tabs when leader', async () => {
    const { broadcastWSEvent } = await import('@web/budget/budgetWSClient/multiTab/tabCoordination');

    // Set as leader
    WSState.updateState({ enabled: true, isLeader: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate message
    const message = {
      event: 'fact_created',
      data: { id: 123 },
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify broadcast called
    expect(broadcastWSEvent).toHaveBeenCalledWith('fact_created', { id: 123 });
  });

  it('should NOT broadcast when not leader', async () => {
    const { broadcastWSEvent } = await import('@web/budget/budgetWSClient/multiTab/tabCoordination');

    // Set as follower
    WSState.updateState({ enabled: true, isLeader: false });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate message
    const message = {
      event: 'fact_created',
      data: { id: 123 },
    };

    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: JSON.stringify(message),
        })
      );
    }

    // Verify broadcast NOT called
    expect(broadcastWSEvent).not.toHaveBeenCalled();
  });

  it('should handle malformed JSON gracefully', async () => {
    // Mock console.error to suppress error output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Start connection
    WSState.updateState({ enabled: true });
    await connect();
    await vi.runAllTimersAsync();

    // Simulate WebSocket open
    mockWebSocket.readyState = 1;
    if (mockWebSocket.onopen) {
      mockWebSocket.onopen(new Event('open'));
    }

    // Simulate malformed JSON
    if (mockWebSocket.onmessage) {
      mockWebSocket.onmessage(
        new MessageEvent('message', {
          data: '{invalid json}',
        })
      );
    }

    // Verify error logged
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});

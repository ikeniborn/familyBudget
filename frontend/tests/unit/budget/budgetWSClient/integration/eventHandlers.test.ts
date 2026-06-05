/**
 * Unit tests for Event Handlers
 *
 * Tests WebSocket event dispatching and integration with listsManager
 * Phase 2: Event Handlers Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handleFactCreated,
  handleFactUpdated,
  handleFactDeleted,
  handlePlanCreated,
  handlePlanUpdated,
  handlePlanDeleted,
  handleTransferCreated,
  handleTransferDeleted,
  handleItemCreated,
  handleItemUpdated,
  handleItemDeleted,
  handleItemCompleted,
  handleEvent,
  dispatchEvent,
} from '@web/budget/budgetWSClient/integration/eventHandlers';

import { on, off, removeAllHandlers } from '@web/budget/budgetWSClient/integration/eventRegistration';
import * as WSState from '@web/budget/budgetWSClient/core/WSState';

describe('Event Handlers', () => {
  let mockListsManager: any;

  beforeEach(() => {
    // Reset WSState
    WSState.resetState();

    // Mock listsManager
    mockListsManager = {
      addItemToUI: vi.fn(),
      updateItemInUI: vi.fn(),
      removeItemFromUI: vi.fn(),
      toggleItemCompletedInUI: vi.fn(),
    };

    // Attach to window
    (window as any).listsManager = mockListsManager;
  });

  afterEach(() => {
    removeAllHandlers();
    delete (window as any).listsManager;
    vi.clearAllMocks();
  });

  describe('Budget Fact Events', () => {
    it('should handle fact_created event', () => {
      const handler = vi.fn();
      on('fact_created', handler);

      const eventData = { id: 123, amount: 1000 };
      handleFactCreated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should handle fact_updated event', () => {
      const handler = vi.fn();
      on('fact_updated', handler);

      const eventData = { id: 123, amount: 1500 };
      handleFactUpdated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should handle fact_deleted event', () => {
      const handler = vi.fn();
      on('fact_deleted', handler);

      const eventData = { id: 123 };
      handleFactDeleted(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('Recurring Plan Events', () => {
    it('should handle plan_created event', () => {
      const handler = vi.fn();
      on('plan_created', handler);

      const eventData = { id: 456, name: 'Monthly Salary' };
      handlePlanCreated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should handle plan_updated event', () => {
      const handler = vi.fn();
      on('plan_updated', handler);

      const eventData = { id: 456, name: 'Monthly Rent' };
      handlePlanUpdated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should handle plan_deleted event', () => {
      const handler = vi.fn();
      on('plan_deleted', handler);

      const eventData = { id: 456 };
      handlePlanDeleted(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('Transfer Events', () => {
    it('should handle transfer_created event', () => {
      const handler = vi.fn();
      on('transfer_created', handler);

      const eventData = { id: 789, from_fc: 1, to_fc: 2, amount: 500 };
      handleTransferCreated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should handle transfer_deleted event', () => {
      const handler = vi.fn();
      on('transfer_deleted', handler);

      const eventData = { id: 789 };
      handleTransferDeleted(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('Shopping List Item Events', () => {
    it('should handle item_created event', () => {
      const handler = vi.fn();
      on('item_created', handler);

      const eventData = { id: 101, name: 'Milk', shopping_list_id: 5 };
      handleItemCreated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
      expect(mockListsManager.addItemToUI).toHaveBeenCalledWith(eventData);
    });

    it('should handle item_updated event', () => {
      const handler = vi.fn();
      on('item_updated', handler);

      const eventData = { id: 101, name: 'Bread', shopping_list_id: 5 };
      handleItemUpdated(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
      expect(mockListsManager.updateItemInUI).toHaveBeenCalledWith(eventData);
    });

    it('should handle item_deleted event', () => {
      const handler = vi.fn();
      on('item_deleted', handler);

      const eventData = { id: 101, shopping_list_id: 5 };
      handleItemDeleted(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
      expect(mockListsManager.removeItemFromUI).toHaveBeenCalledWith(101, 5);
    });

    it('should handle item_completed event', () => {
      const handler = vi.fn();
      on('item_completed', handler);

      const eventData = { id: 101, is_completed: true, shopping_list_id: 5 };
      handleItemCompleted(eventData as any);

      expect(handler).toHaveBeenCalledWith(eventData);
      expect(mockListsManager.toggleItemCompletedInUI).toHaveBeenCalledWith(101, true, 5);
    });
  });

  describe('dispatchEvent() routing', () => {
    it('should route fact_created to handleFactCreated', () => {
      const handler = vi.fn();
      on('fact_created', handler);

      const eventData = { id: 123 };
      dispatchEvent('fact_created', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should route plan_created to handlePlanCreated', () => {
      const handler = vi.fn();
      on('plan_created', handler);

      const eventData = { id: 456 };
      dispatchEvent('plan_created', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should route transfer_created to handleTransferCreated', () => {
      const handler = vi.fn();
      on('transfer_created', handler);

      const eventData = { id: 789 };
      dispatchEvent('transfer_created', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
    });

    it('should route item_created to handleItemCreated', () => {
      const handler = vi.fn();
      on('item_created', handler);

      const eventData = { id: 101 };
      dispatchEvent('item_created', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
      expect(mockListsManager.addItemToUI).toHaveBeenCalled();
    });

    it('should handle unknown event types', () => {
      const handler = vi.fn();
      on('custom_event', handler);

      const eventData = { foo: 'bar' };
      dispatchEvent('custom_event', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('handleEvent() for generic events', () => {
    it('should notify handlers for generic event', () => {
      const handler = vi.fn();
      on('custom_event', handler);

      const eventData = { foo: 'bar' };
      handleEvent('custom_event', eventData);

      expect(handler).toHaveBeenCalledWith(eventData);
    });
  });

  describe('listsManager integration', () => {
    it('should call addItemToUI for item_created', () => {
      const eventData = { id: 101, name: 'Milk' };
      handleItemCreated(eventData as any);

      expect(mockListsManager.addItemToUI).toHaveBeenCalledWith(eventData);
    });

    it('should call updateItemInUI for item_updated', () => {
      const eventData = { id: 101, name: 'Bread' };
      handleItemUpdated(eventData as any);

      expect(mockListsManager.updateItemInUI).toHaveBeenCalledWith(eventData);
    });

    it('should call removeItemFromUI for item_deleted', () => {
      const eventData = { id: 101, shopping_list_id: 5 };
      handleItemDeleted(eventData as any);

      expect(mockListsManager.removeItemFromUI).toHaveBeenCalledWith(101, 5);
    });

    it('should call toggleItemCompletedInUI for item_completed', () => {
      const eventData = { id: 101, is_completed: true, shopping_list_id: 5 };
      handleItemCompleted(eventData as any);

      expect(mockListsManager.toggleItemCompletedInUI).toHaveBeenCalledWith(101, true, 5);
    });

    it('should not crash if listsManager is undefined', () => {
      delete (window as any).listsManager;

      expect(() => {
        handleItemCreated({ id: 101 } as any);
        handleItemUpdated({ id: 101 } as any);
        handleItemDeleted({ id: 101, shopping_list_id: 5 } as any);
        handleItemCompleted({ id: 101, is_completed: true, shopping_list_id: 5 } as any);
      }).not.toThrow();
    });
  });

  describe('Multiple handlers', () => {
    it('should call all registered handlers for an event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      on('fact_created', handler1);
      on('fact_created', handler2);
      on('fact_created', handler3);

      const eventData = { id: 123 };
      handleFactCreated(eventData as any);

      expect(handler1).toHaveBeenCalledWith(eventData);
      expect(handler2).toHaveBeenCalledWith(eventData);
      expect(handler3).toHaveBeenCalledWith(eventData);
    });

    it('should remove specific handler with off()', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      on('fact_created', handler1);
      on('fact_created', handler2);

      off('fact_created', handler1);

      const eventData = { id: 123 };
      handleFactCreated(eventData as any);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(eventData);
    });
  });

  describe('Handler error resilience', () => {
    it('should continue calling other handlers if one throws', () => {
      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error');
      });
      const handler2 = vi.fn();

      on('fact_created', handler1);
      on('fact_created', handler2);

      // Mock console.error to suppress error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const eventData = { id: 123 };
      handleFactCreated(eventData as any);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(eventData);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

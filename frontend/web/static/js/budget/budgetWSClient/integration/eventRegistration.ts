/**
 * Event Registration Module
 * Implements on/off/notify API for event handlers
 *
 * Extracted from budgetWSClient.js:1876-1916 (HANDLER REGISTRATION)
 */

import { getState, updateState } from '../core/WSState';

/** Event handler function type */
export type EventHandler = (data: unknown) => void;

/**
 * Register event handler
 */
export function on(event: string, handler: EventHandler): void {
  const state = getState();
  const handlers = { ...state.handlers };

  if (!handlers[event]) {
    handlers[event] = [];
  }

  handlers[event].push(handler);
  updateState({ handlers });
}

/**
 * Remove event handler
 */
export function off(event: string, handler: EventHandler): void {
  const state = getState();
  const handlers = { ...state.handlers };

  if (!handlers[event]) {
    return;
  }

  handlers[event] = handlers[event].filter((h) => h !== handler);
  updateState({ handlers });
}

/**
 * Notify handlers for event
 */
export function notifyHandlers(event: string, data: unknown): void {
  const state = getState();
  const handlers = state.handlers[event];

  if (!handlers) {
    return;
  }

  for (const handler of handlers) {
    try {
      handler(data);
    } catch (error) {
      console.error('[BudgetWS] Handler error:', error);
    }
  }
}

/**
 * Remove all handlers for event
 */
export function removeAllHandlers(event?: string): void {
  if (event) {
    const state = getState();
    const handlers = { ...state.handlers };
    delete handlers[event];
    updateState({ handlers });
  } else {
    // Remove all handlers
    updateState({ handlers: {} });
  }
}

/**
 * Get handlers for event
 */
export function getHandlers(event?: string): Record<string, EventHandler[]> | EventHandler[] {
  const state = getState();
  if (event) {
    return state.handlers[event] || [];
  }
  return state.handlers;
}

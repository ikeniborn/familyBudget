/**
 * Unit tests for ModalListenerManager
 * Tests the encapsulated AbortController pattern for managing event listeners in edit modals
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ModalListenerManager', () => {
    let ModalListenerManager: {
        registerListener: (element: HTMLElement, eventName: string, handler: EventListener) => void;
        abort: () => void;
    };

    beforeEach(() => {
        // Create ModalListenerManager instance (IIFE pattern)
        ModalListenerManager = (function() {
            let abortController: AbortController | null = null;

            return {
                registerListener(element: HTMLElement, eventName: string, handler: EventListener) {
                    if (abortController) {
                        abortController.abort();
                    }
                    abortController = new AbortController();
                    element.addEventListener(eventName, handler, { signal: abortController.signal });
                },
                abort() {
                    if (abortController) {
                        abortController.abort();
                        abortController = null;
                    }
                }
            };
        })();
    });

    describe('registerListener', () => {
        it('should register event listener on element', () => {
            const element = document.createElement('select');
            const handler = vi.fn();

            ModalListenerManager.registerListener(element, 'change', handler);

            element.dispatchEvent(new Event('change'));
            expect(handler).toHaveBeenCalledTimes(1);
        });

        it('should abort previous listener when registering new one', () => {
            const element = document.createElement('select');
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            // Register first listener
            ModalListenerManager.registerListener(element, 'change', handler1);
            element.dispatchEvent(new Event('change'));
            expect(handler1).toHaveBeenCalledTimes(1);

            // Register second listener (should abort first)
            ModalListenerManager.registerListener(element, 'change', handler2);
            element.dispatchEvent(new Event('change'));

            // First handler should not be called again (aborted)
            expect(handler1).toHaveBeenCalledTimes(1);
            // Second handler should be called
            expect(handler2).toHaveBeenCalledTimes(1);
        });

        it('should handle multiple sequential registrations', () => {
            const element = document.createElement('select');
            const handlers = [vi.fn(), vi.fn(), vi.fn()];

            // Register 3 listeners sequentially
            handlers.forEach(handler => {
                ModalListenerManager.registerListener(element, 'change', handler);
            });

            // Dispatch event
            element.dispatchEvent(new Event('change'));

            // Only last handler should be called
            expect(handlers[0]).not.toHaveBeenCalled();
            expect(handlers[1]).not.toHaveBeenCalled();
            expect(handlers[2]).toHaveBeenCalledTimes(1);
        });
    });

    describe('abort', () => {
        it('should abort current listener', () => {
            const element = document.createElement('select');
            const handler = vi.fn();

            ModalListenerManager.registerListener(element, 'change', handler);
            ModalListenerManager.abort();

            element.dispatchEvent(new Event('change'));
            expect(handler).not.toHaveBeenCalled();
        });

        it('should handle abort when no listener is registered', () => {
            // Should not throw error
            expect(() => ModalListenerManager.abort()).not.toThrow();
        });

        it('should allow re-registration after abort', () => {
            const element = document.createElement('select');
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            ModalListenerManager.registerListener(element, 'change', handler1);
            ModalListenerManager.abort();

            ModalListenerManager.registerListener(element, 'change', handler2);
            element.dispatchEvent(new Event('change'));

            expect(handler1).not.toHaveBeenCalled();
            expect(handler2).toHaveBeenCalledTimes(1);
        });
    });

    describe('Memory Leak Prevention', () => {
        it('should not accumulate listeners on repeated modal open/close', () => {
            const element = document.createElement('select');
            let callCount = 0;

            // Simulate opening modal 100 times
            for (let i = 0; i < 100; i++) {
                ModalListenerManager.registerListener(element, 'change', () => {
                    callCount++;
                });
            }

            // Dispatch event - should only trigger last listener
            element.dispatchEvent(new Event('change'));
            expect(callCount).toBe(1);
        });
    });
});

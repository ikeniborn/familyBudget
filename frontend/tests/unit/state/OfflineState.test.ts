import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getState,
  updateState,
  resetState,
  initializeState,
  createInitialState,
  type OfflineManagerState,
  type PendingOperation,
  type SyncResult
} from '@web/offline/offlineManager/core/OfflineState';

// TODO: Enable when offlineManager is migrated to modular structure (Phase 2.1-2.5)
describe.skip('OfflineState', () => {
  const mockDb = {
    init: vi.fn(),
    addFact: vi.fn(),
    getAllFacts: vi.fn()
  };

  beforeEach(() => {
    // Reset state before each test
    initializeState(mockDb);
  });

  describe('createInitialState', () => {
    it('should create initial state with db reference', () => {
      const state = createInitialState(mockDb);

      expect(state.db).toBe(mockDb);
    });

    it('should create initial state with correct sync status defaults', () => {
      const state = createInitialState(mockDb);

      // Sync status
      expect(state.syncInProgress).toBe(false);
      expect(state.isInitialized).toBe(false);
    });

    it('should create initial state with correct retry configuration defaults', () => {
      const state = createInitialState(mockDb);

      // Retry configuration
      expect(state.retryDelay).toBe(5000); // 5 seconds
      expect(state.maxRetries).toBe(3);
      expect(state.retryTimeout).toBeNull();
    });

    it('should create initial state with correct toast debouncing defaults', () => {
      const state = createInitialState(mockDb);

      // Toast debouncing
      expect(state.lastToastTime).toBe(0);
      expect(state.toastDebounceMs).toBe(5000); // 5 seconds
      expect(state.lastOfflineToastTime).toBe(0);
    });

    it('should create initial state with correct navigation detection defaults', () => {
      const state = createInitialState(mockDb);

      // Navigation detection
      expect(state.isNavigating).toBe(false);
      expect(state.navigationTimeout).toBeNull();
    });

    it('should create initial state with empty pending operations map', () => {
      const state = createInitialState(mockDb);

      // Pending operations
      expect(state.pendingCreates).toBeInstanceOf(Map);
      expect(state.pendingCreates.size).toBe(0);
    });

    it('should create initial state with correct network detection defaults', () => {
      const state = createInitialState(mockDb);

      // Network detection
      expect(state.networkDetector).toBeNull();
      expect(state.isFirstRequest).toBe(true);
      expect(state.firstRequestTimeout).toBe(8000); // 8 seconds
      expect(state.normalTimeout).toBe(5000); // 5 seconds
      expect(state.optimizedTimeout).toBe(3000); // 3 seconds
    });
  });

  describe('initializeState', () => {
    it('should initialize state with db reference', () => {
      // State already initialized in beforeEach
      const state = getState();

      expect(state.db).toBe(mockDb);
      expect(state.syncInProgress).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return initialized state', () => {
      const state = getState();

      expect(state).toBeDefined();
      expect(state.db).toBe(mockDb);
      expect(state.syncInProgress).toBe(false);
    });
  });

  describe('updateState', () => {
    it('should update sync status', () => {
      updateState({
        syncInProgress: true,
        isInitialized: true
      });

      const state = getState();
      expect(state.syncInProgress).toBe(true);
      expect(state.isInitialized).toBe(true);
    });

    it('should update retry configuration', () => {
      const timeout = setTimeout(() => {}, 1000);
      updateState({
        retryDelay: 10000,
        maxRetries: 5,
        retryTimeout: timeout
      });

      const state = getState();
      expect(state.retryDelay).toBe(10000);
      expect(state.maxRetries).toBe(5);
      expect(state.retryTimeout).toBe(timeout);

      clearTimeout(timeout);
    });

    it('should update toast timestamps', () => {
      const now = Date.now();
      updateState({
        lastToastTime: now,
        lastOfflineToastTime: now - 1000
      });

      const state = getState();
      expect(state.lastToastTime).toBe(now);
      expect(state.lastOfflineToastTime).toBe(now - 1000);
    });

    it('should update toast debounce configuration', () => {
      updateState({ toastDebounceMs: 3000 });

      const state = getState();
      expect(state.toastDebounceMs).toBe(3000);
    });

    it('should update navigation detection state', () => {
      const timeout = setTimeout(() => {}, 500);
      updateState({
        isNavigating: true,
        navigationTimeout: timeout
      });

      const state = getState();
      expect(state.isNavigating).toBe(true);
      expect(state.navigationTimeout).toBe(timeout);

      clearTimeout(timeout);
    });

    it('should update pending creates map', () => {
      const pendingPromise = Promise.resolve({ id: 123 });
      const pendingCreates = new Map([
        ['temp-1', pendingPromise]
      ]);

      updateState({ pendingCreates });

      const state = getState();
      expect(state.pendingCreates.size).toBe(1);
      expect(state.pendingCreates.has('temp-1')).toBe(true);
      expect(state.pendingCreates.get('temp-1')).toBe(pendingPromise);
    });

    it('should update network detector reference', () => {
      const mockNetworkDetector = {
        isOnline: vi.fn().mockReturnValue(true),
        checkStatus: vi.fn()
      };

      updateState({ networkDetector: mockNetworkDetector });

      const state = getState();
      expect(state.networkDetector).toBe(mockNetworkDetector);
    });

    it('should update first request flag', () => {
      updateState({ isFirstRequest: false });

      const state = getState();
      expect(state.isFirstRequest).toBe(false);
    });

    it('should update timeout configurations', () => {
      updateState({
        firstRequestTimeout: 10000,
        normalTimeout: 7000,
        optimizedTimeout: 2000
      });

      const state = getState();
      expect(state.firstRequestTimeout).toBe(10000);
      expect(state.normalTimeout).toBe(7000);
      expect(state.optimizedTimeout).toBe(2000);
    });

    it('should preserve other fields when updating one field', () => {
      // Set up initial data
      updateState({
        syncInProgress: true,
        retryDelay: 10000,
        isFirstRequest: false
      });

      // Update only syncInProgress
      updateState({ syncInProgress: false });

      const state = getState();
      expect(state.syncInProgress).toBe(false);
      // Verify other fields preserved
      expect(state.retryDelay).toBe(10000);
      expect(state.isFirstRequest).toBe(false);
    });

    it('should handle multiple sequential updates', () => {
      updateState({ syncInProgress: true });
      updateState({ isInitialized: true });
      updateState({ retryDelay: 7000 });

      const state = getState();
      expect(state.syncInProgress).toBe(true);
      expect(state.isInitialized).toBe(true);
      expect(state.retryDelay).toBe(7000);
    });
  });

  describe('resetState', () => {
    it('should reset sync status to defaults', () => {
      updateState({
        syncInProgress: true,
        isInitialized: true
      });

      resetState(mockDb);

      const state = getState();
      expect(state.syncInProgress).toBe(false);
      expect(state.isInitialized).toBe(false);
    });

    it('should reset retry configuration to defaults', () => {
      const timeout = setTimeout(() => {}, 1000);
      updateState({
        retryDelay: 10000,
        maxRetries: 10,
        retryTimeout: timeout
      });

      resetState(mockDb);

      const state = getState();
      expect(state.retryDelay).toBe(5000);
      expect(state.maxRetries).toBe(3);
      expect(state.retryTimeout).toBeNull();

      clearTimeout(timeout);
    });

    it('should reset toast timestamps to defaults', () => {
      updateState({
        lastToastTime: Date.now(),
        lastOfflineToastTime: Date.now(),
        toastDebounceMs: 3000
      });

      resetState(mockDb);

      const state = getState();
      expect(state.lastToastTime).toBe(0);
      expect(state.lastOfflineToastTime).toBe(0);
      expect(state.toastDebounceMs).toBe(5000);
    });

    it('should reset navigation detection to defaults', () => {
      const timeout = setTimeout(() => {}, 500);
      updateState({
        isNavigating: true,
        navigationTimeout: timeout
      });

      resetState(mockDb);

      const state = getState();
      expect(state.isNavigating).toBe(false);
      expect(state.navigationTimeout).toBeNull();

      clearTimeout(timeout);
    });

    it('should clear pending creates map', () => {
      const pendingCreates = new Map([
        ['temp-1', Promise.resolve({ id: 1 })],
        ['temp-2', Promise.resolve({ id: 2 })]
      ]);

      updateState({ pendingCreates });
      resetState(mockDb);

      const state = getState();
      expect(state.pendingCreates.size).toBe(0);
    });

    it('should reset network detection to defaults', () => {
      const mockNetworkDetector = {
        isOnline: vi.fn(),
        checkStatus: vi.fn()
      };

      updateState({
        networkDetector: mockNetworkDetector,
        isFirstRequest: false,
        firstRequestTimeout: 12000,
        normalTimeout: 7000,
        optimizedTimeout: 2000
      });

      resetState(mockDb);

      const state = getState();
      expect(state.networkDetector).toBeNull();
      expect(state.isFirstRequest).toBe(true);
      expect(state.firstRequestTimeout).toBe(8000);
      expect(state.normalTimeout).toBe(5000);
      expect(state.optimizedTimeout).toBe(3000);
    });

    it('should preserve db reference', () => {
      const newDb = { differentMethod: vi.fn() };
      resetState(newDb);

      const state = getState();
      expect(state.db).toBe(newDb);
    });
  });

  describe('state consistency', () => {
    it('should reflect updates immediately in subsequent getState calls', () => {
      updateState({ syncInProgress: true });
      let state = getState();
      expect(state.syncInProgress).toBe(true);

      updateState({ syncInProgress: false });
      state = getState();
      expect(state.syncInProgress).toBe(false);
    });

    it('should maintain state consistency across multiple getState calls', () => {
      updateState({
        syncInProgress: true,
        retryDelay: 10000,
        isFirstRequest: false
      });

      const state1 = getState();
      const state2 = getState();

      expect(state1.syncInProgress).toBe(true);
      expect(state2.syncInProgress).toBe(true);
      expect(state1.retryDelay).toBe(10000);
      expect(state2.retryDelay).toBe(10000);
      expect(state1.isFirstRequest).toBe(false);
      expect(state2.isFirstRequest).toBe(false);
    });
  });

  describe('sync workflow simulation', () => {
    it('should simulate sync operation lifecycle', () => {
      // Initial state
      let state = getState();
      expect(state.syncInProgress).toBe(false);
      expect(state.isInitialized).toBe(false);

      // Initialize manager
      updateState({ isInitialized: true });
      state = getState();
      expect(state.isInitialized).toBe(true);

      // Start sync
      updateState({ syncInProgress: true });
      state = getState();
      expect(state.syncInProgress).toBe(true);

      // Add pending create to deduplication map
      const pendingPromise = Promise.resolve({ id: 123 });
      const pendingCreates = new Map([['temp-1', pendingPromise]]);
      updateState({ pendingCreates });
      state = getState();
      expect(state.pendingCreates.size).toBe(1);

      // Complete sync
      updateState({
        syncInProgress: false,
        pendingCreates: new Map() // Clear map
      });
      state = getState();
      expect(state.syncInProgress).toBe(false);
      expect(state.pendingCreates.size).toBe(0);
    });

    it('should simulate retry logic workflow', () => {
      // Initial state
      let state = getState();
      expect(state.retryTimeout).toBeNull();

      // First retry attempt (set timeout)
      const timeout1 = setTimeout(() => {}, 5000);
      updateState({ retryTimeout: timeout1 });
      state = getState();
      expect(state.retryTimeout).toBe(timeout1);

      // Clear timeout after successful retry
      clearTimeout(timeout1);
      updateState({ retryTimeout: null });
      state = getState();
      expect(state.retryTimeout).toBeNull();

      // Second retry with longer delay
      updateState({ retryDelay: 10000 });
      const timeout2 = setTimeout(() => {}, 10000);
      updateState({ retryTimeout: timeout2 });
      state = getState();
      expect(state.retryDelay).toBe(10000);
      expect(state.retryTimeout).toBe(timeout2);

      clearTimeout(timeout2);
    });

    it('should simulate toast debouncing workflow', () => {
      // Initial state
      let state = getState();
      expect(state.lastToastTime).toBe(0);

      // Show first toast
      const time1 = Date.now();
      updateState({ lastToastTime: time1 });
      state = getState();
      expect(state.lastToastTime).toBe(time1);

      // Attempt second toast within debounce period (should check against lastToastTime)
      const time2 = time1 + 2000; // 2 seconds later
      const timeSinceLastToast = time2 - state.lastToastTime;
      expect(timeSinceLastToast).toBeLessThan(state.toastDebounceMs);

      // Show toast after debounce period
      const time3 = time1 + 6000; // 6 seconds later (> 5s debounce)
      updateState({ lastToastTime: time3 });
      state = getState();
      expect(state.lastToastTime).toBe(time3);
    });

    it('should simulate network timeout selection logic', () => {
      // First request - use longer timeout
      let state = getState();
      expect(state.isFirstRequest).toBe(true);
      const timeout1 = state.firstRequestTimeout; // 8000ms
      expect(timeout1).toBe(8000);

      // After first request - use normal timeout
      updateState({ isFirstRequest: false });
      state = getState();
      expect(state.isFirstRequest).toBe(false);
      const timeout2 = state.normalTimeout; // 5000ms
      expect(timeout2).toBe(5000);

      // Optimized mode - use shorter timeout
      const timeout3 = state.optimizedTimeout; // 3000ms
      expect(timeout3).toBe(3000);
    });

    it('should simulate navigation detection workflow', () => {
      // Initial state - not navigating
      let state = getState();
      expect(state.isNavigating).toBe(false);
      expect(state.navigationTimeout).toBeNull();

      // Start navigation detection
      const navTimeout = setTimeout(() => {}, 300);
      updateState({
        isNavigating: true,
        navigationTimeout: navTimeout
      });
      state = getState();
      expect(state.isNavigating).toBe(true);
      expect(state.navigationTimeout).toBe(navTimeout);

      // Navigation completed
      clearTimeout(navTimeout);
      updateState({
        isNavigating: false,
        navigationTimeout: null
      });
      state = getState();
      expect(state.isNavigating).toBe(false);
      expect(state.navigationTimeout).toBeNull();
    });
  });

  describe('pending creates deduplication', () => {
    it('should track multiple pending creates', () => {
      const promise1 = Promise.resolve({ id: 1 });
      const promise2 = Promise.resolve({ id: 2 });
      const promise3 = Promise.resolve({ id: 3 });

      const pendingCreates = new Map([
        ['temp-1', promise1],
        ['temp-2', promise2],
        ['temp-3', promise3]
      ]);

      updateState({ pendingCreates });

      const state = getState();
      expect(state.pendingCreates.size).toBe(3);
      expect(state.pendingCreates.get('temp-1')).toBe(promise1);
      expect(state.pendingCreates.get('temp-2')).toBe(promise2);
      expect(state.pendingCreates.get('temp-3')).toBe(promise3);
    });

    it('should allow removing completed creates from map', () => {
      const pendingCreates = new Map([
        ['temp-1', Promise.resolve({ id: 1 })],
        ['temp-2', Promise.resolve({ id: 2 })]
      ]);

      updateState({ pendingCreates });
      let state = getState();
      expect(state.pendingCreates.size).toBe(2);

      // Remove completed create
      const updatedMap = new Map(pendingCreates);
      updatedMap.delete('temp-1');
      updateState({ pendingCreates: updatedMap });

      state = getState();
      expect(state.pendingCreates.size).toBe(1);
      expect(state.pendingCreates.has('temp-1')).toBe(false);
      expect(state.pendingCreates.has('temp-2')).toBe(true);
    });
  });
});

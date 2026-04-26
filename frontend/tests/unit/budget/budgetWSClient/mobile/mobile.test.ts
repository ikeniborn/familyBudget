/**
 * Unit tests for Mobile Handling Modules
 *
 * Tests browser detection, wake recovery, and navigation detection
 * Phase 5: Mobile Handling (Verification)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Browser Detection
import {
  detectIOSDevice,
  needsLongerTimeout,
  detectBrowserType,
  getBrowserInfo,
} from '@web/budget/budgetWSClient/mobile/browserDetection';

// Wake Recovery
import {
  initWakeRecovery,
  performWakeHealthCheck,
  startHealthCheckInterval,
  stopHealthCheckInterval,
} from '@web/budget/budgetWSClient/mobile/wakeRecovery';

// Navigation Detection
import {
  startNavigationWindow,
  stopNavigationWindow,
  isInNavigationWindow,
  initNavigationDetection,
} from '@web/budget/budgetWSClient/mobile/navigationDetection';

import * as WSState from '@web/budget/budgetWSClient/core/WSState';

describe('Mobile Handling Modules', () => {
  let originalUserAgent: string;
  let originalPlatform: string;
  let originalMaxTouchPoints: number;
  let mockServiceWorker: any;

  beforeEach(() => {
    vi.useFakeTimers();

    // Reset state
    WSState.resetState();

    // Save original navigator properties
    originalUserAgent = navigator.userAgent;
    originalPlatform = navigator.platform;
    originalMaxTouchPoints = navigator.maxTouchPoints;

    // Mock WebSocket global constants
    vi.stubGlobal('WebSocket', vi.fn());
    (global.WebSocket as any).OPEN = 1;
    (global.WebSocket as any).CLOSED = 3;
    (global.WebSocket as any).CONNECTING = 0;
    (global.WebSocket as any).CLOSING = 2;

    // Mock ServiceWorker
    mockServiceWorker = {
      controller: {
        postMessage: vi.fn(),
      },
      addEventListener: vi.fn(),
    };
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      configurable: true,
      value: mockServiceWorker,
    });

    // Mock window/document events
    global.dispatchEvent = vi.fn();
    document.dispatchEvent = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    // Restore navigator properties
    Object.defineProperty(navigator, 'userAgent', {
      writable: true,
      configurable: true,
      value: originalUserAgent,
    });
    Object.defineProperty(navigator, 'platform', {
      writable: true,
      configurable: true,
      value: originalPlatform,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: originalMaxTouchPoints,
    });
  });

  // ============================================================================
  // Browser Detection
  // ============================================================================

  describe('detectIOSDevice()', () => {
    it('should detect iPhone', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      });

      expect(detectIOSDevice()).toBe(true);
    });

    it('should detect iPad', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      });

      expect(detectIOSDevice()).toBe(true);
    });

    it('should detect iPod', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (iPod; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      });

      expect(detectIOSDevice()).toBe(true);
    });

    it('should detect iPadOS in desktop mode (MacIntel + touch)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      });
      Object.defineProperty(navigator, 'platform', {
        writable: true,
        configurable: true,
        value: 'MacIntel',
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 5,
      });

      expect(detectIOSDevice()).toBe(true);
    });

    it('should not detect Android', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36',
      });

      expect(detectIOSDevice()).toBe(false);
    });

    it('should not detect desktop MacOS (no touch)', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      });
      Object.defineProperty(navigator, 'platform', {
        writable: true,
        configurable: true,
        value: 'MacIntel',
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        writable: true,
        configurable: true,
        value: 0,
      });

      expect(detectIOSDevice()).toBe(false);
    });
  });

  describe('needsLongerTimeout()', () => {
    it('should return true for Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
      });

      expect(needsLongerTimeout()).toBe(true);
    });

    it('should return true for Yandex Browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 YaBrowser/21.6.0',
      });

      expect(needsLongerTimeout()).toBe(true);
    });

    it('should return false for Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
      });

      expect(needsLongerTimeout()).toBe(false);
    });

    it('should return false for Firefox', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
      });

      expect(needsLongerTimeout()).toBe(false);
    });
  });

  describe('detectBrowserType()', () => {
    it('should detect Safari', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
      });

      const browserType = detectBrowserType();
      expect(browserType.isSafari).toBe(true);
      expect(browserType.isChrome).toBe(false);
      expect(browserType.isFirefox).toBe(false);
    });

    it('should detect Chrome', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Safari/537.36',
      });

      const browserType = detectBrowserType();
      expect(browserType.isChrome).toBe(true);
      expect(browserType.isSafari).toBe(false);
      expect(browserType.isFirefox).toBe(false);
    });

    it('should detect Firefox', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
      });

      const browserType = detectBrowserType();
      expect(browserType.isFirefox).toBe(true);
      expect(browserType.isChrome).toBe(false);
      expect(browserType.isSafari).toBe(false);
    });

    it('should detect Edge', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
      });

      const browserType = detectBrowserType();
      expect(browserType.isEdge).toBe(true);
      expect(browserType.isChrome).toBe(false);
    });

    it('should detect Yandex Browser', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 YaBrowser/21.6.0',
      });

      const browserType = detectBrowserType();
      expect(browserType.isYandex).toBe(true);
    });

    it('should detect iOS device', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
      });

      const browserType = detectBrowserType();
      expect(browserType.isIOS).toBe(true);
    });
  });

  describe('getBrowserInfo()', () => {
    it('should return combined browser info', () => {
      Object.defineProperty(navigator, 'userAgent', {
        writable: true,
        configurable: true,
        value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15',
      });

      const browserInfo = getBrowserInfo();
      expect(browserInfo.isSafari).toBe(true);
      expect(browserInfo.needsLongerTimeout).toBe(true);
    });
  });

  // ============================================================================
  // Wake Recovery
  // ============================================================================

  describe('initWakeRecovery()', () => {
    it('should initialize ServiceWorker message listener', () => {
      initWakeRecovery();

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
    });

    it('should initialize beforeunload listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      initWakeRecovery();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });

    it('should initialize pagehide listener', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

      initWakeRecovery();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'pagehide',
        expect.any(Function)
      );
    });

    it('should initialize visibilitychange listener', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      initWakeRecovery();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });
  });

  describe('performWakeHealthCheck()', () => {
    let mockWebSocket: any;

    beforeEach(() => {
      mockWebSocket = {
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        readyState: 1,
        send: vi.fn(),
        close: vi.fn(),
      };
    });

    it('should dispatch wake-reconnect if connection stale (no WebSocket)', () => {
      WSState.updateState({
        ws: null,
        isConnected: false,
        lastServerPing: Date.now() - 100000, // Old ping
      });

      performWakeHealthCheck();

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:wake-reconnect',
        })
      );
    });

    it('should dispatch wake-reconnect if connection stale (WebSocket closed)', () => {
      mockWebSocket.readyState = 3; // CLOSED
      WSState.updateState({
        ws: mockWebSocket,
        isConnected: false,
      });

      performWakeHealthCheck();

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:wake-reconnect',
        })
      );
    });

    it('should dispatch wake-reconnect if last ping too old', () => {
      WSState.updateState({
        ws: mockWebSocket,
        isConnected: true,
        lastServerPing: Date.now() - 100000, // Way past PING_TIMEOUT
      });

      performWakeHealthCheck();

      expect(global.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:wake-reconnect',
        })
      );
    });

    it('should send ping if connection looks good', () => {
      WSState.updateState({
        ws: mockWebSocket,
        isConnected: true,
        lastServerPing: Date.now() - 1000, // Recent ping
      });

      performWakeHealthCheck();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ping' })
      );
    });

    it('should not crash if WebSocket send fails', () => {
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Send failed');
      });

      WSState.updateState({
        ws: mockWebSocket,
        isConnected: true,
        lastServerPing: Date.now() - 1000,
      });

      expect(() => performWakeHealthCheck()).not.toThrow();
    });

    it('should not send ping if no lastServerPing yet', () => {
      WSState.updateState({
        ws: mockWebSocket,
        isConnected: true,
        lastServerPing: null,
      });

      performWakeHealthCheck();

      // Should not dispatch wake-reconnect (connection not stale)
      expect(global.dispatchEvent).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ws:wake-reconnect',
        })
      );

      // Should send ping
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ping' })
      );
    });
  });

  describe('Health Check Interval', () => {
    it('should start health check interval', () => {
      startHealthCheckInterval();

      const state = WSState.getState();
      expect(state.healthCheckInterval).toBeDefined();
      expect(state.healthCheckInterval).not.toBeNull();
    });

    it('should stop health check interval', () => {
      startHealthCheckInterval();

      stopHealthCheckInterval();

      const state = WSState.getState();
      expect(state.healthCheckInterval).toBeNull();
    });

    it('should clear existing interval before starting new one', () => {
      startHealthCheckInterval();
      const firstInterval = WSState.getState().healthCheckInterval;

      startHealthCheckInterval();
      const secondInterval = WSState.getState().healthCheckInterval;

      expect(firstInterval).not.toBe(secondInterval);
    });
  });

  // ============================================================================
  // Navigation Detection
  // ============================================================================

  describe('startNavigationWindow()', () => {
    it('should set isNavigating flag', () => {
      startNavigationWindow();

      const state = WSState.getState();
      expect(state.isNavigating).toBe(true);
    });

    it('should set navigation timer', () => {
      startNavigationWindow();

      const state = WSState.getState();
      expect(state.navigationTimer).toBeDefined();
      expect(state.navigationTimer).not.toBeNull();
    });

    it('should clear isNavigating after NAVIGATION_WINDOW timeout', () => {
      const NAVIGATION_WINDOW = WSState.getState().NAVIGATION_WINDOW;

      startNavigationWindow();
      expect(WSState.getState().isNavigating).toBe(true);

      // Fast-forward to just before timeout
      vi.advanceTimersByTime(NAVIGATION_WINDOW - 1);
      expect(WSState.getState().isNavigating).toBe(true);

      // Fast-forward to timeout
      vi.advanceTimersByTime(1);
      expect(WSState.getState().isNavigating).toBe(false);
      expect(WSState.getState().navigationTimer).toBeNull();
    });

    it('should clear existing timer before starting new one', () => {
      startNavigationWindow();
      const firstTimer = WSState.getState().navigationTimer;

      startNavigationWindow();
      const secondTimer = WSState.getState().navigationTimer;

      expect(firstTimer).not.toBe(secondTimer);
    });
  });

  describe('stopNavigationWindow()', () => {
    it('should clear isNavigating flag', () => {
      startNavigationWindow();
      expect(WSState.getState().isNavigating).toBe(true);

      stopNavigationWindow();
      expect(WSState.getState().isNavigating).toBe(false);
    });

    it('should clear navigation timer', () => {
      startNavigationWindow();
      expect(WSState.getState().navigationTimer).not.toBeNull();

      stopNavigationWindow();
      expect(WSState.getState().navigationTimer).toBeNull();
    });

    it('should not throw if no timer is running', () => {
      expect(() => stopNavigationWindow()).not.toThrow();
    });
  });

  describe('isInNavigationWindow()', () => {
    afterEach(() => {
      // Ensure navigation window is stopped after each test
      stopNavigationWindow();
    });

    it('should return true when navigating', () => {
      startNavigationWindow();

      expect(isInNavigationWindow()).toBe(true);
    });

    it('should return false when not navigating', () => {
      // Explicitly set isNavigating to false (default is true after page load)
      WSState.updateState({ isNavigating: false });
      expect(isInNavigationWindow()).toBe(false);
    });
  });

  describe('initNavigationDetection()', () => {
    it('should start navigation window if page already loaded', () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        configurable: true,
        value: 'complete',
      });

      initNavigationDetection();

      expect(WSState.getState().isNavigating).toBe(true);
    });

    it('should wait for DOMContentLoaded if page loading', () => {
      Object.defineProperty(document, 'readyState', {
        writable: true,
        configurable: true,
        value: 'loading',
      });

      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      initNavigationDetection();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'DOMContentLoaded',
        expect.any(Function),
        { once: true }
      );
    });
  });
});

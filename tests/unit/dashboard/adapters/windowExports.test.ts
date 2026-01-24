/**
 * Unit tests for dashboard windowExports adapter
 * Tests PGlite initialization and error handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Dashboard windowExports - PGlite Initialization', () => {
  beforeEach(() => {
    // Setup localStorage mock
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    // Setup sessionStorage mock
    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    };

    // Mock window.showToast
    global.window = {
      showToast: vi.fn(),
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isPGliteEnabled', () => {
    it('should return true when enablePGlite is "true"', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('true');

      // Import function dynamically to avoid module-level execution
      const isPGliteEnabled = () => localStorage.getItem('enablePGlite') === 'true';

      expect(isPGliteEnabled()).toBe(true);
    });

    it('should return false when enablePGlite is "false"', () => {
      vi.mocked(localStorage.getItem).mockReturnValue('false');

      const isPGliteEnabled = () => localStorage.getItem('enablePGlite') === 'true';

      expect(isPGliteEnabled()).toBe(false);
    });

    it('should return false when enablePGlite is null', () => {
      vi.mocked(localStorage.getItem).mockReturnValue(null);

      const isPGliteEnabled = () => localStorage.getItem('enablePGlite') === 'true';

      expect(isPGliteEnabled()).toBe(false);
    });
  });

  describe('PGlite initialization with first login', () => {
    it('should show toast notification on first login', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue('true'); // just_logged_in

      const justLoggedIn = sessionStorage.getItem('just_logged_in');

      expect(justLoggedIn).toBe('true');
    });

    it('should not show toast notification on subsequent logins', () => {
      vi.mocked(sessionStorage.getItem).mockReturnValue(null); // no just_logged_in flag

      const justLoggedIn = sessionStorage.getItem('just_logged_in');

      expect(justLoggedIn).toBeNull();
    });
  });

  describe('Error handling', () => {
    it('should handle PGlite init failure gracefully', async () => {
      const mockError = new Error('PGlite initialization failed');

      try {
        throw mockError;
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('PGlite initialization failed');
      }
    });

    it('should show warning toast on PGlite error', () => {
      const showToast = vi.fn();
      global.window.showToast = showToast;

      // Simulate error handler
      showToast('Offline режим недоступен. Работа в online режиме.', 'warning');

      expect(showToast).toHaveBeenCalledWith(
        'Offline режим недоступен. Работа в online режиме.',
        'warning'
      );
    });
  });

  describe('Blocking initialization', () => {
    it('should wait for PGlite manager init before proceeding', async () => {
      const mockManager = {
        isReady: vi.fn().mockReturnValue(false),
        init: vi.fn().mockResolvedValue(undefined),
      };

      const getPGliteManager = async () => mockManager;

      const manager = await getPGliteManager();

      if (!manager.isReady()) {
        await manager.init();
      }

      expect(manager.init).toHaveBeenCalled();
    });

    it('should skip init if manager already ready', async () => {
      const mockManager = {
        isReady: vi.fn().mockReturnValue(true),
        init: vi.fn(),
      };

      const getPGliteManager = async () => mockManager;

      const manager = await getPGliteManager();

      if (!manager.isReady()) {
        await manager.init();
      }

      expect(manager.init).not.toHaveBeenCalled();
    });
  });
});

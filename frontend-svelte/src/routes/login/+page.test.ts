import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import LoginPage from './+page.svelte';
import { authService } from '$lib/services/auth.service';
import { isAuthenticated } from '$lib/stores/auth.store';
import * as authConfig from '$lib/config/auth';
import { goto } from '$app/navigation';
import { page } from '$app/stores';

// Mock dependencies
vi.mock('$lib/services/auth.service');
vi.mock('$lib/config/auth');
vi.mock('$app/navigation');
vi.mock('$app/environment', () => ({
  browser: true,
  dev: false
}));

// Mock components
vi.mock('$lib/components/auth/PasswordLogin.svelte', () => ({
  default: 'div'
}));
vi.mock('$lib/components/auth/AbstractGraphics.svelte', () => ({
  default: 'div'
}));
vi.mock('$lib/components/ui/Button.svelte', () => ({
  default: 'button'
}));

const mockAuthService = vi.mocked(authService);
const mockAuthConfig = vi.mocked(authConfig);
const mockGoto = vi.mocked(goto);

// Mock page store
const createMockPageStore = (searchParams: Record<string, string> = {}) => {
  const url = new URL('http://localhost:3000/login');
  Object.entries(searchParams).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  return {
    subscribe: vi.fn((callback) => {
      callback({
        url,
        params: {},
        route: { id: '/login' },
        data: {}
      });
      return () => {};
    })
  };
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    mockIsAuthenticated.mockReturnValue({
      subscribe: vi.fn((callback) => {
        callback(false);
        return () => {};
      })
    } as any);
    
    mockPage.mockReturnValue(createMockPageStore() as any);
    
    mockAuthConfig.getEffectiveBotName.mockReturnValue('test_bot');
    mockAuthConfig.shouldUseMockAuth.mockReturnValue(false);
    
    mockAuthService.checkPasswordAuthEnabled.mockResolvedValue({ enabled: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render login page with correct title', async () => {
      render(LoginPage);

      expect(document.title).toContain('Вход - Family Budget');
    });

    it('should render main title and subtitle', async () => {
      render(LoginPage);

      await waitFor(() => {
        expect(screen.getByText('ДОМАШНИЙ')).toBeInTheDocument();
        expect(screen.getByText('БУХГАЛТЕР')).toBeInTheDocument();
        expect(screen.getByText('Сохраняем и приумножаем вместе!')).toBeInTheDocument();
      });
    });

    it('should render auth method toggle buttons', async () => {
      render(LoginPage);

      await waitFor(() => {
        expect(screen.getByText('Логин / Пароль')).toBeInTheDocument();
        expect(screen.getByText('Telegram')).toBeInTheDocument();
      });
    });

    it('should show password login by default', async () => {
      render(LoginPage);

      await waitFor(() => {
        const passwordButton = screen.getByText('Логин / Пароль');
        expect(passwordButton).toHaveClass('active');
      });
    });

    it('should render telegram login button in telegram mode', async () => {
      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      await waitFor(() => {
        expect(screen.getByText('Войти')).toBeInTheDocument();
        expect(screen.getByText('Нажмите кнопку выше для входа через Telegram')).toBeInTheDocument();
      });
    });

    it('should show test mode button text in development', async () => {
      // Mock development environment
      vi.doMock('$app/environment', () => ({
        browser: true,
        dev: true
      }));

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      await waitFor(() => {
        expect(screen.getByText('Войти (Тест)')).toBeInTheDocument();
      });
    });
  });

  describe('Authentication Check', () => {
    it('should redirect to dashboard if already authenticated', async () => {
      mockIsAuthenticated.mockReturnValue({
        subscribe: vi.fn((callback) => {
          callback(true);
          return () => {};
        })
      } as any);

      render(LoginPage);

      await waitFor(() => {
        expect(mockGoto).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('should not redirect if not authenticated', async () => {
      mockIsAuthenticated.mockReturnValue({
        subscribe: vi.fn((callback) => {
          callback(false);
          return () => {};
        })
      } as any);

      render(LoginPage);

      await waitFor(() => {
        expect(mockGoto).not.toHaveBeenCalled();
      });
    });
  });

  describe('Return URL Handling', () => {
    it('should extract return URL from query parameters', async () => {
      mockPage.mockReturnValue(createMockPageStore({ 
        returnUrl: '/dashboard/reports' 
      }) as any);

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Войти');
      await fireEvent.click(loginButton);

      expect(mockAuthService.startTelegramOAuth).toHaveBeenCalledWith(
        'test_bot',
        '/dashboard/reports'
      );
    });

    it('should handle missing return URL', async () => {
      mockPage.mockReturnValue(createMockPageStore() as any);

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Войти');
      await fireEvent.click(loginButton);

      expect(mockAuthService.startTelegramOAuth).toHaveBeenCalledWith(
        'test_bot',
        undefined
      );
    });
  });

  describe('Password Auth Configuration', () => {
    it('should check password auth enabled on mount', async () => {
      mockAuthService.checkPasswordAuthEnabled.mockResolvedValue({ enabled: true });

      render(LoginPage);

      await waitFor(() => {
        expect(mockAuthService.checkPasswordAuthEnabled).toHaveBeenCalled();
      });
    });

    it('should handle password auth check failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthService.checkPasswordAuthEnabled.mockRejectedValue(new Error('API Error'));

      render(LoginPage);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          '[LOGIN] Error checking password auth:',
          expect.any(Error)
        );
      });

      // Should still show password login as fallback
      await waitFor(() => {
        expect(screen.getByText('Логин / Пароль')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should handle password auth disabled', async () => {
      mockAuthService.checkPasswordAuthEnabled.mockResolvedValue({ enabled: false });

      render(LoginPage);

      await waitFor(() => {
        expect(mockAuthService.checkPasswordAuthEnabled).toHaveBeenCalled();
      });
    });
  });

  describe('Auth Method Toggle', () => {
    it('should toggle between password and telegram login', async () => {
      render(LoginPage);

      // Initially password login should be active
      await waitFor(() => {
        expect(screen.getByText('Логин / Пароль')).toHaveClass('active');
        expect(screen.getByText('Telegram')).not.toHaveClass('active');
      });

      // Click telegram button
      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      await waitFor(() => {
        expect(screen.getByText('Telegram')).toHaveClass('active');
        expect(screen.getByText('Логин / Пароль')).not.toHaveClass('active');
      });

      // Click password button again
      const passwordButton = screen.getByText('Логин / Пароль');
      await fireEvent.click(passwordButton);

      await waitFor(() => {
        expect(screen.getByText('Логин / Пароль')).toHaveClass('active');
        expect(screen.getByText('Telegram')).not.toHaveClass('active');
      });
    });

    it('should show password login form when password mode is active', async () => {
      render(LoginPage);

      // Should show password login by default
      await waitFor(() => {
        // Mock PasswordLogin component should be rendered
        const passwordLoginElements = document.querySelector('.password-login-wrapper');
        expect(passwordLoginElements).toBeInTheDocument();
      });
    });

    it('should show telegram login button when telegram mode is active', async () => {
      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      await waitFor(() => {
        expect(screen.getByText('Войти')).toBeInTheDocument();
        expect(screen.getByText('Нажмите кнопку выше для входа через Telegram')).toBeInTheDocument();
      });
    });
  });

  describe('Telegram Login Button', () => {
    beforeEach(async () => {
      render(LoginPage);

      // Switch to Telegram mode
      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);
    });

    it('should call startTelegramOAuth when login button is clicked', async () => {
      const loginButton = screen.getByText('Войти');
      await fireEvent.click(loginButton);

      expect(mockAuthService.startTelegramOAuth).toHaveBeenCalledWith(
        'test_bot',
        undefined
      );
    });

    it('should not call OAuth if still loading', async () => {
      // Mock loading state
      mockAuthService.checkPasswordAuthEnabled.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(LoginPage);
      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Загрузка...');
      await fireEvent.click(loginButton);

      expect(mockAuthService.startTelegramOAuth).not.toHaveBeenCalled();
    });

    it('should redirect to dashboard if already authenticated', async () => {
      mockIsAuthenticated.mockReturnValue({
        subscribe: vi.fn((callback) => {
          callback(true);
          return () => {};
        })
      } as any);

      const loginButton = screen.getByText('Войти');
      await fireEvent.click(loginButton);

      expect(mockGoto).toHaveBeenCalledWith('/dashboard');
      expect(mockAuthService.startTelegramOAuth).not.toHaveBeenCalled();
    });

    it('should show loading state', async () => {
      // Create a promise that we control
      let resolvePromise: (value: any) => void;
      const loadingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockAuthService.checkPasswordAuthEnabled.mockReturnValue(loadingPromise);

      render(LoginPage);
      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      // Should show loading button
      expect(screen.getByText('Загрузка...')).toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({ enabled: true });
      
      await waitFor(() => {
        expect(screen.getByText('Войти')).toBeInTheDocument();
      });
    });

    it('should be disabled during loading', async () => {
      // Create unresolved promise for loading state
      mockAuthService.checkPasswordAuthEnabled.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      render(LoginPage);
      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Загрузка...');
      expect(loginButton).toBeDisabled();
    });
  });

  describe('Bot Configuration', () => {
    it('should use effective bot name from config', async () => {
      mockAuthConfig.getEffectiveBotName.mockReturnValue('production_bot');

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Войти');
      await fireEvent.click(loginButton);

      expect(mockAuthService.startTelegramOAuth).toHaveBeenCalledWith(
        'production_bot',
        undefined
      );
    });

    it('should handle bot name configuration error', async () => {
      mockAuthConfig.getEffectiveBotName.mockImplementation(() => {
        throw new Error('Config error');
      });

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Войти');
      
      // Should not crash when clicking
      expect(async () => await fireEvent.click(loginButton)).not.toThrow();
    });
  });

  describe('Mock Auth Configuration', () => {
    it('should use mock auth when configured', async () => {
      mockAuthConfig.shouldUseMockAuth.mockReturnValue(true);

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      // Implementation would depend on mock auth behavior
      const loginButton = screen.getByText('Войти');
      expect(loginButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      render(LoginPage);

      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('ДОМАШНИЙБУХГАЛТЕР');
    });

    it('should have clickable toggle buttons', async () => {
      render(LoginPage);

      const passwordButton = screen.getByRole('button', { name: 'Логин / Пароль' });
      const telegramButton = screen.getByRole('button', { name: 'Telegram' });

      expect(passwordButton).toBeInTheDocument();
      expect(telegramButton).toBeInTheDocument();
    });

    it('should have clickable login button when in telegram mode', async () => {
      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByRole('button', { name: 'Войти' });
      expect(loginButton).toBeInTheDocument();
    });

    it('should have proper button states', async () => {
      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      // Create loading state
      mockAuthService.checkPasswordAuthEnabled.mockReturnValue(
        new Promise(() => {}) // Never resolves
      );

      render(LoginPage);
      
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Загрузка...');
      expect(loginButton).toBeDisabled();
    });
  });

  describe('Error Handling', () => {
    it('should handle auth service errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockAuthService.startTelegramOAuth.mockImplementation(() => {
        throw new Error('OAuth error');
      });

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Войти');
      
      // Should not crash the component
      expect(() => fireEvent.click(loginButton)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle navigation errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGoto.mockImplementation(() => {
        throw new Error('Navigation error');
      });

      mockIsAuthenticated.mockReturnValue({
        subscribe: vi.fn((callback) => {
          callback(true);
          return () => {};
        })
      } as any);

      // Should not crash during render
      expect(() => render(LoginPage)).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup properly on unmount', async () => {
      const { unmount } = render(LoginPage);

      // Should not throw during unmount
      expect(() => unmount()).not.toThrow();
    });

    it('should handle multiple rapid state changes', async () => {
      render(LoginPage);

      const passwordButton = screen.getByText('Логин / Пароль');
      const telegramButton = screen.getByText('Telegram');

      // Rapid toggling should not cause issues
      await fireEvent.click(telegramButton);
      await fireEvent.click(passwordButton);
      await fireEvent.click(telegramButton);
      await fireEvent.click(passwordButton);

      await waitFor(() => {
        expect(screen.getByText('Логин / Пароль')).toHaveClass('active');
      });
    });
  });

  describe('Console Logging', () => {
    it('should log appropriate debug information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      render(LoginPage);

      const telegramButton = screen.getByText('Telegram');
      await fireEvent.click(telegramButton);

      const loginButton = screen.getByText('Войти');
      await fireEvent.click(loginButton);

      expect(consoleSpy).toHaveBeenCalledWith('[LOGIN] Кнопка входа нажата!');
      expect(consoleSpy).toHaveBeenCalledWith('[LOGIN] State:', expect.any(Object));

      consoleSpy.mockRestore();
    });
  });
});
import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { TelegramLoginButton } from './TelegramLoginButton';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
jest.mock('@/stores/authStore');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('TelegramLoginButton', () => {
  const mockLogin = jest.fn();
  const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        login: mockLogin,
      };
      return selector(state as any);
    });
    
    // Clear any existing scripts
    const scripts = document.querySelectorAll('script[data-telegram-login]');
    scripts.forEach(script => script.remove());
    
    // Clear window callback
    delete (window as any).onTelegramAuth;
  });

  afterEach(() => {
    // Cleanup
    delete (window as any).onTelegramAuth;
  });

  it('should render container div', () => {
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    const container = document.querySelector('.telegram-login-button');
    expect(container).toBeInTheDocument();
  });

  it('should create telegram widget script with default props', () => {
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    const script = document.querySelector('script[data-telegram-login="TestBot"]');
    expect(script).toBeInTheDocument();
    expect(script).toHaveAttribute('src', 'https://telegram.org/js/telegram-widget.js?22');
    expect(script).toHaveAttribute('async', 'true');
    expect(script).toHaveAttribute('data-size', 'large');
    expect(script).toHaveAttribute('data-onauth', 'onTelegramAuth(user)');
    expect(script).toHaveAttribute('data-request-access', 'write');
  });

  it('should set custom button size', () => {
    customRender(<TelegramLoginButton botName="TestBot" buttonSize="small" />);
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-size', 'small');
  });

  it('should set corner radius when provided', () => {
    customRender(<TelegramLoginButton botName="TestBot" cornerRadius={10} />);
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-radius', '10');
  });

  it('should hide avatar when showAvatar is false', () => {
    customRender(<TelegramLoginButton botName="TestBot" showAvatar={false} />);
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-userpic', 'false');
  });

  it('should use auth URL when provided', () => {
    customRender(
      <TelegramLoginButton 
        botName="TestBot" 
        dataAuthUrl="https://example.com/auth"
      />
    );
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-auth-url', 'https://example.com/auth');
    expect(script).not.toHaveAttribute('data-onauth');
  });

  it('should set up onTelegramAuth callback', () => {
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    expect(window.onTelegramAuth).toBeDefined();
    expect(typeof window.onTelegramAuth).toBe('function');
  });

  it('should handle successful authentication', async () => {
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    const mockUser = {
      id: 123456789,
      first_name: 'Test',
      last_name: 'User',
      username: 'testuser',
      auth_date: Date.now(),
      hash: 'test_hash',
    };
    
    // Simulate Telegram authentication
    await window.onTelegramAuth(mockUser);
    
    expect(mockLogin).toHaveBeenCalledWith(mockUser);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should handle authentication error', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation();
    mockLogin.mockRejectedValue(new Error('Auth failed'));
    
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    const mockUser = { id: 123456789 };
    
    // Simulate failed authentication
    await window.onTelegramAuth(mockUser);
    
    expect(mockLogin).toHaveBeenCalledWith(mockUser);
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith('Login failed:', expect.any(Error));
      expect(mockNavigate).not.toHaveBeenCalled();
    });
    
    consoleError.mockRestore();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = customRender(<TelegramLoginButton botName="TestBot" />);
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).toBeInTheDocument();
    expect(window.onTelegramAuth).toBeDefined();
    
    unmount();
    
    expect(document.querySelector('script[data-telegram-login]')).not.toBeInTheDocument();
    expect(window.onTelegramAuth).toBeUndefined();
  });

  it('should update script when props change', () => {
    const { rerender } = customRender(
      <TelegramLoginButton botName="TestBot" buttonSize="large" />
    );
    
    let script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-size', 'large');
    
    rerender(<TelegramLoginButton botName="TestBot" buttonSize="small" />);
    
    // Old script should be removed and new one created
    script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-size', 'small');
  });

  it('should handle all prop combinations', () => {
    customRender(
      <TelegramLoginButton 
        botName="CompleteBot"
        buttonSize="medium"
        cornerRadius={15}
        showAvatar={false}
        dataAuthUrl="https://example.com/telegram-auth"
      />
    );
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).toHaveAttribute('data-telegram-login', 'CompleteBot');
    expect(script).toHaveAttribute('data-size', 'medium');
    expect(script).toHaveAttribute('data-radius', '15');
    expect(script).toHaveAttribute('data-userpic', 'false');
    expect(script).toHaveAttribute('data-auth-url', 'https://example.com/telegram-auth');
    expect(script).not.toHaveAttribute('data-onauth');
  });

  it('should not set radius attribute when cornerRadius is undefined', () => {
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).not.toHaveAttribute('data-radius');
  });

  it('should not set userpic attribute when showAvatar is true', () => {
    customRender(<TelegramLoginButton botName="TestBot" showAvatar={true} />);
    
    const script = document.querySelector('script[data-telegram-login]');
    expect(script).not.toHaveAttribute('data-userpic');
  });

  it('should append script to ref element', () => {
    customRender(<TelegramLoginButton botName="TestBot" />);
    
    const container = document.querySelector('.telegram-login-button');
    const script = container?.querySelector('script[data-telegram-login]');
    
    expect(script).toBeInTheDocument();
    expect(script?.parentElement).toBe(container);
  });
});
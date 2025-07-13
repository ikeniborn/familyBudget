import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { PasswordLogin } from './PasswordLogin';
import { useAuthStore } from '@/stores/authStore';
import { authService } from '@/services/authService';

// Mock dependencies
jest.mock('@/stores/authStore');
jest.mock('@/services/authService');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

describe('PasswordLogin', () => {
  const mockSetUser = jest.fn();
  const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
  const mockAuthService = authService as jest.Mocked<typeof authService>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        setUser: mockSetUser,
      };
      return selector(state as any);
    });
  });

  it('should render login form', () => {
    customRender(<PasswordLogin />);

    expect(screen.getByText('Sign in to your account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should render link to Telegram login', () => {
    customRender(<PasswordLogin />);

    const telegramLink = screen.getByText('sign in with Telegram');
    expect(telegramLink).toBeInTheDocument();
  });

  it('should navigate to Telegram login when link is clicked', async () => {
    const { user } = customRender(<PasswordLogin />);

    const telegramLink = screen.getByText('sign in with Telegram');
    await user.click(telegramLink);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('should update username input', async () => {
    const { user } = customRender(<PasswordLogin />);

    const usernameInput = screen.getByPlaceholderText('Username');
    await user.type(usernameInput, 'testuser');

    expect(usernameInput).toHaveValue('testuser');
  });

  it('should update password input', async () => {
    const { user } = customRender(<PasswordLogin />);

    const passwordInput = screen.getByPlaceholderText('Password');
    await user.type(passwordInput, 'testpass123');

    expect(passwordInput).toHaveValue('testpass123');
  });

  it('should handle successful login', async () => {
    const mockResponse = {
      success: true,
      user: {
        id: 1,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
      },
    };
    mockAuthService.loginWithPassword.mockResolvedValue(mockResponse);

    const { user } = customRender(<PasswordLogin />);

    // Fill form
    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'testpass123');

    // Submit
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('testuser', 'testpass123');

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith({
        user_id: 1,
        user_name: 'testuser',
        user_telegram_id: 0,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        authMethod: 'password',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('should handle login failure with error message', async () => {
    mockAuthService.loginWithPassword.mockRejectedValue({
      response: {
        data: {
          error: 'Invalid username or password',
        },
      },
    });

    const { user } = customRender(<PasswordLogin />);

    // Fill form
    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'wrongpass');

    // Submit
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid username or password')).toBeInTheDocument();
      expect(mockSetUser).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('should handle login failure without error message', async () => {
    mockAuthService.loginWithPassword.mockRejectedValue(new Error('Network error'));

    const { user } = customRender(<PasswordLogin />);

    // Fill form
    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'testpass');

    // Submit
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('should handle unsuccessful response', async () => {
    mockAuthService.loginWithPassword.mockResolvedValue({
      success: false,
      user: null,
    });

    const { user } = customRender(<PasswordLogin />);

    // Fill form
    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'testpass');

    // Submit
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
      expect(mockSetUser).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('should show loading state during login', async () => {
    mockAuthService.loginWithPassword.mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    const { user } = customRender(<PasswordLogin />);

    // Fill form
    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'testpass');

    // Submit
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    await user.click(submitButton);

    // Check loading state
    expect(submitButton).toHaveTextContent('Signing in...');
    expect(submitButton).toBeDisabled();

    // Wait for completion
    await waitFor(() => {
      expect(submitButton).toHaveTextContent('Sign in');
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should require username and password', async () => {
    const { user } = customRender(<PasswordLogin />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');

    expect(usernameInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it('should have proper autocomplete attributes', () => {
    customRender(<PasswordLogin />);

    const usernameInput = screen.getByPlaceholderText('Username');
    const passwordInput = screen.getByPlaceholderText('Password');

    expect(usernameInput).toHaveAttribute('autoComplete', 'username');
    expect(passwordInput).toHaveAttribute('autoComplete', 'current-password');
  });

  it('should have password input type for password field', () => {
    customRender(<PasswordLogin />);

    const passwordInput = screen.getByPlaceholderText('Password');
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('should clear error when submitting again', async () => {
    mockAuthService.loginWithPassword
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce({ success: true, user: { id: 1, username: 'test' } });

    const { user } = customRender(<PasswordLogin />);

    // First submission - error
    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'testpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed. Please try again.')).toBeInTheDocument();
    });

    // Second submission - should clear error
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.queryByText('Login failed. Please try again.')).not.toBeInTheDocument();
    });
  });

  it('should handle missing user data gracefully', async () => {
    mockAuthService.loginWithPassword.mockResolvedValue({
      success: true,
      user: {
        id: 1,
        // Missing other fields
      },
    });

    const { user } = customRender(<PasswordLogin />);

    await user.type(screen.getByPlaceholderText('Username'), 'testuser');
    await user.type(screen.getByPlaceholderText('Password'), 'testpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith({
        user_id: 1,
        user_name: '',
        user_telegram_id: 0,
        first_name: '',
        last_name: '',
        username: '',
        authMethod: 'password',
      });
    });
  });

  it('should have proper styling classes', () => {
    customRender(<PasswordLogin />);

    const container = screen.getByText('Sign in to your account').closest('div');
    expect(container?.parentElement).toHaveClass('max-w-md', 'w-full', 'space-y-8');

    const form = screen.getByRole('button', { name: /sign in/i }).closest('form');
    expect(form).toHaveClass('mt-8', 'space-y-6');
  });
});
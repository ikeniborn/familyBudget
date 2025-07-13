import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { Navigate } from 'react-router-dom';
import { customRender } from '@/test/utils/test-utils';
import { AuthGuard } from './AuthGuard';
import { useAuthStore } from '@/stores/authStore';

// Mock the auth store
jest.mock('@/stores/authStore');

// Mock Navigate component
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  Navigate: jest.fn(() => null),
  useLocation: () => ({ pathname: '/protected' }),
}));

describe('AuthGuard', () => {
  const mockCheckAuth = jest.fn();
  const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    (Navigate as jest.Mock).mockClear();
  });

  it('should show loading spinner when authentication is being checked', () => {
    // Mock loading state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: false,
        isLoading: true,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should show loading spinner
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin', 'rounded-full', 'border-b-2', 'border-blue-600');
    
    // Should not show protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should render children when user is authenticated', () => {
    // Mock authenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: true,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should show protected content
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    
    // Should not show loading spinner
    expect(document.querySelector('.animate-spin')).not.toBeInTheDocument();
    
    // Should not redirect
    expect(Navigate).not.toHaveBeenCalled();
  });

  it('should redirect to login when user is not authenticated', () => {
    // Mock unauthenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: false,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should redirect to login
    expect(Navigate).toHaveBeenCalledWith(
      {
        to: '/login',
        state: { from: { pathname: '/protected' } },
        replace: true,
      },
      {}
    );
    
    // Should not show protected content
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('should check authentication on mount if not authenticated', () => {
    // Mock unauthenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: false,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should call checkAuth
    expect(mockCheckAuth).toHaveBeenCalledTimes(1);
  });

  it('should not check authentication on mount if already authenticated', () => {
    // Mock authenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: true,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should not call checkAuth
    expect(mockCheckAuth).not.toHaveBeenCalled();
  });

  it('should handle authentication state changes', async () => {
    let isAuthenticated = false;
    
    // Mock dynamic state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    const { rerender } = customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Initially not authenticated - should redirect
    expect(Navigate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();

    // Change to authenticated
    isAuthenticated = true;
    rerender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should now show protected content
    await waitFor(() => {
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  it('should pass location state when redirecting', () => {
    // Mock useLocation with a specific path
    const mockLocation = { pathname: '/dashboard/reports', search: '?id=123' };
    jest.spyOn(require('react-router-dom'), 'useLocation').mockReturnValue(mockLocation);
    
    // Mock unauthenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: false,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    );

    // Should redirect with location state
    expect(Navigate).toHaveBeenCalledWith(
      {
        to: '/login',
        state: { from: mockLocation },
        replace: true,
      },
      {}
    );
  });

  it('should render multiple children correctly', () => {
    // Mock authenticated state
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        isAuthenticated: true,
        isLoading: false,
        checkAuth: mockCheckAuth,
      };
      return selector(state as any);
    });

    customRender(
      <AuthGuard>
        <div>Child 1</div>
        <div>Child 2</div>
        <span>Child 3</span>
      </AuthGuard>
    );

    // All children should be rendered
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });
});
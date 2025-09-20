import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import UserModal from '$lib/components/modals/UserModal.svelte';
import type { User } from '$lib/types';

/**
 * UserModal Field Readonly Simple Tests
 *
 * Direct tests for the field fix implementation:
 * - Test email field: should NOT be readonly in both create and edit modes
 * - Test password field: should NOT be readonly in both create and edit modes
 * - Test username field: should be readonly ONLY in edit mode
 */

// Mock services and stores
vi.mock('$lib/services/userService', () => ({
  userService: {
    createUser: vi.fn(),
    updateUserAsAdmin: vi.fn()
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));

describe('UserModal Field Readonly Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser: User = {
    id: 1,
    user_name: 'John Doe',
    user_email: 'john@example.com',
    username: 'johndoe',
    auth_method: 'password',
    is_admin: false,
    telegram_id: null,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  };

  describe('Create Mode Tests', () => {
    it('should have email field editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const emailInput = screen.getByLabelText(/Email/);
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');
    });

    it('should have password field editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');
      expect(passwordInput).toHaveAttribute('required'); // Required in create mode
    });

    it('should have username field editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).not.toHaveAttribute('readonly');
      expect(usernameInput).not.toHaveAttribute('disabled');
    });
  });

  describe('Edit Mode Tests', () => {
    it('should have email field editable in edit mode (key test)', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByDisplayValue('john@example.com');

      // This is the key assertion: email should NOT be readonly in edit mode
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');
    });

    it('should have password field editable in edit mode (key test)', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);

      // This is the key assertion: password should NOT be readonly in edit mode
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('required'); // Not required in edit mode
    });

    it('should have username field readonly in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');

      // Username should be readonly in edit mode
      expect(usernameInput).toHaveAttribute('readonly');
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');
    });
  });

  describe('Field State Verification', () => {
    it('should verify form data is populated correctly in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Verify all fields have the expected values
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument();

      // Password should be empty
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;
      expect(passwordInput.value).toBe('');
    });

    it('should verify modal titles are correct', () => {
      // Test create mode
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });
      expect(screen.getByText('Добавить пользователя')).toBeInTheDocument();

      // Test edit mode
      rerender({
        open: true,
        user: mockUser
      });
      expect(screen.getByText('Редактирование пользователя')).toBeInTheDocument();
    });

    it('should show readonly indicator for username in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText(/Логин \(только для чтения\)/)).toBeInTheDocument();
    });

    it('should show correct button text in both modes', () => {
      // Test create mode
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });
      expect(screen.getByText('Создать')).toBeInTheDocument();

      // Test edit mode
      rerender({
        open: true,
        user: mockUser
      });
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
    });
  });

  describe('Specific Field Implementation Verification', () => {
    it('should verify email field implementation with explicit readonly=false', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByDisplayValue('john@example.com');

      // The component explicitly sets readonly={false} and disabled={false}
      // These should not be present as attributes
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');

      // Should have white background (editable styling)
      expect(emailInput).toHaveClass('bg-white');
    });

    it('should verify password field implementation with explicit readonly=false', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);

      // The component explicitly sets readonly={false} and disabled={false}
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');

      // Should have white background (editable styling)
      expect(passwordInput).toHaveClass('bg-white');
    });

    it('should verify username field implementation with readonly={isEditing}', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');

      // In edit mode, isEditing=true, so readonly={isEditing} should be readonly=true
      expect(usernameInput).toHaveAttribute('readonly');

      // Should have gray background (readonly styling)
      expect(usernameInput).toHaveClass('bg-gray-50');
    });
  });

  describe('Aria Attributes Verification', () => {
    it('should have correct aria attributes for editable fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByDisplayValue('john@example.com');
      const passwordInput = screen.getByLabelText(/Пароль/);

      // Editable fields should have aria-readonly="false" or no aria-readonly
      expect(emailInput).toHaveAttribute('aria-readonly', 'false');
      expect(passwordInput).toHaveAttribute('aria-readonly', 'false');
    });

    it('should have correct aria attributes for readonly field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');

      // Readonly field should have aria-readonly="true"
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');
    });
  });
});
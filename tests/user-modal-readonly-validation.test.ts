import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UserModal from '../frontend-svelte/src/lib/components/modals/UserModal.svelte';
import type { User } from '../frontend-svelte/src/lib/types';

/**
 * UserModal Component Readonly Validation Tests
 *
 * Simplified tests focusing on the core readonly functionality that was fixed:
 * 1. Username field should be readonly when editing (isEditing = true)
 * 2. Other fields should remain editable when editing
 * 3. Visual styling should be correctly applied
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

describe('UserModal Readonly Field Validation', () => {
  const user = userEvent.setup();

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

  describe('Core Readonly Functionality', () => {
    it('should set username field as readonly when editing existing user', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');
      expect(usernameInput).toHaveAttribute('readonly');
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');
    });

    it('should keep all fields editable when creating new user', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Find all input fields by their placeholder text or labels
      const inputs = screen.getAllByRole('textbox');
      const passwordInput = screen.getByLabelText(/Пароль/);

      inputs.forEach(input => {
        expect(input).not.toHaveAttribute('readonly');
      });
      expect(passwordInput).not.toHaveAttribute('readonly');
    });

    it('should show correct modal title for edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText('Редактирование пользователя')).toBeInTheDocument();
    });

    it('should show correct modal title for create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      expect(screen.getByText('Добавить пользователя')).toBeInTheDocument();
    });
  });

  describe('Field State Validation', () => {
    it('should populate form fields with user data in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument();
    });

    it('should show readonly indicator text for username in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText(/Логин.*только для чтения/)).toBeInTheDocument();
    });

    it('should show password helper text in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText(/оставьте пустым, если не нужно менять/)).toBeInTheDocument();
    });

    it('should have empty form fields in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const textInputs = screen.getAllByRole('textbox');
      textInputs.forEach(input => {
        expect((input as HTMLInputElement).value).toBe('');
      });
    });
  });

  describe('Visual Styling Verification', () => {
    it('should apply gray background to readonly username field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');
      expect(usernameInput).toHaveClass('bg-gray-50');
    });

    it('should apply normal styling to editable fields in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByDisplayValue('John Doe');
      const emailInput = screen.getByDisplayValue('john@example.com');

      expect(userNameInput).toHaveClass('bg-white');
      expect(emailInput).toHaveClass('bg-white');
    });

    it('should show lock icon for readonly username field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Check if there's a lock icon in the DOM (Lucide SVG)
      const lockIcon = document.querySelector('svg[class*="lucide-lock"]');
      expect(lockIcon).toBeInTheDocument();
    });
  });

  describe('Interaction Behavior', () => {
    it('should prevent modification of readonly username field', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe') as HTMLInputElement;
      const originalValue = usernameInput.value;

      // Attempt to modify readonly field
      await user.clear(usernameInput);
      await user.type(usernameInput, 'newusername');

      // Value should remain unchanged due to readonly attribute
      expect(usernameInput.value).toBe(originalValue);
    });

    it('should allow modification of editable fields in edit mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByDisplayValue('John Doe') as HTMLInputElement;

      // This should work since field is editable
      await user.clear(userNameInput);
      await user.type(userNameInput, 'Jane Smith');

      expect(userNameInput.value).toBe('Jane Smith');
    });
  });

  describe('Form Validation with Readonly Fields', () => {
    it('should validate non-readonly fields correctly', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Clear a required field (user_name)
      const userNameInput = screen.getByDisplayValue('John Doe');
      await user.clear(userNameInput);

      // Try to submit
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      // Should show validation error for the cleared field
      expect(screen.getByText('Имя пользователя обязательно')).toBeInTheDocument();

      // Readonly username field should still be readonly and unchanged
      const usernameInput = screen.getByDisplayValue('johndoe');
      expect(usernameInput).toHaveAttribute('readonly');
    });

    it('should not require password in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).not.toHaveAttribute('required');
    });

    it('should require password in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveAttribute('required');
    });
  });

  describe('Accessibility Features', () => {
    it('should provide proper ARIA attributes for readonly field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');
    });

    it('should maintain descriptive labels for all fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByLabelText(/Имя пользователя/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Логин/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Пароль/)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle user with null email correctly', () => {
      const userWithoutEmail = { ...mockUser, user_email: null };

      render(UserModal, {
        props: {
          open: true,
          user: userWithoutEmail
        }
      });

      const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement;
      expect(emailInput.value).toBe('');
      expect(emailInput).not.toHaveAttribute('readonly');
    });

    it('should handle user with empty username correctly', () => {
      const userWithoutUsername = { ...mockUser, username: '' };

      render(UserModal, {
        props: {
          open: true,
          user: userWithoutUsername
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;
      expect(usernameInput.value).toBe('');
      expect(usernameInput).toHaveAttribute('readonly');
    });
  });
});
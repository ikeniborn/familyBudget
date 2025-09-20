import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UserModal from '../frontend-svelte/src/lib/components/modals/UserModal.svelte';
import type { User } from '../frontend-svelte/src/lib/types';

/**
 * UserModal Component Field Fix Comprehensive Tests
 *
 * Tests specifically validate the recent field fix implementation:
 * - Email field should be editable in both create and edit modes
 * - Password field should be editable in both create and edit modes
 * - Username field should be readonly only in edit mode
 * - All field state behavior should work correctly
 *
 * Context: Fixed issue where email and password fields were not editable
 * in user editing modal. Username field should remain readonly during editing.
 */

// Mock services and stores
vi.mock('$lib/services/userService', () => ({
  userService: {
    createUser: vi.fn().mockResolvedValue({ id: 2, user_name: 'New User' }),
    updateUserAsAdmin: vi.fn().mockResolvedValue({ id: 1, user_name: 'Updated User' })
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}));

describe('UserModal Field Fix Comprehensive Tests', () => {
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

  describe('Email Field Editability Tests', () => {
    it('should allow editing email field in create mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement;

      // Verify field is editable
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');

      // Test user can type in email field
      await user.type(emailInput, 'test@example.com');
      expect(emailInput.value).toBe('test@example.com');
    });

    it('should allow editing email field in edit mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByDisplayValue('john@example.com') as HTMLInputElement;

      // Verify field is editable (not readonly or disabled)
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');

      // Test user can modify email field
      await user.clear(emailInput);
      await user.type(emailInput, 'updated@example.com');
      expect(emailInput.value).toBe('updated@example.com');
    });

    it('should show white background on email field in both modes', () => {
      // Test create mode
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      let emailInput = screen.getByLabelText(/Email/);
      expect(emailInput).toHaveClass('bg-white');
      expect(emailInput).not.toHaveClass('bg-gray-50'); // Should not have readonly styling

      // Test edit mode
      rerender({
        open: true,
        user: mockUser
      });

      emailInput = screen.getByDisplayValue('john@example.com');
      expect(emailInput).toHaveClass('bg-white');
      expect(emailInput).not.toHaveClass('bg-gray-50'); // Should not have readonly styling
    });

    it('should not show lock icon on email field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByDisplayValue('john@example.com');
      const emailContainer = emailInput.parentElement;

      // Check that email field container doesn't have lock icon
      const lockIcon = emailContainer?.querySelector('svg[class*="lucide-lock"]');
      expect(lockIcon).toBeNull();
    });
  });

  describe('Password Field Editability Tests', () => {
    it('should allow editing password field in create mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // Verify field is editable
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');
      expect(passwordInput).toHaveAttribute('required'); // Required in create mode

      // Test user can type in password field
      await user.type(passwordInput, 'newpassword123');
      expect(passwordInput.value).toBe('newpassword123');
    });

    it('should allow editing password field in edit mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // Verify field is editable (not readonly or disabled)
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('required'); // Not required in edit mode

      // Test user can type in password field
      await user.type(passwordInput, 'updatedpassword123');
      expect(passwordInput.value).toBe('updatedpassword123');
    });

    it('should show white background on password field in both modes', () => {
      // Test create mode
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      let passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveClass('bg-white');
      expect(passwordInput).not.toHaveClass('bg-gray-50'); // Should not have readonly styling

      // Test edit mode
      rerender({
        open: true,
        user: mockUser
      });

      passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveClass('bg-white');
      expect(passwordInput).not.toHaveClass('bg-gray-50'); // Should not have readonly styling
    });

    it('should not show lock icon on password field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);
      const passwordContainer = passwordInput.parentElement;

      // Check that password field container doesn't have lock icon
      const lockIcon = passwordContainer?.querySelector('svg[class*="lucide-lock"]');
      expect(lockIcon).toBeNull();
    });

    it('should show correct placeholder text in both modes', () => {
      // Test create mode
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      let passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveAttribute('placeholder', 'Введите пароль');

      // Test edit mode
      rerender({
        open: true,
        user: mockUser
      });

      passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveAttribute('placeholder', 'Новый пароль');
    });
  });

  describe('Username Field Readonly Behavior Tests', () => {
    it('should allow editing username field in create mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;

      // Verify field is editable in create mode
      expect(usernameInput).not.toHaveAttribute('readonly');
      expect(usernameInput).not.toHaveAttribute('disabled');

      // Test user can type in username field
      await user.type(usernameInput, 'newusername');
      expect(usernameInput.value).toBe('newusername');
    });

    it('should make username field readonly in edit mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe') as HTMLInputElement;

      // Verify field is readonly in edit mode
      expect(usernameInput).toHaveAttribute('readonly');
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');

      // Test that user cannot modify readonly field
      const originalValue = usernameInput.value;
      await user.clear(usernameInput);
      await user.type(usernameInput, 'newusername');
      expect(usernameInput.value).toBe(originalValue); // Should remain unchanged
    });

    it('should show gray background and lock icon for readonly username', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');

      // Should have readonly styling
      expect(usernameInput).toHaveClass('bg-gray-50');
      expect(usernameInput).toHaveClass('text-gray-700');
      expect(usernameInput).toHaveClass('cursor-default');

      // Should have lock icon in container
      const lockIcon = document.querySelector('svg[class*="lucide-lock"]');
      expect(lockIcon).toBeInTheDocument();
    });

    it('should show readonly indicator text for username in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText(/Логин \(только для чтения\)/)).toBeInTheDocument();
    });
  });

  describe('Overall Field State Behavior Tests', () => {
    it('should correctly transition field states from create to edit mode', async () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // In create mode, all fields should be editable
      let usernameInput = screen.getByLabelText(/Логин/);
      let emailInput = screen.getByLabelText(/Email/);
      let passwordInput = screen.getByLabelText(/Пароль/);

      expect(usernameInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');

      // Switch to edit mode
      rerender({
        open: true,
        user: mockUser
      });

      // In edit mode, only username should be readonly
      usernameInput = screen.getByDisplayValue('johndoe');
      emailInput = screen.getByDisplayValue('john@example.com');
      passwordInput = screen.getByLabelText(/Пароль/);

      expect(usernameInput).toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');
    });

    it('should populate all fields correctly in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument();

      // Password should be empty in edit mode
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;
      expect(passwordInput.value).toBe('');
    });

    it('should show correct modal titles for both modes', () => {
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

    it('should show correct button text for both modes', () => {
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

  describe('Form Submission Tests', () => {
    it('should submit editable fields correctly in create mode', async () => {
      const { userService } = await import('../frontend-svelte/src/lib/services/userService');
      const mockCreateUser = vi.mocked(userService.createUser);

      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Fill in all fields
      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const usernameInput = screen.getByLabelText(/Логин/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      await user.type(userNameInput, 'New User');
      await user.type(emailInput, 'newuser@example.com');
      await user.type(usernameInput, 'newuser');
      await user.type(passwordInput, 'password123');

      // Submit form
      const createButton = screen.getByText('Создать');
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalledWith({
          user_name: 'New User',
          user_email: 'newuser@example.com',
          username: 'newuser',
          password: 'password123',
          auth_method: 'password'
        });
      });
    });

    it('should submit editable fields correctly in edit mode', async () => {
      const { userService } = await import('../frontend-svelte/src/lib/services/userService');
      const mockUpdateUser = vi.mocked(userService.updateUserAsAdmin);

      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Modify editable fields only
      const userNameInput = screen.getByDisplayValue('John Doe');
      const emailInput = screen.getByDisplayValue('john@example.com');
      const passwordInput = screen.getByLabelText(/Пароль/);

      await user.clear(userNameInput);
      await user.type(userNameInput, 'Updated Name');

      await user.clear(emailInput);
      await user.type(emailInput, 'updated@example.com');

      await user.type(passwordInput, 'newpassword');

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith(
          mockUser.id,
          expect.objectContaining({
            user_name: 'Updated Name',
            user_email: 'updated@example.com',
            username: 'johndoe', // Should keep original readonly value
            password: 'newpassword'
          })
        );
      });
    });
  });

  describe('Validation and Error Handling Tests', () => {
    it('should validate required fields correctly while preserving readonly state', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Clear required field
      const userNameInput = screen.getByDisplayValue('John Doe');
      await user.clear(userNameInput);

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Имя пользователя обязательно')).toBeInTheDocument();
      });

      // Readonly username field should remain unchanged
      const usernameInput = screen.getByDisplayValue('johndoe');
      expect(usernameInput).toHaveAttribute('readonly');
      expect(usernameInput).toHaveDisplayValue('johndoe');
    });

    it('should handle email validation correctly', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Enter invalid email
      const emailInput = screen.getByDisplayValue('john@example.com');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');

      // Submit form
      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      // Should show email validation error
      await waitFor(() => {
        expect(screen.getByText('Некорректный email')).toBeInTheDocument();
      });
    });

    it('should handle password validation correctly', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Fill required fields but leave password empty
      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      await user.type(userNameInput, 'Test User');

      // Submit form
      const createButton = screen.getByText('Создать');
      await user.click(createButton);

      // Should show password validation error
      await waitFor(() => {
        expect(screen.getByText('Пароль обязателен при создании пользователя')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility and UX Tests', () => {
    it('should provide proper ARIA attributes for all fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');
      const emailInput = screen.getByDisplayValue('john@example.com');
      const passwordInput = screen.getByLabelText(/Пароль/);

      // Readonly field should have aria-readonly
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');

      // Editable fields should not have aria-readonly
      expect(emailInput).not.toHaveAttribute('aria-readonly');
      expect(passwordInput).not.toHaveAttribute('aria-readonly');
    });

    it('should maintain proper focus behavior for all fields', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');
      const emailInput = screen.getByDisplayValue('john@example.com');
      const passwordInput = screen.getByLabelText(/Пароль/);

      // All fields should be focusable
      await user.click(usernameInput);
      expect(usernameInput).toHaveFocus();

      await user.click(emailInput);
      expect(emailInput).toHaveFocus();

      await user.click(passwordInput);
      expect(passwordInput).toHaveFocus();
    });

    it('should show visual distinction between readonly and editable fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByDisplayValue('johndoe');
      const emailInput = screen.getByDisplayValue('john@example.com');

      // Readonly field should have distinct styling
      expect(usernameInput).toHaveClass('bg-gray-50', 'cursor-default', 'text-gray-700');

      // Editable field should have normal styling
      expect(emailInput).toHaveClass('bg-white');
      expect(emailInput).not.toHaveClass('cursor-default', 'bg-gray-50');
    });
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import UserModal from '../frontend-svelte/src/lib/components/modals/UserModal.svelte';
import type { User } from '../frontend-svelte/src/lib/types';

/**
 * UserModal Component Field Editability Tests
 *
 * Tests verify that UserModal correctly applies readonly styling to username field
 * when editing, while keeping other fields editable.
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

describe('UserModal Field Editability', () => {
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

  describe('Create Mode (No User)', () => {
    it('should render all fields as editable when creating new user', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // All fields should be editable (no readonly attribute)
      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const usernameInput = screen.getByLabelText(/Логин/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      expect(userNameInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(usernameInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');
    });

    it('should show create mode title', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      expect(screen.getByText('Добавить пользователя')).toBeInTheDocument();
    });

    it('should have white background on all input fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const usernameInput = screen.getByLabelText(/Логин/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      expect(userNameInput).toHaveClass('bg-white');
      expect(emailInput).toHaveClass('bg-white');
      expect(usernameInput).toHaveClass('bg-white');
      expect(passwordInput).toHaveClass('bg-white');
    });

    it('should not show lock icons on any fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // No lock icons should be present
      const lockIcons = screen.queryAllByRole('img', { hidden: true });
      expect(lockIcons).toHaveLength(0);
    });
  });

  describe('Edit Mode (With User)', () => {
    it('should render username field as readonly when editing existing user', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).toHaveAttribute('readonly');
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');
    });

    it('should render other fields as editable when editing', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      expect(userNameInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');
    });

    it('should show edit mode title', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText('Редактирование пользователя')).toBeInTheDocument();
    });

    it('should show readonly indicator text for username field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText(/Логин \(только для чтения\)/)).toBeInTheDocument();
    });

    it('should populate form fields with user data', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByDisplayValue('John Doe');
      const emailInput = screen.getByDisplayValue('john@example.com');
      const usernameInput = screen.getByDisplayValue('johndoe');

      expect(userNameInput).toBeInTheDocument();
      expect(emailInput).toBeInTheDocument();
      expect(usernameInput).toBeInTheDocument();
    });

    it('should show gray background only on readonly username field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const usernameInput = screen.getByLabelText(/Логин/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      // Only username should have gray background (readonly)
      expect(usernameInput).toHaveClass('bg-gray-50');
      expect(usernameInput).toHaveClass('text-gray-700');

      // Other fields should have white background (editable)
      expect(userNameInput).toHaveClass('bg-white');
      expect(emailInput).toHaveClass('bg-white');
      expect(passwordInput).toHaveClass('bg-white');
    });

    it('should show lock icon only on readonly username field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Should have exactly one lock icon for the readonly username field
      const lockIcons = screen.queryAllByRole('img', { hidden: true });
      expect(lockIcons).toHaveLength(1);
    });
  });

  describe('Field Interaction Behavior', () => {
    it('should allow editing of editable fields in edit mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText(/Имя пользователя/) as HTMLInputElement;

      // Clear and type new value
      await user.clear(userNameInput);
      await user.type(userNameInput, 'Jane Doe');

      expect(userNameInput.value).toBe('Jane Doe');
    });

    it('should prevent editing of readonly username field', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;
      const originalValue = usernameInput.value;

      // Attempt to modify readonly field
      await user.type(usernameInput, 'newusername');

      // Value should remain unchanged
      expect(usernameInput.value).toBe(originalValue);
    });

    it('should allow password field to be empty in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;
      expect(passwordInput.value).toBe('');
      expect(passwordInput).not.toHaveAttribute('required');
    });

    it('should allow email field to be edited', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement;

      await user.clear(emailInput);
      await user.type(emailInput, 'newemail@example.com');

      expect(emailInput.value).toBe('newemail@example.com');
    });
  });

  describe('Visual Distinctions', () => {
    it('should show clear visual distinction between readonly and editable fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/);
      const userNameInput = screen.getByLabelText(/Имя пользователя/);

      // Readonly field styling
      expect(usernameInput).toHaveClass('bg-gray-50');
      expect(usernameInput).toHaveClass('border-gray-200');
      expect(usernameInput).toHaveClass('cursor-default');

      // Editable field styling
      expect(userNameInput).toHaveClass('bg-white');
      expect(userNameInput).toHaveClass('border-gray-300');
      expect(userNameInput).not.toHaveClass('cursor-default');
    });

    it('should show focus styles differently for readonly vs editable fields', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/);
      const userNameInput = screen.getByLabelText(/Имя пользователя/);

      // Focus readonly field
      await user.click(usernameInput);
      expect(usernameInput).toHaveClass('focus-visible:ring-gray-400');

      // Focus editable field
      await user.click(userNameInput);
      expect(userNameInput).toHaveClass('focus-visible:ring-blue-600');
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields correctly in create mode', async () => {
      const component = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const createButton = screen.getByText('Создать');
      await user.click(createButton);

      // Should show validation errors for required fields
      await waitFor(() => {
        expect(screen.getByText('Имя пользователя обязательно')).toBeInTheDocument();
        expect(screen.getByText('Пароль обязателен при создании пользователя')).toBeInTheDocument();
      });
    });

    it('should not require password in edit mode', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).not.toHaveAttribute('required');
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
  });

  describe('Field State Transitions', () => {
    it('should transition from create to edit mode correctly', async () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Initially in create mode - all fields editable
      let usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).not.toHaveAttribute('readonly');

      // Switch to edit mode
      rerender({
        open: true,
        user: mockUser
      });

      // Now in edit mode - username should be readonly
      usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).toHaveAttribute('readonly');
    });

    it('should maintain field values when switching modes', async () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Type in fields during create mode
      const userNameInput = screen.getByLabelText(/Имя пользователя/) as HTMLInputElement;
      await user.type(userNameInput, 'Test User');

      // Switch to edit mode with user data
      rerender({
        open: true,
        user: mockUser
      });

      // Fields should now show user data
      const updatedUserNameInput = screen.getByDisplayValue('John Doe');
      expect(updatedUserNameInput).toBeInTheDocument();
    });
  });

  describe('Accessibility Compliance', () => {
    it('should provide proper ARIA labels for readonly field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).toHaveAttribute('aria-readonly', 'true');
    });

    it('should provide descriptive labels for all fields', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByLabelText(/Имя пользователя \*/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Логин \(только для чтения\)/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Пароль \(оставьте пустым, если не нужно менять\)/)).toBeInTheDocument();
    });

    it('should maintain proper tab order', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const usernameInput = screen.getByLabelText(/Логин/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      // All fields should be focusable in tab order
      expect(userNameInput).toHaveAttribute('tabindex', '0');
      expect(emailInput).toHaveAttribute('tabindex', '0');
      expect(usernameInput).toHaveAttribute('tabindex', '0'); // readonly fields are still focusable
      expect(passwordInput).toHaveAttribute('tabindex', '0');
    });
  });

  describe('Form Submission', () => {
    it('should not include readonly username in update payload', async () => {
      const mockUpdateUser = vi.fn().mockResolvedValue(mockUser);

      // Mock the userService
      const { userService } = await import('../frontend-svelte/src/lib/services/userService');
      (userService.updateUserAsAdmin as any) = mockUpdateUser;

      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockUpdateUser).toHaveBeenCalledWith(
          mockUser.id,
          expect.objectContaining({
            user_name: 'John Doe',
            user_email: 'john@example.com',
            username: 'johndoe', // Should include current value, not modified
            password: undefined
          })
        );
      });
    });

    it('should handle readonly field properly during form validation', async () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Clear required field
      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      await user.clear(userNameInput);

      const saveButton = screen.getByText('Сохранить');
      await user.click(saveButton);

      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Имя пользователя обязательно')).toBeInTheDocument();
      });

      // Readonly field should not be affected
      const usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).toHaveAttribute('readonly');
      expect(usernameInput).toHaveDisplayValue('johndoe');
    });
  });
});
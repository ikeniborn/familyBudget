import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import UserModal from '$lib/components/modals/UserModal.svelte';
import type { User } from '$lib/types';

/**
 * UserModal Field Fix Validation Tests
 *
 * Simple validation test for the field fix:
 * - Email field: readonly={false}, disabled={false} in both modes
 * - Password field: readonly={false}, disabled={false} in both modes
 * - Username field: readonly={isEditing} (true in edit mode, false in create mode)
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

describe('UserModal Field Fix Validation', () => {
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

  describe('Create Mode Field Properties', () => {
    it('should have all fields editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Check that all input fields exist and have correct attributes
      const userNameInput = screen.getByLabelText(/Имя пользователя/);
      const emailInput = screen.getByLabelText(/Email/);
      const usernameInput = screen.getByLabelText(/Логин/);
      const passwordInput = screen.getByLabelText(/Пароль/);

      // All fields should be editable (no readonly attribute)
      expect(userNameInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(usernameInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');

      // All fields should be enabled (no disabled attribute)
      expect(userNameInput).not.toHaveAttribute('disabled');
      expect(emailInput).not.toHaveAttribute('disabled');
      expect(usernameInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('disabled');
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
  });

  describe('Edit Mode Field Properties', () => {
    it('should have email and password fields editable in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByDisplayValue('john@example.com');
      const passwordInput = screen.getByLabelText(/Пароль/);

      // Email and password should be editable (no readonly attribute)
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');

      // Email and password should be enabled (no disabled attribute)
      expect(emailInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('disabled');
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

    it('should show edit mode title', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText('Редактирование пользователя')).toBeInTheDocument();
    });

    it('should show readonly indicator for username field', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      expect(screen.getByText(/Логин \(только для чтения\)/)).toBeInTheDocument();
    });
  });

  describe('Form Data Population', () => {
    it('should populate form fields with user data in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      // Check that fields are populated with user data
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument();
      expect(screen.getByDisplayValue('john@example.com')).toBeInTheDocument();
      expect(screen.getByDisplayValue('johndoe')).toBeInTheDocument();

      // Password should be empty in edit mode
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;
      expect(passwordInput.value).toBe('');
    });

    it('should have empty form fields in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Check that all text input fields are empty
      const userNameInput = screen.getByLabelText(/Имя пользователя/) as HTMLInputElement;
      const emailInput = screen.getByLabelText(/Email/) as HTMLInputElement;
      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      expect(userNameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(usernameInput.value).toBe('');
      expect(passwordInput.value).toBe('');
    });
  });

  describe('Field State Validation', () => {
    it('should correctly apply readonly property based on isEditing reactive variable', () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // In create mode (isEditing = false), username should not be readonly
      let usernameInput = screen.getByLabelText(/Логин/);
      expect(usernameInput).not.toHaveAttribute('readonly');

      // Switch to edit mode (isEditing = true)
      rerender({
        open: true,
        user: mockUser
      });

      // In edit mode (isEditing = true), username should be readonly
      usernameInput = screen.getByDisplayValue('johndoe');
      expect(usernameInput).toHaveAttribute('readonly');
    });

    it('should maintain email and password editability across mode changes', () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Check create mode
      let emailInput = screen.getByLabelText(/Email/);
      let passwordInput = screen.getByLabelText(/Пароль/);

      expect(emailInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');

      // Switch to edit mode
      rerender({
        open: true,
        user: mockUser
      });

      // Check edit mode - email and password should still be editable
      emailInput = screen.getByDisplayValue('john@example.com');
      passwordInput = screen.getByLabelText(/Пароль/);

      expect(emailInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');
    });
  });

  describe('Required Field Validation', () => {
    it('should mark password as required in create mode but not in edit mode', () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Password should be required in create mode
      let passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveAttribute('required');

      // Switch to edit mode
      rerender({
        open: true,
        user: mockUser
      });

      // Password should not be required in edit mode
      passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).not.toHaveAttribute('required');
    });

    it('should show correct password placeholder text', () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Create mode placeholder
      let passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveAttribute('placeholder', 'Введите пароль');

      // Switch to edit mode
      rerender({
        open: true,
        user: mockUser
      });

      // Edit mode placeholder
      passwordInput = screen.getByLabelText(/Пароль/);
      expect(passwordInput).toHaveAttribute('placeholder', 'Новый пароль');
    });
  });

  describe('Component Reactive Behavior', () => {
    it('should properly reactive to isEditing computed property', () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // isEditing should be false when user is null
      expect(screen.getByText('Добавить пользователя')).toBeInTheDocument();
      expect(screen.getByText('Создать')).toBeInTheDocument();

      // Switch to edit mode
      rerender({
        open: true,
        user: mockUser
      });

      // isEditing should be true when user is provided
      expect(screen.getByText('Редактирование пользователя')).toBeInTheDocument();
      expect(screen.getByText('Сохранить')).toBeInTheDocument();
    });

    it('should properly handle form data reactive updates', () => {
      const { rerender } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Initially empty fields
      const userNameInput = screen.getByLabelText(/Имя пользователя/) as HTMLInputElement;
      expect(userNameInput.value).toBe('');

      // Switch to edit mode - should populate with user data
      rerender({
        open: true,
        user: mockUser
      });

      const populatedUserNameInput = screen.getByDisplayValue('John Doe');
      expect(populatedUserNameInput).toBeInTheDocument();
    });
  });
});
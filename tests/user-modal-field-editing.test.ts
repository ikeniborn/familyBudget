import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import UserModal from '$lib/components/modals/UserModal.svelte';
import { userService } from '$lib/services/userService';
import type { User } from '$lib/types';

// Mock the userService
vi.mock('$lib/services/userService', () => ({
  userService: {
    updateUserAsAdmin: vi.fn(),
    createUser: vi.fn()
  }
}));

// Mock the toast store
vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));

describe('UserModal Field Editing', () => {
  const mockUser: User = {
    id: 1,
    user_name: 'Test User',
    user_email: 'test@example.com',
    username: 'testuser',
    is_active: true,
    is_admin: false,
    auth_method: 'password',
    created_at: '2025-01-01',
    updated_at: '2025-01-01'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Edit Mode Field Editability', () => {
    it('should allow editing the user_name field', async () => {
      const { component } = render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText('Имя пользователя *') as HTMLInputElement;

      // Check initial value
      expect(userNameInput.value).toBe('Test User');

      // Check that field is not disabled or readonly
      expect(userNameInput.disabled).toBe(false);
      expect(userNameInput.readOnly).toBe(false);

      // Try to edit the field
      await fireEvent.input(userNameInput, { target: { value: 'Updated User Name' } });

      // Check that value changed
      expect(userNameInput.value).toBe('Updated User Name');
    });

    it('should allow editing the email field', async () => {
      const { component } = render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;

      // Check initial value
      expect(emailInput.value).toBe('test@example.com');

      // Check that field is not disabled or readonly
      expect(emailInput.disabled).toBe(false);
      expect(emailInput.readOnly).toBe(false);

      // Try to edit the field
      await fireEvent.input(emailInput, { target: { value: 'newemail@example.com' } });

      // Check that value changed
      expect(emailInput.value).toBe('newemail@example.com');
    });

    it('should allow editing the username field', async () => {
      const { component } = render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const usernameInput = screen.getByLabelText('Логин') as HTMLInputElement;

      // Check initial value
      expect(usernameInput.value).toBe('testuser');

      // Check that field is not disabled or readonly
      expect(usernameInput.disabled).toBe(false);
      expect(usernameInput.readOnly).toBe(false);

      // Try to edit the field
      await fireEvent.input(usernameInput, { target: { value: 'newusername' } });

      // Check that value changed
      expect(usernameInput.value).toBe('newusername');
    });

    it('should allow entering a new password', async () => {
      const { component } = render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // Check initial value (should be empty for editing)
      expect(passwordInput.value).toBe('');

      // Check that field is not disabled or readonly
      expect(passwordInput.disabled).toBe(false);
      expect(passwordInput.readOnly).toBe(false);

      // Try to enter a new password
      await fireEvent.input(passwordInput, { target: { value: 'newpassword123' } });

      // Check that value changed
      expect(passwordInput.value).toBe('newpassword123');
    });
  });

  describe('Create Mode Field Editability', () => {
    it('should allow entering all fields in create mode', async () => {
      const { component } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const userNameInput = screen.getByLabelText('Имя пользователя *') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const usernameInput = screen.getByLabelText('Логин') as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // All fields should be empty in create mode
      expect(userNameInput.value).toBe('');
      expect(emailInput.value).toBe('');
      expect(usernameInput.value).toBe('');
      expect(passwordInput.value).toBe('');

      // All fields should be editable
      expect(userNameInput.disabled).toBe(false);
      expect(userNameInput.readOnly).toBe(false);
      expect(emailInput.disabled).toBe(false);
      expect(emailInput.readOnly).toBe(false);
      expect(usernameInput.disabled).toBe(false);
      expect(usernameInput.readOnly).toBe(false);
      expect(passwordInput.disabled).toBe(false);
      expect(passwordInput.readOnly).toBe(false);
    });
  });

  describe('Form Submission', () => {
    it('should submit form with updated values in edit mode', async () => {
      vi.mocked(userService.updateUserAsAdmin).mockResolvedValue(mockUser);

      const { component } = render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText('Имя пользователя *') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const saveButton = screen.getByText('Сохранить');

      // Edit fields
      await fireEvent.input(userNameInput, { target: { value: 'Updated Name' } });
      await fireEvent.input(emailInput, { target: { value: 'updated@example.com' } });

      // Submit form
      await fireEvent.click(saveButton);

      await waitFor(() => {
        expect(userService.updateUserAsAdmin).toHaveBeenCalledWith(1, {
          user_name: 'Updated Name',
          user_email: 'updated@example.com',
          username: 'testuser',
          password: undefined
        });
      });
    });

    it('should submit form with all values in create mode', async () => {
      const newUser = { ...mockUser, id: 2 };
      vi.mocked(userService.createUser).mockResolvedValue(newUser);

      const { component } = render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const userNameInput = screen.getByLabelText('Имя пользователя *') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const usernameInput = screen.getByLabelText('Логин') as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;
      const createButton = screen.getByText('Создать');

      // Fill in all fields
      await fireEvent.input(userNameInput, { target: { value: 'New User' } });
      await fireEvent.input(emailInput, { target: { value: 'new@example.com' } });
      await fireEvent.input(usernameInput, { target: { value: 'newuser' } });
      await fireEvent.input(passwordInput, { target: { value: 'password123' } });

      // Submit form
      await fireEvent.click(createButton);

      await waitFor(() => {
        expect(userService.createUser).toHaveBeenCalledWith({
          user_name: 'New User',
          user_email: 'new@example.com',
          username: 'newuser',
          password: 'password123',
          auth_method: 'password'
        });
      });
    });
  });

  describe('CSS Classes', () => {
    it('should apply correct CSS classes to input fields', async () => {
      const { component } = render(UserModal, {
        props: {
          open: true,
          user: mockUser
        }
      });

      const userNameInput = screen.getByLabelText('Имя пользователя *') as HTMLInputElement;

      // Check that simplified classes are applied
      expect(userNameInput.className).toContain('w-full');
      expect(userNameInput.className).toContain('px-3');
      expect(userNameInput.className).toContain('py-2');
      expect(userNameInput.className).toContain('border');
      expect(userNameInput.className).toContain('rounded-md');
      expect(userNameInput.className).toContain('focus:outline-none');
      expect(userNameInput.className).toContain('focus:ring-2');
      expect(userNameInput.className).toContain('focus:ring-blue-500');

      // Check that no complex class bindings remain
      expect(userNameInput.className).not.toContain('flex');
      expect(userNameInput.className).not.toContain('h-10');
      expect(userNameInput.className).not.toContain('text-sm');
    });
  });
});
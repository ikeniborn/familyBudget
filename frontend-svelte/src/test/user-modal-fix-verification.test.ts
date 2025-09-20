import { render, screen } from '@testing-library/svelte';
import UserModal from '$lib/components/modals/UserModal.svelte';
import { vi } from 'vitest';

// Mock the services and stores
vi.mock('$lib/services/userService', () => ({
  userService: {
    updateUserAsAdmin: vi.fn(),
    createUser: vi.fn()
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));

describe('UserModal Field Fix Verification', () => {
  const testUser = {
    id: 1,
    user_name: 'John Doe',
    user_email: 'john@example.com',
    username: 'johndoe',
    auth_method: 'password' as const,
    is_active: true,
    created_at: '2023-01-01'
  };

  describe('Email Field', () => {
    test('should be editable in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: testUser
        }
      });

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;

      // Email field should NOT be readonly
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');

      // Should be able to receive focus
      expect(emailInput.tabIndex).toBeGreaterThanOrEqual(0);
    });

    test('should be editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;

      // Email field should NOT be readonly
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('disabled');
    });
  });

  describe('Password Field', () => {
    test('should be editable in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: testUser
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // Password field should NOT be readonly
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');

      // Should be able to receive focus
      expect(passwordInput.tabIndex).toBeGreaterThanOrEqual(0);
    });

    test('should be editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // Password field should NOT be readonly
      expect(passwordInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('disabled');
    });
  });

  describe('Username Field Security', () => {
    test('should be readonly in edit mode (security requirement)', () => {
      render(UserModal, {
        props: {
          open: true,
          user: testUser
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;

      // Username field SHOULD be readonly when editing
      expect(usernameInput).toHaveAttribute('readonly');
    });

    test('should be editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;

      // Username field should NOT be readonly when creating
      expect(usernameInput).not.toHaveAttribute('readonly');
    });
  });

  describe('Field States Verification', () => {
    test('should have correct readonly/editable states in edit mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: testUser
        }
      });

      // Get all relevant input fields
      const nameInput = screen.getByLabelText(/Имя пользователя/) as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // Verify edit mode field states
      expect(nameInput).not.toHaveAttribute('readonly'); // Editable
      expect(emailInput).not.toHaveAttribute('readonly'); // Editable (THIS WAS THE FIX)
      expect(usernameInput).toHaveAttribute('readonly'); // Readonly for security
      expect(passwordInput).not.toHaveAttribute('readonly'); // Editable (THIS WAS THE FIX)

      // Verify none are disabled
      expect(nameInput).not.toHaveAttribute('disabled');
      expect(emailInput).not.toHaveAttribute('disabled');
      expect(usernameInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('disabled');
    });

    test('should have all fields editable in create mode', () => {
      render(UserModal, {
        props: {
          open: true,
          user: null
        }
      });

      // Get all relevant input fields
      const nameInput = screen.getByLabelText(/Имя пользователя/) as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const usernameInput = screen.getByLabelText(/Логин/) as HTMLInputElement;
      const passwordInput = screen.getByLabelText(/Пароль/) as HTMLInputElement;

      // All fields should be editable in create mode
      expect(nameInput).not.toHaveAttribute('readonly');
      expect(emailInput).not.toHaveAttribute('readonly');
      expect(usernameInput).not.toHaveAttribute('readonly');
      expect(passwordInput).not.toHaveAttribute('readonly');

      // None should be disabled
      expect(nameInput).not.toHaveAttribute('disabled');
      expect(emailInput).not.toHaveAttribute('disabled');
      expect(usernameInput).not.toHaveAttribute('disabled');
      expect(passwordInput).not.toHaveAttribute('disabled');
    });
  });
});
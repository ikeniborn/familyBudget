import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import UserModal from '../frontend-svelte/src/lib/components/modals/UserModal.svelte';
import type { User } from '../frontend-svelte/src/lib/types';

// Mock userService
vi.mock('../frontend-svelte/src/lib/services/userService', () => ({
  userService: {
    updateUserAsAdmin: vi.fn().mockResolvedValue({
      id: 1,
      user_name: 'Updated User',
      username: 'updated_username',
      user_email: 'updated@example.com'
    }),
    createUser: vi.fn().mockResolvedValue({
      id: 2,
      user_name: 'New User',
      username: 'new_username',
      user_email: 'new@example.com'
    })
  }
}));

// Mock toast store
vi.mock('../frontend-svelte/src/lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn()
  })
}));

describe('UserModal Username Field Editability', () => {
  const mockUser: User = {
    id: 1,
    user_name: 'Test User',
    username: 'testuser',
    user_email: 'test@example.com',
    is_admin: false,
    auth_method: 'password',
    created_at: new Date().toISOString(),
    last_login: null
  };

  it('should render username field as editable when editing a user', async () => {
    const { getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Check that the field is not disabled
    expect(usernameInput.disabled).toBe(false);

    // Check that the field is not readonly
    expect(usernameInput.readOnly).toBe(false);

    // Check that the field has the correct initial value
    expect(usernameInput.value).toBe('testuser');
  });

  it('should allow typing in the username field when editing', async () => {
    const { getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Clear and type new value
    await fireEvent.input(usernameInput, { target: { value: 'newusername' } });

    // Check that the value has changed
    expect(usernameInput.value).toBe('newusername');
  });

  it('should not have readonly or disabled attributes on username field', async () => {
    const { getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Check HTML attributes
    expect(usernameInput.hasAttribute('readonly')).toBe(false);
    expect(usernameInput.hasAttribute('disabled')).toBe(false);

    // Check ARIA attributes
    expect(usernameInput.getAttribute('aria-readonly')).toBe('false');
  });

  it('should allow username editing for new users', async () => {
    const { getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: null // New user
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Check that the field is editable
    expect(usernameInput.disabled).toBe(false);
    expect(usernameInput.readOnly).toBe(false);

    // Type a username
    await fireEvent.input(usernameInput, { target: { value: 'newuser' } });
    expect(usernameInput.value).toBe('newuser');
  });

  it('should have consistent field editability with email field', async () => {
    const { getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;
    const emailInput = getByLabelText('Email') as HTMLInputElement;

    // Both fields should have the same editability state
    expect(usernameInput.disabled).toBe(emailInput.disabled);
    expect(usernameInput.readOnly).toBe(emailInput.readOnly);
  });

  it('should not show lock icon on username field', async () => {
    const { container, getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин');
    const usernameContainer = usernameInput.closest('.relative');

    // Check that there's no lock icon (which appears for readonly fields)
    const lockIcon = usernameContainer?.querySelector('[data-lucide="lock"]');
    expect(lockIcon).toBeNull();
  });

  it('should not have readonly styling on username field', async () => {
    const { getByLabelText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;
    const classes = usernameInput.className;

    // Check that readonly-specific classes are not present
    expect(classes).not.toContain('bg-gray-50');
    expect(classes).not.toContain('cursor-default');

    // Should have normal editable field styling
    expect(classes).toContain('bg-white');
  });

  it('should successfully save changes with modified username', async () => {
    const { getByLabelText, getByText } = render(UserModal, {
      props: {
        open: true,
        user: mockUser
      }
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Change username
    await fireEvent.input(usernameInput, { target: { value: 'modified_username' } });

    // Submit form
    const saveButton = getByText('Сохранить');
    await fireEvent.click(saveButton);

    // Wait for async operations
    await waitFor(() => {
      const { userService } = vi.mocked(await import('../frontend-svelte/src/lib/services/userService'));

      // Check that update was called with the modified username
      expect(userService.updateUserAsAdmin).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          username: 'modified_username'
        })
      );
    });
  });
});
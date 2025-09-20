import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
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

describe('UserModal - Username Editing', () => {
  const mockUser: User = {
    id: 1,
    user_name: 'Test User',
    user_email: 'test@example.com',
    username: 'testuser',
    auth_method: 'password',
    is_active: true,
    is_admin: false,
    created_at: new Date().toISOString(),
    telegram_id: null,
    telegram_username: null
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render username field as editable when editing a user', async () => {
    const { getByLabelText } = render(UserModal, {
      open: true,
      user: mockUser
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Check that the input exists and is not readonly
    expect(usernameInput).toBeDefined();
    expect(usernameInput.readOnly).toBe(false);
    expect(usernameInput.disabled).toBe(false);
  });

  it('should not show readonly indicator text for username field', async () => {
    const { queryByText } = render(UserModal, {
      open: true,
      user: mockUser
    });

    // The text "(только для чтения)" should not be present
    expect(queryByText('(только для чтения)')).toBeNull();
  });

  it('should allow editing username value', async () => {
    const { getByLabelText } = render(UserModal, {
      open: true,
      user: mockUser
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Initial value should be the user's username
    expect(usernameInput.value).toBe('testuser');

    // Change the value
    await fireEvent.input(usernameInput, { target: { value: 'newusername' } });

    // Check that the value has changed
    expect(usernameInput.value).toBe('newusername');
  });

  it('should include username in update request when saving', async () => {
    const mockUpdateResponse = { ...mockUser, username: 'newusername' };
    vi.mocked(userService.updateUserAsAdmin).mockResolvedValue(mockUpdateResponse);

    const { getByLabelText, getByText } = render(UserModal, {
      open: true,
      user: mockUser
    });

    // Change username
    const usernameInput = getByLabelText('Логин') as HTMLInputElement;
    await fireEvent.input(usernameInput, { target: { value: 'newusername' } });

    // Change user_name to satisfy validation
    const userNameInput = getByLabelText('Имя пользователя *') as HTMLInputElement;
    await fireEvent.input(userNameInput, { target: { value: 'Updated Name' } });

    // Click save button
    const saveButton = getByText('Сохранить');
    await fireEvent.click(saveButton);

    // Wait for the async operation
    await waitFor(() => {
      expect(userService.updateUserAsAdmin).toHaveBeenCalledWith(1, {
        user_name: 'Updated Name',
        user_email: 'test@example.com',
        username: 'newusername',
        password: undefined
      });
    });
  });

  it('should allow username field to be edited for new users', async () => {
    const { getByLabelText } = render(UserModal, {
      open: true,
      user: null // Creating new user
    });

    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Check that the input is editable for new users
    expect(usernameInput).toBeDefined();
    expect(usernameInput.readOnly).toBe(false);
    expect(usernameInput.disabled).toBe(false);

    // Can type in the field
    await fireEvent.input(usernameInput, { target: { value: 'newuser' } });
    expect(usernameInput.value).toBe('newuser');
  });

  it('should preserve other field behaviors while username is editable', async () => {
    const { getByLabelText } = render(UserModal, {
      open: true,
      user: mockUser
    });

    // Check other fields remain properly configured
    const emailInput = getByLabelText('Email') as HTMLInputElement;
    const passwordInput = getByLabelText(/Пароль/) as HTMLInputElement;
    const usernameInput = getByLabelText('Логин') as HTMLInputElement;

    // Email should be editable (as per v3.9.2)
    expect(emailInput.readOnly).toBe(false);
    expect(emailInput.disabled).toBe(false);

    // Password should be editable (as per v3.9.2)
    expect(passwordInput.readOnly).toBe(false);
    expect(passwordInput.disabled).toBe(false);

    // Username should now also be editable (v3.9.3)
    expect(usernameInput.readOnly).toBe(false);
    expect(usernameInput.disabled).toBe(false);
  });

  it('should handle empty username correctly', async () => {
    const mockUpdateResponse = { ...mockUser, username: '' };
    vi.mocked(userService.updateUserAsAdmin).mockResolvedValue(mockUpdateResponse);

    const { getByLabelText, getByText } = render(UserModal, {
      open: true,
      user: mockUser
    });

    // Clear username
    const usernameInput = getByLabelText('Логин') as HTMLInputElement;
    await fireEvent.input(usernameInput, { target: { value: '' } });

    // Fill required field
    const userNameInput = getByLabelText('Имя пользователя *') as HTMLInputElement;
    await fireEvent.input(userNameInput, { target: { value: 'Test Name' } });

    // Save
    const saveButton = getByText('Сохранить');
    await fireEvent.click(saveButton);

    await waitFor(() => {
      expect(userService.updateUserAsAdmin).toHaveBeenCalledWith(1, {
        user_name: 'Test Name',
        user_email: 'test@example.com',
        username: undefined, // Empty string becomes undefined
        password: undefined
      });
    });
  });

  it('should maintain form state when switching between users', async () => {
    const { getByLabelText, rerender } = render(UserModal, {
      open: true,
      user: mockUser
    });

    let usernameInput = getByLabelText('Логин') as HTMLInputElement;
    expect(usernameInput.value).toBe('testuser');

    // Switch to another user
    const anotherUser = { ...mockUser, id: 2, username: 'anotheruser' };
    await rerender({ open: true, user: anotherUser });

    usernameInput = getByLabelText('Логин') as HTMLInputElement;
    expect(usernameInput.value).toBe('anotheruser');
    expect(usernameInput.readOnly).toBe(false);
  });
});
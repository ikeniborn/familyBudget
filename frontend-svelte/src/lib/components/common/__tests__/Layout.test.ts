import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import Layout from '../Layout.svelte';

// Mock stores
const mockCurrentUser = writable(null);
const mockAuthStore = {
  logout: vi.fn(() => Promise.resolve())
};

// Mock modules
vi.mock('$app/stores', () => ({
  page: writable({ url: { pathname: '/dashboard' } })
}));

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$lib/stores/auth.store', () => ({
  currentUser: mockCurrentUser,
  authStore: mockAuthStore
}));

describe('Layout Component - User Info in Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.set(null);
  });

  describe('User Information Display', () => {
    it('should display user info in header top-right section', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      // Check header section exists
      const header = container.querySelector('.sticky.top-0');
      expect(header).toBeTruthy();

      // Check user info is in header
      const headerUserSection = header?.querySelector('.flex.items-center.space-x-3');
      expect(headerUserSection).toBeTruthy();

      // Verify username is displayed
      const usernameElement = container.querySelector('p.text-sm.font-medium');
      expect(usernameElement?.textContent).toContain('TestUser');
    });

    it('should NOT display user info in sidebar', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      // Check sidebar doesn't have user info section
      const sidebar = container.querySelector('[variant="navy"]');
      const sidebarUserInfo = sidebar?.querySelector('.border-t.bg-surface-subtle');
      expect(sidebarUserInfo).toBeFalsy();
    });

    it('should use fallback username when user_name is not available', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'FallbackUser',
        role: 'user'
      });

      const { container } = render(Layout);

      const usernameElement = container.querySelector('p.text-sm.font-medium');
      expect(usernameElement?.textContent).toContain('FallbackUser');
    });

    it('should display default text when no user info available', async () => {
      mockCurrentUser.set({
        user_id: 1,
        role: 'user'
      });

      const { container } = render(Layout);

      const usernameElement = container.querySelector('p.text-sm.font-medium');
      expect(usernameElement?.textContent).toContain('Пользователь');
    });
  });

  describe('Responsive Behavior', () => {
    it('should hide user details on mobile screens', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      // Check for hidden md:flex class on user details
      const userDetails = container.querySelector('.hidden.md\\:flex');
      expect(userDetails).toBeTruthy();
    });

    it('should always show avatar and logout button', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      // Avatar should be visible
      const avatar = container.querySelector('.geometric-circle.w-8.h-8');
      expect(avatar).toBeTruthy();

      // Logout button should be visible
      const logoutButton = container.querySelector('[title="Выйти"]');
      expect(logoutButton).toBeTruthy();
    });
  });

  describe('Admin Badge Display', () => {
    it('should display admin badge for admin users', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'AdminUser',
        role: 'admin'
      });

      const { container } = render(Layout);

      // Check for admin badge
      const adminBadge = container.querySelector('[variant="outline"]');
      expect(adminBadge?.textContent).toContain('Админ');
    });

    it('should NOT display admin badge for regular users', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'RegularUser',
        role: 'user'
      });

      const { container } = render(Layout);

      // Check admin badge is not present
      const adminBadge = container.querySelector('[variant="outline"]');
      expect(adminBadge?.textContent).not.toContain('Админ');
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout when logout button is clicked', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      const logoutButton = container.querySelector('[title="Выйти"]');
      expect(logoutButton).toBeTruthy();

      if (logoutButton) {
        await fireEvent.click(logoutButton);
        expect(mockAuthStore.logout).toHaveBeenCalled();
      }
    });
  });

  describe('Username Truncation', () => {
    it('should truncate long usernames', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'VeryLongUsernameThisShouldBeTruncated',
        role: 'user'
      });

      const { container } = render(Layout);

      const usernameElement = container.querySelector('p.text-sm.font-medium.truncate.max-w-24');
      expect(usernameElement).toBeTruthy();
    });
  });

  describe('User ID Display', () => {
    it('should display user ID', async () => {
      mockCurrentUser.set({
        user_id: 123,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      const userIdElement = container.querySelector('p.text-xs.text-muted-foreground');
      expect(userIdElement?.textContent).toContain('ID: 123');
    });

    it('should fallback to id field when user_id is not available', async () => {
      mockCurrentUser.set({
        id: 456,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      const userIdElement = container.querySelector('p.text-xs.text-muted-foreground');
      expect(userIdElement?.textContent).toContain('ID: 456');
    });
  });

  describe('Layout Structure', () => {
    it('should position user info correctly in header with proper spacing', async () => {
      mockCurrentUser.set({
        user_id: 1,
        username: 'TestUser',
        role: 'user'
      });

      const { container } = render(Layout);

      // Check for proper flex layout in header
      const headerRightSection = container.querySelector('.flex.items-center.space-x-1');
      expect(headerRightSection).toBeTruthy();

      // Check for separator before user info
      const separator = container.querySelector('.border-l.border-muted-foreground\\/20');
      expect(separator).toBeTruthy();
    });
  });
});
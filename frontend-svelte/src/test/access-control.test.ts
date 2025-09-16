/**
 * Comprehensive tests for access control implementation.
 * Tests Layout.svelte navigation filtering, SettingsNavigation.svelte category filtering,
 * settings icon visibility, and role-based UI changes.
 *
 * Coverage:
 * - Navigation menu filtering based on admin status
 * - Settings icon visibility in header
 * - Settings categories filtering
 * - Page title changes for non-admin users
 * - User role badge display
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/svelte';
import { readable, writable, get } from 'svelte/store';
import { tick } from 'svelte';
import Layout from '$lib/components/common/Layout.svelte';
import SettingsNavigation from '$lib/components/settings/SettingsNavigation.svelte';
import type { User } from '$lib/types';

// Mock functions - declare before mocks
const mockGoto = vi.fn();

// Create mock stores factory
const createMockStores = () => {
  const mockCurrentUser = writable<User | null>(null);
  const mockAuthStore = {
    logout: vi.fn()
  };
  const mockIsAdmin = writable(false);

  const createMockPage = (pathname: string, search = '') => ({
    url: { pathname, search },
    params: {},
    route: { id: pathname },
    data: {}
  });

  const mockPage = writable(createMockPage('/dashboard'));

  return {
    mockCurrentUser,
    mockAuthStore,
    mockIsAdmin,
    mockPage,
    createMockPage
  };
};

// Initialize stores
const stores = createMockStores();

// Mock Svelte modules
vi.mock('$app/stores', () => ({
  page: stores.stores.mockPage
}));

vi.mock('$app/navigation', () => ({
  goto: mockGoto
}));

vi.mock('$lib/stores/auth.store', () => ({
  currentUser: stores.stores.mockCurrentUser,
  authStore: stores.mockAuthStore,
  isAdmin: stores.stores.mockIsAdmin
}));

// Mock components that might cause issues in testing
vi.mock('$lib/components/common/NotificationDropdown.svelte', () => ({
  default: {
    render: () => '<div data-testid="notifications">Notifications</div>'
  }
}));

// Mock Lucide icons
vi.mock('lucide-svelte', () => {
  const mockIcon = () => ({ render: () => '<svg data-testid="icon"></svg>' });
  return {
    Menu: mockIcon,
    X: mockIcon,
    Home: mockIcon,
    Calculator: mockIcon,
    CreditCard: mockIcon,
    BarChart3: mockIcon,
    Package: mockIcon,
    LogOut: mockIcon,
    User: mockIcon,
    Settings: mockIcon,
    Database: mockIcon,
    Calendar: mockIcon,
    Building2: mockIcon,
    Briefcase: mockIcon,
    Tags: mockIcon,
    Users: mockIcon,
    Shield: mockIcon,
    FileText: mockIcon,
    BookOpen: mockIcon,
    Share: mockIcon,
    ChevronRight: mockIcon
  };
});

describe('Access Control - Layout Navigation Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.stores.mockCurrentUser.set(null);
    stores.stores.mockIsAdmin.set(false);
    stores.stores.mockPage.set(stores.stores.createMockPage('/dashboard'));
  });

  afterEach(() => {
    cleanup();
  });

  describe('Navigation Menu - Admin vs Regular User', () => {
    it('should show all navigation items for admin users', async () => {
      // Set up admin user
      stores.stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.stores.mockIsAdmin.set(true);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should find all navigation items including Settings/Database
      expect(container.textContent).toContain('Главная');
      expect(container.textContent).toContain('Факт');
      expect(container.textContent).toContain('Бюджет');
      expect(container.textContent).toContain('Отчеты');
      expect(container.textContent).toContain('Продукты');
      expect(container.textContent).toContain('Справочники');

      // Count navigation buttons (base items + references item)
      const navButtons = container.querySelectorAll('nav button');
      expect(navButtons).toHaveLength(6); // 5 base + 1 reference
    });

    it('should hide Справочники navigation item for regular users', async () => {
      // Set up regular user
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'regular_user',
        user_name: 'Regular User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should show base navigation items
      expect(container.textContent).toContain('Главная');
      expect(container.textContent).toContain('Факт');
      expect(container.textContent).toContain('Бюджет');
      expect(container.textContent).toContain('Отчеты');
      expect(container.textContent).toContain('Продукты');

      // Should NOT show Справочники
      expect(container.textContent).not.toContain('Справочники');

      // Count navigation buttons (only base items)
      const navButtons = container.querySelectorAll('nav button');
      expect(navButtons).toHaveLength(5); // only base items
    });

    it('should reactively update navigation when admin status changes', async () => {
      // Start as regular user
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'user',
        user_name: 'User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Initially should not have Справочники
      expect(container.textContent).not.toContain('Справочники');
      expect(container.querySelectorAll('nav button')).toHaveLength(5);

      // Promote to admin
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'user',
        user_name: 'User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      await tick();

      // Now should show Справочники
      expect(container.textContent).toContain('Справочники');
      expect(container.querySelectorAll('nav button')).toHaveLength(6);
    });
  });

  describe('Settings Icon in Header', () => {
    it('should show Settings icon for admin users', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Look for Settings button in header (not in navigation)
      const headerArea = container.querySelector('[class*="sticky"][class*="top-0"]');
      expect(headerArea).toBeTruthy();

      // Settings button should be present
      const settingsButtons = container.querySelectorAll('button[title="Настройки"]');
      expect(settingsButtons.length).toBeGreaterThan(0);
    });

    it('should hide Settings icon for regular users', async () => {
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'regular_user',
        user_name: 'Regular User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Settings button should NOT be present in header
      const settingsButtons = container.querySelectorAll('button[title="Настройки"]');
      expect(settingsButtons).toHaveLength(0);
    });

    it('should call goto when Settings icon is clicked', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      const settingsButton = container.querySelector('button[title="Настройки"]');
      expect(settingsButton).toBeTruthy();

      // Click the settings button
      await fireEvent.click(settingsButton as Element);

      expect(mockGoto).toHaveBeenCalledWith('/settings');
    });
  });

  describe('Page Title Changes for Non-Admin Access', () => {
    it('should show "Доступ запрещен" for non-admin users on settings pages', async () => {
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'regular_user',
        user_name: 'Regular User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);
      stores.mockPage.set(stores.createMockPage('/settings/periods'));

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should show access denied message
      expect(container.textContent).toContain('Доступ запрещен');
    });

    it('should show proper page titles for admin users on settings pages', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const testCases = [
        { path: '/settings', expected: 'Администрирование' },
        { path: '/settings/periods', expected: 'Управление периодами' },
        { path: '/settings/financial-centers', expected: 'Управление ЦФО' },
        { path: '/settings/cost-centers', expected: 'Управление МВЗ' },
        { path: '/settings/nomenclatures', expected: 'Управление номенклатурами' },
        { path: '/settings/articles', expected: 'Управление статьями' }
      ];

      for (const testCase of testCases) {
        stores.mockPage.set(stores.createMockPage(testCase.path));

        const { container } = render(Layout, {
          props: {},
          context: new Map([
            ['$$slots', { default: () => 'Test content' }]
          ])
        });

        await tick();

        expect(container.textContent).toContain(testCase.expected);
        cleanup();
      }
    });
  });

  describe('User Role Badge Display', () => {
    it('should display admin badge for admin users', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should show admin badge
      expect(container.textContent).toContain('Админ');

      // Badge should have proper styling
      const badge = container.querySelector('[class*="bg-primary/10"][class*="text-primary"]');
      expect(badge).toBeTruthy();
    });

    it('should not display admin badge for regular users', async () => {
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'regular_user',
        user_name: 'Regular User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should NOT show admin badge
      expect(container.textContent).not.toContain('Админ');
    });
  });
});

describe('Access Control - Settings Navigation Category Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.mockCurrentUser.set(null);
    stores.mockIsAdmin.set(false);
    stores.mockPage.set(stores.createMockPage('/settings'));
  });

  afterEach(() => {
    cleanup();
  });

  describe('Settings Categories Visibility', () => {
    it('should show all categories for admin users', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(SettingsNavigation);

      await tick();

      // Should show all three categories
      expect(container.textContent).toContain('Справочники');
      expect(container.textContent).toContain('Каталоги');
      expect(container.textContent).toContain('Система');

      // Should show category descriptions
      expect(container.textContent).toContain('Основные справочники системы');
      expect(container.textContent).toContain('Управление каталогами и категориями');
      expect(container.textContent).toContain('Системные настройки и безопасность');

      // Count category cards
      const categoryCards = container.querySelectorAll('[class*="grid"] > *');
      expect(categoryCards.length).toBeGreaterThanOrEqual(3);
    });

    it('should show NO categories for regular users', async () => {
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'regular_user',
        user_name: 'Regular User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      const { container } = render(SettingsNavigation);

      await tick();

      // Should show NO categories
      expect(container.textContent).not.toContain('Справочники');
      expect(container.textContent).not.toContain('Каталоги');
      expect(container.textContent).not.toContain('Система');

      // Grid should be empty
      const categoryCards = container.querySelectorAll('[class*="grid"] > *');
      expect(categoryCards).toHaveLength(0);
    });

    it('should reactively update categories when admin status changes', async () => {
      // Start as regular user
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'user',
        user_name: 'User',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      const { container } = render(SettingsNavigation);

      await tick();

      // Initially should not show categories
      expect(container.textContent).not.toContain('Справочники');
      expect(container.querySelectorAll('[class*="grid"] > *')).toHaveLength(0);

      // Promote to admin
      stores.mockCurrentUser.set({
        id: 2,
        user_id: 2,
        username: 'user',
        user_name: 'User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      await tick();

      // Now should show categories
      expect(container.textContent).toContain('Справочники');
      expect(container.textContent).toContain('Каталоги');
      expect(container.textContent).toContain('Система');
    });
  });

  describe('Settings Items Navigation', () => {
    it('should show correct items within each category for admin users', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(SettingsNavigation);

      await tick();

      // Reference data items
      expect(container.textContent).toContain('Периоды');
      expect(container.textContent).toContain('Финансовые центры');
      expect(container.textContent).toContain('Центры затрат');

      // Catalog data items
      expect(container.textContent).toContain('Статьи');
      expect(container.textContent).toContain('Номенклатуры');
      expect(container.textContent).toContain('Продукты');

      // System settings items
      expect(container.textContent).toContain('Пользователи');
      expect(container.textContent).toContain('Безопасность');
      expect(container.textContent).toContain('Импорт/Экспорт');
    });

    it('should call navigation function when settings item is clicked', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(SettingsNavigation);

      await tick();

      // Find first settings item button and click it
      const settingsButtons = container.querySelectorAll('button[class*="w-full"]');
      expect(settingsButtons.length).toBeGreaterThan(0);

      await fireEvent.click(settingsButtons[0]);

      // Should call goto function
      expect(mockGoto).toHaveBeenCalled();
    });
  });

  describe('Current Path Highlighting', () => {
    it('should highlight active settings page', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);
      stores.mockPage.set(stores.createMockPage('/settings/periods'));

      const { container } = render(SettingsNavigation);

      await tick();

      // Should highlight the active periods item
      const activeItems = container.querySelectorAll('[class*="border-l-4"]');
      expect(activeItems.length).toBeGreaterThan(0);
    });
  });

  describe('Color Coding and Visual Design', () => {
    it('should apply correct color classes to different categories', async () => {
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin_user',
        user_name: 'Admin User',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container } = render(SettingsNavigation);

      await tick();

      // Should have different color backgrounds for categories
      expect(container.querySelector('[class*="bg-blue"]')).toBeTruthy();
      expect(container.querySelector('[class*="bg-green"]')).toBeTruthy();
      expect(container.querySelector('[class*="bg-purple"]')).toBeTruthy();
    });
  });
});

describe('Access Control - Edge Cases and Error States', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stores.mockCurrentUser.set(null);
    stores.mockIsAdmin.set(false);
  });

  afterEach(() => {
    cleanup();
  });

  describe('Undefined or Null User States', () => {
    it('should handle null user gracefully in Layout', async () => {
      stores.mockCurrentUser.set(null);
      stores.mockIsAdmin.set(false);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should show default user text
      expect(container.textContent).toContain('Пользователь');

      // Should only show base navigation
      expect(container.textContent).not.toContain('Справочники');
      expect(container.querySelectorAll('nav button')).toHaveLength(5);
    });

    it('should handle null user gracefully in SettingsNavigation', async () => {
      stores.mockCurrentUser.set(null);
      stores.mockIsAdmin.set(false);

      const { container } = render(SettingsNavigation);

      await tick();

      // Should show no categories
      expect(container.querySelectorAll('[class*="grid"] > *')).toHaveLength(0);
    });
  });

  describe('User Without Role Property', () => {
    it('should treat user without role as regular user', async () => {
      stores.mockCurrentUser.set({
        id: 3,
        user_id: 3,
        username: 'no_role_user',
        user_name: 'No Role User'
        // no role property
      } as User);
      stores.mockIsAdmin.set(false);

      const { container } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      await tick();

      // Should behave as regular user
      expect(container.textContent).not.toContain('Справочники');
      expect(container.textContent).not.toContain('Админ');
      expect(container.querySelectorAll('button[title="Настройки"]')).toHaveLength(0);
    });
  });

  describe('Store Synchronization', () => {
    it('should keep Layout and SettingsNavigation in sync with isAdmin store', async () => {
      // Start with admin
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin',
        user_name: 'Admin',
        role: 'admin'
      });
      stores.mockIsAdmin.set(true);

      const { container: layoutContainer } = render(Layout, {
        props: {},
        context: new Map([
          ['$$slots', { default: () => 'Test content' }]
        ])
      });

      const { container: settingsContainer } = render(SettingsNavigation);

      await tick();

      // Both should show admin content
      expect(layoutContainer.textContent).toContain('Справочники');
      expect(settingsContainer.textContent).toContain('Справочники');

      // Change to regular user
      stores.mockCurrentUser.set({
        id: 1,
        user_id: 1,
        username: 'admin',
        user_name: 'Admin',
        role: 'user'
      });
      stores.mockIsAdmin.set(false);

      await tick();

      // Both should hide admin content
      expect(layoutContainer.textContent).not.toContain('Справочники');
      expect(settingsContainer.textContent).not.toContain('Справочники');

      cleanup();
    });
  });
});
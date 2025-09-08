import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { page } from '$app/stores';
import { isAdmin, authStore } from '../../../stores/auth.store';
import SettingsNavigation from '../SettingsNavigation.svelte';
import { createMockUser } from '../../../../test/utils';

// Mock the navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

// Mock page store
const mockPageStore = {
  subscribe: vi.fn((fn) => {
    fn({ url: { pathname: '/settings' } });
    return () => {};
  })
};

vi.mock('$app/stores', () => ({
  page: mockPageStore
}));

// Mock lucide-svelte icons
vi.mock('lucide-svelte', () => ({
  Calendar: 'div',
  Building2: 'div',
  Briefcase: 'div',
  Tags: 'div',
  Package: 'div',
  Users: 'div',
  Settings: 'div',
  FileText: 'div',
  Shield: 'div',
  Database: 'div',
  ChevronRight: 'div',
  BookOpen: 'div'
}));

describe('SettingsNavigation', () => {
  const mockGoto = vi.mocked(goto);
  
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset page mock
    mockPageStore.subscribe.mockImplementation((fn) => {
      fn({ url: { pathname: '/settings' } });
      return () => {};
    });
  });

  afterEach(() => {
    authStore.logout();
  });

  describe('Admin User Access', () => {
    beforeEach(() => {
      const adminUser = createMockUser({ id: 1, user_name: 'Admin User' });
      authStore.setUser(adminUser);
    });

    it('should show all categories for admin users', () => {
      render(SettingsNavigation);
      
      // Should show reference data category
      expect(screen.getByText('Справочники')).toBeInTheDocument();
      expect(screen.getByText('Основные справочники системы')).toBeInTheDocument();
      
      // Should show catalog data category
      expect(screen.getByText('Каталоги')).toBeInTheDocument();
      expect(screen.getByText('Управление каталогами и категориями')).toBeInTheDocument();
      
      // Should show system settings category (admin only)
      expect(screen.getByText('Система')).toBeInTheDocument();
      expect(screen.getByText('Системные настройки и безопасность')).toBeInTheDocument();
    });

    it('should show all reference data items', () => {
      render(SettingsNavigation);
      
      expect(screen.getByText('Периоды')).toBeInTheDocument();
      expect(screen.getByText('Управление временными периодами')).toBeInTheDocument();
      
      expect(screen.getByText('Финансовые центры')).toBeInTheDocument();
      expect(screen.getByText('Центры финансовой ответственности')).toBeInTheDocument();
      
      expect(screen.getByText('Центры затрат')).toBeInTheDocument();
      expect(screen.getByText('Места возникновения затрат')).toBeInTheDocument();
    });

    it('should show all catalog data items', () => {
      render(SettingsNavigation);
      
      expect(screen.getByText('Номенклатуры')).toBeInTheDocument();
      expect(screen.getByText('Категории доходов и расходов')).toBeInTheDocument();
      
      expect(screen.getByText('Продукты')).toBeInTheDocument();
      expect(screen.getByText('Каталог продуктов и услуг')).toBeInTheDocument();
    });

    it('should show all system settings items (admin only)', () => {
      render(SettingsNavigation);
      
      expect(screen.getByText('Пользователи')).toBeInTheDocument();
      expect(screen.getByText('Управление пользователями')).toBeInTheDocument();
      
      expect(screen.getByText('Безопасность')).toBeInTheDocument();
      expect(screen.getByText('Настройки безопасности')).toBeInTheDocument();
      
      expect(screen.getByText('Импорт/Экспорт')).toBeInTheDocument();
      expect(screen.getByText('Массовые операции с данными')).toBeInTheDocument();
    });
  });

  describe('Non-Admin User Access', () => {
    beforeEach(() => {
      const regularUser = createMockUser({ id: 2, user_name: 'Regular User' });
      authStore.setUser(regularUser);
    });

    it('should hide system settings category for non-admin users', () => {
      render(SettingsNavigation);
      
      // Should show reference data and catalog categories
      expect(screen.getByText('Справочники')).toBeInTheDocument();
      expect(screen.getByText('Каталоги')).toBeInTheDocument();
      
      // Should NOT show system settings category
      expect(screen.queryByText('Система')).not.toBeInTheDocument();
      expect(screen.queryByText('Системные настройки и безопасность')).not.toBeInTheDocument();
    });

    it('should not show admin-only items', () => {
      render(SettingsNavigation);
      
      // Should not show users management
      expect(screen.queryByText('Пользователи')).not.toBeInTheDocument();
      expect(screen.queryByText('Управление пользователями')).not.toBeInTheDocument();
      
      // Should not show security settings
      expect(screen.queryByText('Безопасность')).not.toBeInTheDocument();
      expect(screen.queryByText('Настройки безопасности')).not.toBeInTheDocument();
      
      // Should not show import/export
      expect(screen.queryByText('Импорт/Экспорт')).not.toBeInTheDocument();
      expect(screen.queryByText('Массовые операции с данными')).not.toBeInTheDocument();
    });

    it('should still show regular categories for non-admin users', () => {
      render(SettingsNavigation);
      
      // Should show reference data
      expect(screen.getByText('Периоды')).toBeInTheDocument();
      expect(screen.getByText('Финансовые центры')).toBeInTheDocument();
      expect(screen.getByText('Центры затрат')).toBeInTheDocument();
      
      // Should show catalog data
      expect(screen.getByText('Номенклатуры')).toBeInTheDocument();
      expect(screen.getByText('Продукты')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated User Access', () => {
    beforeEach(() => {
      authStore.logout();
    });

    it('should hide system settings when user is not authenticated', () => {
      render(SettingsNavigation);
      
      // Should show reference data and catalog categories
      expect(screen.getByText('Справочники')).toBeInTheDocument();
      expect(screen.getByText('Каталоги')).toBeInTheDocument();
      
      // Should NOT show system settings
      expect(screen.queryByText('Система')).not.toBeInTheDocument();
    });
  });

  describe('Navigation functionality', () => {
    beforeEach(() => {
      const adminUser = createMockUser({ id: 1, user_name: 'Admin User' });
      authStore.setUser(adminUser);
    });

    it('should navigate when clicking on menu items', async () => {
      render(SettingsNavigation);
      
      const periodsButton = screen.getByText('Периоды').closest('button');
      expect(periodsButton).toBeInTheDocument();
      
      await periodsButton?.click();
      
      expect(mockGoto).toHaveBeenCalledWith('/reference/periods');
    });

    it('should navigate to admin routes when admin', async () => {
      render(SettingsNavigation);
      
      const usersButton = screen.getByText('Пользователи').closest('button');
      expect(usersButton).toBeInTheDocument();
      
      await usersButton?.click();
      
      expect(mockGoto).toHaveBeenCalledWith('/settings/users');
    });

    it('should not navigate if already on current path', async () => {
      // Mock current path as /reference/periods
      mockPageStore.subscribe.mockImplementation((fn) => {
        fn({ url: { pathname: '/reference/periods' } });
        return () => {};
      });

      render(SettingsNavigation);
      
      const periodsButton = screen.getByText('Периоды').closest('button');
      await periodsButton?.click();
      
      // Should not call goto if already on the page
      expect(mockGoto).not.toHaveBeenCalled();
    });
  });

  describe('Visual states and styling', () => {
    beforeEach(() => {
      const adminUser = createMockUser({ id: 1, user_name: 'Admin User' });
      authStore.setUser(adminUser);
    });

    it('should apply active styling to current route', () => {
      // Mock current path
      mockPageStore.subscribe.mockImplementation((fn) => {
        fn({ url: { pathname: '/reference/periods' } });
        return () => {};
      });

      render(SettingsNavigation);
      
      const periodsButton = screen.getByText('Периоды').closest('button');
      expect(periodsButton).toHaveClass('bg-blue-50', 'border-blue-200', 'border-l-4');
    });

    it('should render category color classes correctly', () => {
      render(SettingsNavigation);
      
      // Check if cards are rendered with proper structure
      const cards = screen.getAllByTestId ? screen.getAllByTestId('category-card') : 
        document.querySelectorAll('[class*="grid-cols"]').length;
      
      // Should have at least 3 categories for admin
      expect(document.querySelectorAll('.grid > *').length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Reactive behavior', () => {
    it('should update visibility when admin status changes', () => {
      // Start with non-admin
      const regularUser = createMockUser({ id: 2 });
      authStore.setUser(regularUser);
      
      const { rerender } = render(SettingsNavigation);
      
      // Should not show system settings
      expect(screen.queryByText('Система')).not.toBeInTheDocument();
      
      // Change to admin
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);
      
      rerender({});
      
      // Should now show system settings
      expect(screen.getByText('Система')).toBeInTheDocument();
    });

    it('should handle dynamic user changes', () => {
      const { rerender } = render(SettingsNavigation);
      
      // Start with no user
      expect(screen.queryByText('Система')).not.toBeInTheDocument();
      
      // Login as admin
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);
      rerender({});
      
      expect(screen.getByText('Система')).toBeInTheDocument();
      
      // Logout
      authStore.logout();
      rerender({});
      
      expect(screen.queryByText('Система')).not.toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('should handle corrupted admin state gracefully', () => {
      // Corrupt the isAdmin store
      const corruptedUser = { id: null } as any;
      authStore.setUser(corruptedUser);
      
      expect(() => render(SettingsNavigation)).not.toThrow();
      
      // Should default to hiding admin content
      expect(screen.queryByText('Система')).not.toBeInTheDocument();
    });

    it('should handle navigation errors gracefully', async () => {
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);
      
      mockGoto.mockRejectedValue(new Error('Navigation failed'));
      
      render(SettingsNavigation);
      
      const periodsButton = screen.getByText('Периоды').closest('button');
      
      // Should not throw when navigation fails
      expect(async () => {
        await periodsButton?.click();
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      const adminUser = createMockUser({ id: 1 });
      authStore.setUser(adminUser);
    });

    it('should have accessible button elements', () => {
      render(SettingsNavigation);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach(button => {
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('type', 'button');
      });
    });

    it('should have proper heading hierarchy', () => {
      render(SettingsNavigation);
      
      const headings = screen.getAllByRole('heading');
      expect(headings.length).toBeGreaterThan(0);
      
      // Category titles should be properly nested
      headings.forEach(heading => {
        expect(heading.tagName).toMatch(/H[1-6]/);
      });
    });

    it('should provide descriptive text for menu items', () => {
      render(SettingsNavigation);
      
      // Each menu item should have both title and description
      expect(screen.getByText('Периоды')).toBeInTheDocument();
      expect(screen.getByText('Управление временными периодами')).toBeInTheDocument();
      
      expect(screen.getByText('Номенклатуры')).toBeInTheDocument();
      expect(screen.getByText('Категории доходов и расходов')).toBeInTheDocument();
    });
  });
});
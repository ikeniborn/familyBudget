import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { Layout } from './Layout';
import { useAuthStore } from '@/stores/authStore';
import fixtures from '@/test/fixtures';

// Mock the auth store
jest.mock('@/stores/authStore');

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard' }),
}));

describe('Layout', () => {
  const mockLogout = jest.fn();
  const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: fixtures.users.activeUser,
        logout: mockLogout,
      };
      return selector(state as any);
    });
  });

  it('should render children content', () => {
    customRender(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should display logo', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('💰 FamilyBudget')).toBeInTheDocument();
  });

  it('should render all navigation items', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('Главная')).toBeInTheDocument();
    expect(screen.getByText('Факт')).toBeInTheDocument();
    expect(screen.getByText('Бюджет')).toBeInTheDocument();
    expect(screen.getByText('Отчеты')).toBeInTheDocument();
    expect(screen.getByText('Продукты')).toBeInTheDocument();
    expect(screen.getByText('Валидация форм')).toBeInTheDocument();
  });

  it('should highlight active navigation item', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const dashboardLink = screen.getByRole('link', { name: /главная/i });
    expect(dashboardLink.parentElement).toHaveClass('bg-blue-600', 'text-white');
  });

  it('should display user information', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText(fixtures.users.activeUser.telegram_first_name!)).toBeInTheDocument();
    expect(screen.getByText(`ID: ${fixtures.users.activeUser.id}`)).toBeInTheDocument();
  });

  it('should handle logout', async () => {
    const { user } = customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const logoutButton = screen.getByTitle('Выйти');
    await user.click(logoutButton);

    expect(mockLogout).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('should show mobile menu button on small screens', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    // Mobile menu button should be present (but may be hidden on desktop)
    const mobileMenuButtons = screen.getAllByRole('button');
    const menuButton = mobileMenuButtons.find(btn => 
      btn.querySelector('svg.lucide-menu')
    );
    expect(menuButton).toBeInTheDocument();
  });

  it('should toggle mobile sidebar', async () => {
    const { user } = customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    // Find mobile menu button
    const mobileMenuButtons = screen.getAllByRole('button');
    const menuButton = mobileMenuButtons.find(btn => 
      btn.querySelector('svg.lucide-menu')
    );

    // Initially sidebar should be closed (transformed off-screen)
    const sidebar = document.querySelector('.fixed.inset-y-0.left-0');
    expect(sidebar).toHaveClass('-translate-x-full');

    // Open sidebar
    if (menuButton) {
      await user.click(menuButton);
      expect(sidebar).toHaveClass('translate-x-0');
    }
  });

  it('should close mobile sidebar when backdrop is clicked', async () => {
    const { user } = customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    // Open sidebar first
    const menuButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('svg.lucide-menu')
    );
    
    if (menuButton) {
      await user.click(menuButton);
      
      // Click backdrop
      const backdrop = document.querySelector('.fixed.inset-0.z-30.bg-black\\/50');
      expect(backdrop).toBeInTheDocument();
      
      if (backdrop) {
        await user.click(backdrop);
        const sidebar = document.querySelector('.fixed.inset-y-0.left-0');
        expect(sidebar).toHaveClass('-translate-x-full');
      }
    }
  });

  it('should display current page title', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>,
      {
        routerProps: {
          initialEntries: ['/dashboard'],
        },
      }
    );

    expect(screen.getByText('Главная')).toBeInTheDocument();
    expect(screen.getByText('Управление семейным бюджетом')).toBeInTheDocument();
  });

  it('should show notification badge', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const badge = screen.getByText('3');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('badge');
  });

  it('should render settings button', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const settingsButton = screen.getAllByRole('button').find(btn =>
      btn.querySelector('svg.lucide-settings')
    );
    expect(settingsButton).toBeInTheDocument();
  });

  it('should handle user without first_name', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { ...fixtures.users.activeUser, telegram_first_name: null },
        logout: mockLogout,
      };
      return selector(state as any);
    });

    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText(fixtures.users.activeUser.username)).toBeInTheDocument();
  });

  it('should handle user without any name', () => {
    mockUseAuthStore.mockImplementation((selector) => {
      const state = {
        user: { 
          ...fixtures.users.activeUser, 
          telegram_first_name: null,
          username: null 
        },
        logout: mockLogout,
      };
      return selector(state as any);
    });

    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    expect(screen.getByText('Пользователь')).toBeInTheDocument();
  });

  it('should navigate when clicking nav items', async () => {
    const { user } = customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const factsLink = screen.getByRole('link', { name: /факт/i });
    await user.click(factsLink);

    // Should navigate to /fact route
    expect(factsLink).toHaveAttribute('href', '/fact');
  });

  it('should have sticky top bar', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const topBar = document.querySelector('.sticky.top-0');
    expect(topBar).toBeInTheDocument();
    expect(topBar).toHaveClass('z-10');
  });

  it('should apply gradient background', () => {
    customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    const container = document.querySelector('.min-h-screen.bg-gradient-to-br');
    expect(container).toBeInTheDocument();
    expect(container).toHaveClass('from-slate-50', 'to-slate-100');
  });

  it('should close sidebar when navigation link is clicked on mobile', async () => {
    const { user } = customRender(
      <Layout>
        <div>Content</div>
      </Layout>
    );

    // Open sidebar
    const menuButton = screen.getAllByRole('button').find(btn => 
      btn.querySelector('svg.lucide-menu')
    );
    
    if (menuButton) {
      await user.click(menuButton);
      
      // Click a nav link
      const budgetLink = screen.getByRole('link', { name: /бюджет/i });
      await user.click(budgetLink);
      
      // Sidebar should close
      const sidebar = document.querySelector('.fixed.inset-y-0.left-0');
      expect(sidebar).toHaveClass('-translate-x-full');
    }
  });
});
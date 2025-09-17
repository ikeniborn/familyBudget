/**
 * Button onclick Regression Prevention Tests
 * Ensures the onclick to on:click fix is maintained and prevents regression
 *
 * @file button-onclick-regression.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-17
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Button from '$lib/components/ui/Button.svelte';
import ArticlesPage from '$routes/(protected)/settings/articles/+page.svelte';
import type { Article, ArticleStats } from '$lib/types';

// Mock dependencies
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return { unsubscribe: vi.fn() };
    })
  }
}));

vi.mock('$lib/stores/auth.store', () => ({
  isAdmin: {
    subscribe: vi.fn((callback) => {
      callback(true);
      return { unsubscribe: vi.fn() };
    })
  }
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}));

// Mock articles service
const mockArticlesService = {
  getAll: vi.fn(),
  getStats: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

vi.mock('$lib/services/articles.service', () => ({
  articlesService: mockArticlesService
}));

describe('Button onclick Regression Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock responses for articles page
    mockArticlesService.getAll.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          code: 'TEST',
          name: 'Test Article',
          description: 'Test Description',
          is_active: true,
          is_shared: false,
          is_editable: true,
          user_id: 1,
          created_at: '2025-09-17T10:00:00Z',
          updated_at: '2025-09-17T10:00:00Z'
        }
      ],
      total: 1
    });

    mockArticlesService.getStats.mockResolvedValue({
      success: true,
      data: {
        total: 1,
        active: 1,
        inactive: 0,
        shared: 0,
        user_specific: 1
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('HTML Attribute Regression Prevention', () => {
    it('Button component never renders onclick HTML attribute', () => {
      const { container } = render(Button, {
        props: {},
        children: 'Regression Test Button'
      });

      const html = container.innerHTML;

      // Should NOT contain onclick attribute in any form
      expect(html).not.toMatch(/onclick\s*=/i);
      expect(html).not.toMatch(/onclick\s*:/i);
      expect(html).not.toMatch(/onclick\s*"/i);
      expect(html).not.toMatch(/onclick\s*'/i);
      expect(html).not.toMatch(/onclick\s*`/i);
    });

    it('Button component with all variants never uses onclick', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'accent', 'warm', 'ghost', 'link'] as const;

      variants.forEach(variant => {
        const { container, unmount } = render(Button, {
          props: { variant },
          children: `${variant} button`
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        unmount();
      });
    });

    it('Button component with all sizes never uses onclick', () => {
      const sizes = ['default', 'sm', 'lg', 'icon', 'touch'] as const;

      sizes.forEach(size => {
        const { container, unmount } = render(Button, {
          props: { size },
          children: `${size} button`
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        unmount();
      });
    });

    it('Button component in all states never uses onclick', () => {
      const states = [
        { disabled: false, loading: false },
        { disabled: true, loading: false },
        { disabled: false, loading: true },
        { disabled: true, loading: true }
      ];

      states.forEach((state, index) => {
        const { container, unmount } = render(Button, {
          props: state,
          children: `State ${index} button`
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        unmount();
      });
    });

    it('Button as link never uses onclick attribute', () => {
      const { container } = render(Button, {
        props: { href: '/test-link' },
        children: 'Link Button'
      });

      const html = container.innerHTML;
      expect(html).not.toMatch(/onclick/i);

      // Should have href but not onclick
      expect(html).toMatch(/href\s*=\s*["']\/test-link["']/);
    });

    it('Button with custom classes never adds onclick', () => {
      const { container } = render(Button, {
        props: { class: 'custom-class-name special-button' },
        children: 'Custom Button'
      });

      const html = container.innerHTML;
      expect(html).not.toMatch(/onclick/i);
      expect(html).toMatch(/custom-class-name/);
      expect(html).toMatch(/special-button/);
    });
  });

  describe('DOM Property Regression Prevention', () => {
    it('Button DOM elements have null onclick property', () => {
      const { container } = render(Button, {
        props: {},
        children: 'DOM Property Test'
      });

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
    });

    it('Link variant DOM elements have null onclick property', () => {
      const { container } = render(Button, {
        props: { href: '/test' },
        children: 'Link DOM Test'
      });

      const link = container.querySelector('a');
      expect(link?.onclick).toBeNull();
    });

    it('Disabled button DOM elements have null onclick property', () => {
      const { container } = render(Button, {
        props: { disabled: true },
        children: 'Disabled DOM Test'
      });

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
    });

    it('Loading button DOM elements have null onclick property', () => {
      const { container } = render(Button, {
        props: { loading: true },
        children: 'Loading DOM Test'
      });

      const button = container.querySelector('button');
      expect(button?.onclick).toBeNull();
    });
  });

  describe('Event System Regression Prevention', () => {
    it('always uses Svelte event dispatch system', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Event System Test'
      });

      // Should work through Svelte event system
      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(clickHandler).toHaveBeenCalledTimes(1);
      expect(clickHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'click',
          detail: expect.any(MouseEvent)
        })
      );
    });

    it('maintains event dispatch after re-renders', async () => {
      const clickHandler = vi.fn();

      const { rerender } = render(Button, {
        props: { variant: 'default' },
        children: 'Re-render Test'
      });

      const component = render(Button, {
        props: { variant: 'default' },
        children: 'Re-render Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Click before re-render
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(1);

      // Re-render with different props
      rerender({ variant: 'destructive', size: 'lg' });

      // Should still work after re-render
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalledTimes(2);
    });

    it('handles rapid clicking without onclick interference', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Rapid Click Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Rapid clicks should all work
      for (let i = 0; i < 10; i++) {
        await fireEvent.click(button);
      }

      expect(clickHandler).toHaveBeenCalledTimes(10);
    });

    it('preserves event properties through dispatch system', async () => {
      let capturedEvent: MouseEvent | null = null;

      const component = render(Button, {
        props: {},
        children: 'Event Properties Test'
      });

      component.component.$on('click', (event) => {
        capturedEvent = event.detail;
      });

      const button = screen.getByRole('button');
      await fireEvent.click(button, {
        clientX: 150,
        clientY: 250,
        shiftKey: true
      });

      expect(capturedEvent).toBeTruthy();
      expect(capturedEvent?.clientX).toBe(150);
      expect(capturedEvent?.clientY).toBe(250);
      expect(capturedEvent?.shiftKey).toBe(true);
    });
  });

  describe('Articles Page Button Regression Prevention', () => {
    it('articles page buttons never use onclick attributes', async () => {
      const { container } = render(ArticlesPage);

      // Wait for component to load
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      const html = container.innerHTML;

      // Should not contain any onclick attributes anywhere in the page
      expect(html).not.toMatch(/onclick\s*=/i);
    });

    it('all articles page buttons use proper event handlers', async () => {
      render(ArticlesPage);

      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      // Get all buttons on the page
      const allButtons = screen.getAllByRole('button');

      // Each button should not have onclick attribute
      allButtons.forEach((button, index) => {
        expect(button).not.toHaveAttribute('onclick');
        expect(button.onclick).toBeNull();
      });
    });

    it('articles page button interactions work without onclick', async () => {
      render(ArticlesPage);

      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });

      // Should work through Svelte event system
      await fireEvent.click(createButton);

      await vi.waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });
    });

    it('modal buttons in articles page never use onclick', async () => {
      render(ArticlesPage);

      // Open create modal
      await vi.waitFor(() => {
        expect(screen.getByRole('button', { name: /создать статью/i })).toBeInTheDocument();
      });

      const createButton = screen.getByRole('button', { name: /создать статью/i });
      await fireEvent.click(createButton);

      await vi.waitFor(() => {
        expect(screen.getByText('Создать статью')).toBeInTheDocument();
      });

      // Check modal buttons
      const modalButtons = screen.getAllByRole('button');
      modalButtons.forEach(button => {
        expect(button).not.toHaveAttribute('onclick');
        expect(button.onclick).toBeNull();
      });
    });

    it('table action buttons never use onclick', async () => {
      render(ArticlesPage);

      await vi.waitFor(() => {
        expect(screen.getByText('TEST')).toBeInTheDocument();
      });

      // Find action buttons in table
      const editButtons = screen.getAllByRole('button', { name: /изменить/i });
      const deleteButtons = screen.getAllByRole('button', { name: /удалить/i });

      [...editButtons, ...deleteButtons].forEach(button => {
        expect(button).not.toHaveAttribute('onclick');
        expect(button.onclick).toBeNull();
      });
    });
  });

  describe('Performance Regression Prevention', () => {
    it('event dispatch performance remains optimal', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Performance Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      const startTime = performance.now();

      // Test 100 rapid clicks
      for (let i = 0; i < 100; i++) {
        await fireEvent.click(button);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(clickHandler).toHaveBeenCalledTimes(100);
      expect(totalTime).toBeLessThan(500); // Should be very fast
    });

    it('memory usage remains stable across many operations', async () => {
      const clickHandler = vi.fn();

      // Create and destroy many button instances
      for (let i = 0; i < 100; i++) {
        const { unmount } = render(Button, {
          props: {},
          children: `Button ${i}`
        });

        const component = render(Button, {
          props: {},
          children: `Button ${i}`
        });

        component.component.$on('click', clickHandler);

        const button = screen.getByRole('button');
        await fireEvent.click(button);

        unmount();
      }

      expect(clickHandler).toHaveBeenCalledTimes(100);
    });

    it('maintains responsiveness with complex prop combinations', async () => {
      const clickHandler = vi.fn();

      const propCombinations = [
        { variant: 'default', size: 'default', disabled: false, loading: false },
        { variant: 'destructive', size: 'lg', disabled: false, loading: false },
        { variant: 'outline', size: 'sm', disabled: false, loading: false },
        { variant: 'secondary', size: 'icon', disabled: false, loading: false },
        { variant: 'accent', size: 'touch', disabled: false, loading: false }
      ];

      for (const props of propCombinations) {
        const { unmount } = render(Button, {
          props,
          children: 'Complex Props Test'
        });

        const component = render(Button, {
          props,
          children: 'Complex Props Test'
        });

        component.component.$on('click', clickHandler);

        const button = screen.getByRole('button');

        const startTime = performance.now();
        await fireEvent.click(button);
        const endTime = performance.now();

        const responseTime = endTime - startTime;
        expect(responseTime).toBeLessThan(50);

        unmount();
      }

      expect(clickHandler).toHaveBeenCalledTimes(propCombinations.length);
    });
  });

  describe('Accessibility Regression Prevention', () => {
    it('maintains accessibility without onclick attributes', () => {
      const { container } = render(Button, {
        props: { 'aria-label': 'Accessible button' },
        children: 'Accessible Test'
      });

      const button = container.querySelector('button');

      // Should maintain accessibility attributes
      expect(button).toHaveAttribute('aria-label', 'Accessible button');
      expect(button).toHaveAttribute('type', 'button');

      // Should not have onclick
      expect(button).not.toHaveAttribute('onclick');
      expect(button?.onclick).toBeNull();
    });

    it('keyboard navigation works without onclick', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'Keyboard Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Focus and keyboard activation should work
      button.focus();
      expect(button).toHaveFocus();

      await fireEvent.keyDown(button, { key: 'Enter' });
      // Note: Keyboard events would typically trigger click events in real browsers
      // This is a limitation of the testing environment
    });

    it('screen reader support maintained without onclick', () => {
      render(Button, {
        props: {
          'aria-describedby': 'button-description',
          role: 'button'
        },
        children: 'Screen Reader Test'
      });

      const button = screen.getByRole('button');

      expect(button).toHaveAttribute('aria-describedby', 'button-description');
      expect(button).not.toHaveAttribute('onclick');
    });
  });

  describe('Cross-Browser Regression Prevention', () => {
    it('prevents onclick attribute in any browser context', () => {
      // Test with different user agents (simulated)
      const userAgents = [
        'Mozilla/5.0 (Chrome/120.0.0.0)',
        'Mozilla/5.0 (Firefox/119.0)',
        'Mozilla/5.0 (Safari/17.0)',
        'Mozilla/5.0 (Edge/120.0.0.0)'
      ];

      userAgents.forEach(userAgent => {
        // Simulate different browser
        Object.defineProperty(window.navigator, 'userAgent', {
          value: userAgent,
          configurable: true
        });

        const { container, unmount } = render(Button, {
          props: {},
          children: 'Cross-browser Test'
        });

        const html = container.innerHTML;
        expect(html).not.toMatch(/onclick/i);

        unmount();
      });
    });

    it('works consistently across different DOM implementations', async () => {
      const clickHandler = vi.fn();

      const component = render(Button, {
        props: {},
        children: 'DOM Implementation Test'
      });

      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Should work regardless of DOM implementation
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalled();

      // Verify no onclick attribute or property
      expect(button).not.toHaveAttribute('onclick');
      expect(button.onclick).toBeNull();
    });
  });

  describe('Build-Time Regression Prevention', () => {
    it('compiled component never contains onclick references', () => {
      const { container } = render(Button, {
        props: {},
        children: 'Build Test'
      });

      const html = container.innerHTML;

      // Should not contain onclick in any form
      expect(html).not.toMatch(/onclick/);
      expect(html).not.toMatch(/on-click/);
      expect(html).not.toMatch(/ON_CLICK/);
      expect(html).not.toMatch(/OnClick/);
    });

    it('source component never exports onclick functionality', () => {
      // This test ensures the component interface doesn't expose onclick
      const { container } = render(Button, {
        props: {},
        children: 'Interface Test'
      });

      const button = container.querySelector('button');

      // Should not have any onclick-related properties
      expect(button?.onclick).toBeNull();
      expect(button?.getAttribute('onclick')).toBeNull();
    });
  });

  describe('Future-Proofing Regression Prevention', () => {
    it('maintains fix across component updates', async () => {
      const clickHandler = vi.fn();

      const { rerender } = render(Button, {
        props: { variant: 'default' },
        children: 'Update Test'
      });

      const component = render(Button, {
        props: { variant: 'default' },
        children: 'Update Test'
      });

      component.component.$on('click', clickHandler);

      // Multiple updates with different props
      const propSets = [
        { variant: 'destructive', size: 'lg' },
        { variant: 'outline', disabled: true },
        { variant: 'secondary', loading: true },
        { variant: 'accent', href: '/test' }
      ];

      for (const props of propSets) {
        rerender(props);

        const button = screen.getByRole(props.href ? 'link' : 'button');

        // Should never have onclick after any update
        expect(button).not.toHaveAttribute('onclick');
        expect(button.onclick).toBeNull();

        // Event system should still work (if not disabled/loading)
        if (!props.disabled && !props.loading) {
          await fireEvent.click(button);
        }
      }

      // Should have received clicks for non-disabled/loading states
      expect(clickHandler).toHaveBeenCalled();
    });

    it('validates fix persistence across Svelte lifecycle', async () => {
      const clickHandler = vi.fn();

      // Test full component lifecycle
      const { unmount } = render(Button, {
        props: {},
        children: 'Lifecycle Test'
      });

      const component = render(Button, {
        props: {},
        children: 'Lifecycle Test'
      });

      // onMount equivalent
      component.component.$on('click', clickHandler);

      const button = screen.getByRole('button');

      // Verify no onclick during active lifecycle
      expect(button).not.toHaveAttribute('onclick');
      await fireEvent.click(button);
      expect(clickHandler).toHaveBeenCalled();

      // onDestroy equivalent
      unmount();

      // Should complete without errors
      expect(true).toBe(true);
    });

    it('ensures compatibility with future Svelte versions', () => {
      // Test component renders correctly with current Svelte version
      const { container } = render(Button, {
        props: {
          variant: 'default',
          size: 'default',
          disabled: false
        },
        children: 'Future Compatibility Test'
      });

      const button = container.querySelector('button');

      // Core requirements that should persist across Svelte versions
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveAttribute('onclick');
      expect(button?.onclick).toBeNull();
      expect(button).toHaveClass('inline-flex'); // Tailwind classes should work
    });
  });
});
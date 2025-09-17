/**
 * Button onclick Fix Validation Tests
 * Simple tests to validate the button fix works correctly
 *
 * @file button-fix-validation-simple.test.ts
 * @author Claude Code Test Engineer
 * @date 2025-09-17
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import Button from '$lib/components/ui/Button.svelte';

// Mock device store
vi.mock('$lib/stores/device.store', () => ({
  isTouch: {
    subscribe: vi.fn((callback) => {
      callback(false);
      return { unsubscribe: vi.fn() };
    })
  }
}));

describe('Button onclick Fix Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Button Functionality', () => {
    it('renders button correctly', () => {
      const { getByRole } = render(Button, {
        props: { children: 'Test Button' }
      });

      const button = getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Test Button');
    });

    it('does not have onclick attribute (regression test)', () => {
      const { getByRole } = render(Button, {
        props: { children: 'No onclick' }
      });

      const button = getByRole('button');
      expect(button).not.toHaveAttribute('onclick');
    });

    it('handles click events through Svelte event system', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { children: 'Clickable' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalledTimes(1);
    });

    it('handles multiple clicks correctly', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { children: 'Multi-click' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);
      await fireEvent.click(button);
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalledTimes(3);
    });

    it('does not trigger click when disabled', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { disabled: true, children: 'Disabled' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).not.toHaveBeenCalled();
    });

    it('does not trigger click when loading', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { loading: true, children: 'Loading' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).not.toHaveBeenCalled();
    });
  });

  describe('Button Variants Work Correctly', () => {
    it('default variant works', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { variant: 'default', children: 'Default' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalled();
    });

    it('outline variant works', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { variant: 'outline', children: 'Outline' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalled();
    });

    it('destructive variant works', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { variant: 'destructive', children: 'Delete' }
      });

      component.$on('click', mockClick);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Link Variant Works', () => {
    it('renders link when href provided', () => {
      const { getByRole } = render(Button, {
        props: { href: '/test', children: 'Link Button' }
      });

      const link = getByRole('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/test');
      expect(link).not.toHaveAttribute('onclick');
    });

    it('link handles click events', async () => {
      const mockClick = vi.fn();
      const { getByRole, component } = render(Button, {
        props: { href: '/test', children: 'Clickable Link' }
      });

      component.$on('click', mockClick);

      const link = getByRole('link');
      await fireEvent.click(link);

      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Articles Page Simulation', () => {
    it('simulates create button functionality', async () => {
      const mockCreateAction = vi.fn();
      const { getByRole, component } = render(Button, {
        props: {
          variant: 'default',
          children: 'Создать статью'
        }
      });

      component.$on('click', mockCreateAction);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockCreateAction).toHaveBeenCalled();
    });

    it('simulates edit button functionality', async () => {
      const mockEditAction = vi.fn();
      const { getByRole, component } = render(Button, {
        props: {
          variant: 'outline',
          size: 'sm',
          children: 'Изменить'
        }
      });

      component.$on('click', mockEditAction);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockEditAction).toHaveBeenCalled();
    });

    it('simulates delete button functionality', async () => {
      const mockDeleteAction = vi.fn();
      const { getByRole, component } = render(Button, {
        props: {
          variant: 'outline',
          size: 'sm',
          children: 'Удалить'
        }
      });

      component.$on('click', mockDeleteAction);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockDeleteAction).toHaveBeenCalled();
    });

    it('simulates modal cancel button', async () => {
      const mockCancelAction = vi.fn();
      const { getByRole, component } = render(Button, {
        props: {
          variant: 'outline',
          children: 'Отмена'
        }
      });

      component.$on('click', mockCancelAction);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockCancelAction).toHaveBeenCalled();
    });

    it('simulates modal submit button', async () => {
      const mockSubmitAction = vi.fn();
      const { getByRole, component } = render(Button, {
        props: {
          type: 'submit',
          children: 'Создать'
        }
      });

      component.$on('click', mockSubmitAction);

      const button = getByRole('button');
      await fireEvent.click(button);

      expect(mockSubmitAction).toHaveBeenCalled();
    });
  });

  describe('Regression Prevention', () => {
    it('ensures onclick was properly removed from component', () => {
      const { getByRole } = render(Button, {
        props: { children: 'Test' }
      });

      const button = getByRole('button');

      // Should not have onclick attribute
      expect(button).not.toHaveAttribute('onclick');

      // Should not have onclick property
      expect((button as any).onclick).toBeNull();
    });

    it('confirms all buttons work with new event system', async () => {
      const buttonConfigs = [
        { variant: 'default' as const, children: 'Default' },
        { variant: 'destructive' as const, children: 'Destructive' },
        { variant: 'outline' as const, children: 'Outline' },
        { variant: 'secondary' as const, children: 'Secondary' },
        { variant: 'ghost' as const, children: 'Ghost' },
        { variant: 'link' as const, children: 'Link' },
      ];

      for (const config of buttonConfigs) {
        const mockClick = vi.fn();
        const { getByRole, component, unmount } = render(Button, {
          props: config
        });

        component.$on('click', mockClick);

        const button = getByRole('button');
        await fireEvent.click(button);

        expect(mockClick).toHaveBeenCalled();
        unmount();
      }
    });
  });
});
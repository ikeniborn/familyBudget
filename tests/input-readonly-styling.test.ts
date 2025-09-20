import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Input from '../frontend-svelte/src/lib/components/ui/Input.svelte';

/**
 * Input Component Readonly Styling Tests
 *
 * Tests verify that the Input component correctly applies readonly styling
 * including gray background, lock icon, and proper ARIA attributes.
 */

describe('Input Component Readonly Styling', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Readonly State Visual Styling', () => {
    it('should apply gray background and readonly styles when readonly=true', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: true,
          id: 'test-input'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-gray-50');
      expect(input).toHaveClass('border-gray-200');
      expect(input).toHaveClass('text-gray-700');
      expect(input).toHaveClass('cursor-default');
    });

    it('should display lock icon when readonly=true', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: true,
          id: 'test-input'
        }
      });

      // Lock icon should be present in the DOM
      const lockIcon = screen.getByRole('img', { hidden: true });
      expect(lockIcon).toBeInTheDocument();
      expect(lockIcon).toHaveClass('text-gray-400');
    });

    it('should not display lock icon when readonly=false', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: false,
          id: 'test-input'
        }
      });

      // Lock icon should not be present
      const lockIcon = screen.queryByRole('img', { hidden: true });
      expect(lockIcon).not.toBeInTheDocument();
    });

    it('should apply white background for normal editable state', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: false,
          id: 'test-input'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-white');
      expect(input).toHaveClass('border-gray-300');
      expect(input).not.toHaveClass('bg-gray-50');
    });
  });

  describe('Readonly State Behavior', () => {
    it('should set readonly attribute on input element', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: true,
          id: 'test-input'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });

    it('should set aria-readonly attribute', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: true,
          id: 'test-input'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-readonly', 'true');
    });

    it('should prevent text modification when readonly', async () => {
      render(Input, {
        props: {
          value: 'original value',
          readonly: true,
          id: 'test-input'
        }
      });

      const input = screen.getByRole('textbox') as HTMLInputElement;
      expect(input.value).toBe('original value');

      // Attempt to type - should not change value due to readonly
      await user.type(input, 'new text');
      expect(input.value).toBe('original value');
    });
  });

  describe('Different Input Types with Readonly', () => {
    it('should apply readonly styling to email input type', () => {
      render(Input, {
        props: {
          type: 'email',
          value: 'test@example.com',
          readonly: true,
          id: 'test-email'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('type', 'email');
      expect(input).toHaveClass('bg-gray-50');
      expect(input).toHaveAttribute('readonly');
    });

    it('should apply readonly styling to password input type', () => {
      render(Input, {
        props: {
          type: 'password',
          value: 'secret',
          readonly: true,
          id: 'test-password'
        }
      });

      const input = screen.getByLabelText('test-password') as HTMLInputElement;
      expect(input.type).toBe('password');
      expect(input).toHaveClass('bg-gray-50');
      expect(input).toHaveAttribute('readonly');
    });

    it('should apply readonly styling to number input type', () => {
      render(Input, {
        props: {
          type: 'number',
          value: 42,
          readonly: true,
          id: 'test-number'
        }
      });

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('bg-gray-50');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('Size Variants with Readonly', () => {
    it('should adjust padding for lock icon in small size', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          size: 'sm',
          id: 'test-sm'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-8');
      expect(input).toHaveClass('pl-2');
    });

    it('should adjust padding for lock icon in medium size', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          size: 'md',
          id: 'test-md'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-10');
      expect(input).toHaveClass('pl-3');
    });

    it('should adjust padding for lock icon in large size', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          size: 'lg',
          id: 'test-lg'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('pr-12');
      expect(input).toHaveClass('pl-4');
    });
  });

  describe('Error State with Readonly', () => {
    it('should combine readonly and error styling', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: true,
          hasError: true,
          id: 'test-error'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-red-25');
      expect(input).toHaveClass('border-red-200');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should show lock icon even with error state', () => {
      render(Input, {
        props: {
          value: 'test value',
          readonly: true,
          hasError: true,
          id: 'test-error'
        }
      });

      const lockIcon = screen.getByRole('img', { hidden: true });
      expect(lockIcon).toBeInTheDocument();
    });
  });

  describe('Disabled vs Readonly Distinction', () => {
    it('should apply different styling for disabled vs readonly', () => {
      const { rerender } = render(Input, {
        props: {
          value: 'test',
          disabled: true,
          id: 'test-disabled'
        }
      });

      let input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-gray-100');
      expect(input).toHaveClass('text-gray-400');

      rerender({
        value: 'test',
        readonly: true,
        disabled: false,
        id: 'test-readonly'
      });

      input = screen.getByRole('textbox');
      expect(input).toHaveClass('bg-gray-50');
      expect(input).toHaveClass('text-gray-700');
      expect(input).not.toHaveClass('bg-gray-100');
    });

    it('should not show lock icon when disabled (even if readonly)', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          disabled: true,
          id: 'test-disabled-readonly'
        }
      });

      const lockIcon = screen.queryByRole('img', { hidden: true });
      expect(lockIcon).not.toBeInTheDocument();
    });
  });

  describe('Focus Behavior with Readonly', () => {
    it('should apply focus styles when readonly input is focused', async () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          id: 'test-focus'
        }
      });

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(input).toHaveFocus();
      expect(input).toHaveClass('focus-visible:ring-gray-400');
      expect(input).toHaveClass('focus-visible:border-gray-400');
    });

    it('should still emit focus events when readonly', async () => {
      const focusHandler = vi.fn();
      const component = render(Input, {
        props: {
          value: 'test',
          readonly: true,
          id: 'test-focus-event'
        }
      });

      component.component.$on('focus', focusHandler);

      const input = screen.getByRole('textbox');
      await user.click(input);

      expect(focusHandler).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility Features', () => {
    it('should provide proper ARIA attributes for readonly state', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          id: 'test-aria'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-readonly', 'true');
    });

    it('should have aria-hidden=true on lock icon', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          id: 'test-icon-aria'
        }
      });

      const lockIcon = screen.getByRole('img', { hidden: true });
      expect(lockIcon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should combine error and readonly ARIA attributes', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          hasError: true,
          id: 'test-combined-aria'
        }
      });

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-readonly', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby', 'test-combined-aria-error');
    });
  });

  describe('Icon Positioning', () => {
    it('should position icon correctly for different sizes', () => {
      const { rerender } = render(Input, {
        props: {
          value: 'test',
          readonly: true,
          size: 'sm',
          id: 'test-position'
        }
      });

      let container = screen.getByRole('textbox').parentElement;
      let icon = container?.querySelector('[aria-hidden="true"]');
      expect(icon).toHaveClass('right-2');

      rerender({
        value: 'test',
        readonly: true,
        size: 'md',
        id: 'test-position'
      });

      container = screen.getByRole('textbox').parentElement;
      icon = container?.querySelector('[aria-hidden="true"]');
      expect(icon).toHaveClass('right-3');

      rerender({
        value: 'test',
        readonly: true,
        size: 'lg',
        id: 'test-position'
      });

      container = screen.getByRole('textbox').parentElement;
      icon = container?.querySelector('[aria-hidden="true"]');
      expect(icon).toHaveClass('right-4');
    });

    it('should center icon vertically', () => {
      render(Input, {
        props: {
          value: 'test',
          readonly: true,
          id: 'test-center'
        }
      });

      const container = screen.getByRole('textbox').parentElement;
      const icon = container?.querySelector('[aria-hidden="true"]');
      expect(icon).toHaveClass('top-1/2');
      expect(icon).toHaveClass('transform');
      expect(icon).toHaveClass('-translate-y-1/2');
    });
  });
});
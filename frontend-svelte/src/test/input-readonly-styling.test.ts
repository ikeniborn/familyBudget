import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Input from '$lib/components/ui/Input.svelte';

describe('Input Component Readonly Styling', () => {
  it('should apply readonly styling correctly', () => {
    const { container } = render(Input, {
      props: {
        type: 'text',
        value: 'readonly value',
        readonly: true,
        placeholder: 'Enter text'
      }
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.readOnly).toBe(true);
    expect(input.getAttribute('aria-readonly')).toBe('true');

    // Check that readonly styling classes are applied
    expect(input.className).toContain('bg-gray-50');
    expect(input.className).toContain('border-gray-200');
    expect(input.className).toContain('text-gray-700');
    expect(input.className).toContain('cursor-default');
  });

  it('should show lock icon for readonly fields', () => {
    const { container } = render(Input, {
      props: {
        type: 'text',
        value: 'readonly value',
        readonly: true
      }
    });

    // Check for lock icon presence
    const lockIcon = container.querySelector('svg');
    expect(lockIcon).toBeTruthy();
  });

  it('should not show lock icon for disabled fields', () => {
    const { container } = render(Input, {
      props: {
        type: 'text',
        value: 'disabled value',
        disabled: true
      }
    });

    // Lock icon should not be present for disabled fields
    const lockIcon = container.querySelector('svg');
    expect(lockIcon).toBeFalsy();
  });

  it('should apply different styling for normal vs readonly vs disabled states', () => {
    // Normal state
    const { container: normalContainer } = render(Input, {
      props: {
        type: 'text',
        value: 'normal value'
      }
    });

    // Readonly state
    const { container: readonlyContainer } = render(Input, {
      props: {
        type: 'text',
        value: 'readonly value',
        readonly: true
      }
    });

    // Disabled state
    const { container: disabledContainer } = render(Input, {
      props: {
        type: 'text',
        value: 'disabled value',
        disabled: true
      }
    });

    const normalInput = normalContainer.querySelector('input') as HTMLInputElement;
    const readonlyInput = readonlyContainer.querySelector('input') as HTMLInputElement;
    const disabledInput = disabledContainer.querySelector('input') as HTMLInputElement;

    // Normal input should have white background
    expect(normalInput.className).toContain('bg-white');

    // Readonly input should have gray-50 background
    expect(readonlyInput.className).toContain('bg-gray-50');

    // Disabled input should have gray-100 background
    expect(disabledInput.className).toContain('bg-gray-100');

    // Each should be distinct
    expect(normalInput.className).not.toEqual(readonlyInput.className);
    expect(readonlyInput.className).not.toEqual(disabledInput.className);
    expect(normalInput.className).not.toEqual(disabledInput.className);
  });

  it('should adjust padding when readonly to accommodate lock icon', () => {
    const { container } = render(Input, {
      props: {
        type: 'text',
        value: 'readonly value',
        readonly: true,
        size: 'md'
      }
    });

    const input = container.querySelector('input') as HTMLInputElement;

    // Should have right padding for icon space
    expect(input.className).toContain('pr-10');
    expect(input.className).toContain('pl-3');
  });

  it('should handle readonly with error state', () => {
    const { container } = render(Input, {
      props: {
        type: 'text',
        value: 'readonly value with error',
        readonly: true,
        hasError: true
      }
    });

    const input = container.querySelector('input') as HTMLInputElement;

    // Should have readonly + error styling
    expect(input.className).toContain('bg-red-25');
    expect(input.className).toContain('border-red-200');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-readonly')).toBe('true');
  });

  it('should support different input types with readonly styling', () => {
    const inputTypes = ['text', 'email', 'password', 'number'] as const;

    inputTypes.forEach(type => {
      const { container } = render(Input, {
        props: {
          type,
          value: 'readonly value',
          readonly: true
        }
      });

      const input = container.querySelector('input') as HTMLInputElement;
      expect(input.type).toBe(type);
      expect(input.readOnly).toBe(true);
      expect(input.getAttribute('aria-readonly')).toBe('true');
      expect(input.className).toContain('bg-gray-50');
    });
  });
});
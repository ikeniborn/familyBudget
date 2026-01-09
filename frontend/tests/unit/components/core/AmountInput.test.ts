/**
 * Unit tests for AmountInput component
 *
 * Tests validation, rendering, and value management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AmountInput } from '@components/core/AmountInput';

describe('AmountInput', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    // Create fresh container for each test
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    // Cleanup DOM after each test
    container.remove();
  });

  describe('Rendering', () => {
    it('should render input element with correct attributes', () => {
      const input = new AmountInput({
        name: 'amount',
        min: 1,
        max: 1000,
        step: 1,
        placeholder: 'Enter amount'
      });

      const element = input.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLInputElement);
      expect(element.type).toBe('number');
      expect(element.name).toBe('amount');
      expect(element.min).toBe('1');
      expect(element.max).toBe('1000');
      expect(element.step).toBe('1');
      expect(element.placeholder).toBe('Enter amount');
      expect(element.className).toContain('input');
      expect(element.className).toContain('input-bordered');
    });

    it('should apply custom className', () => {
      const input = new AmountInput({
        name: 'amount',
        className: 'custom-class'
      });

      const element = input.render();
      expect(element.className).toContain('custom-class');
    });

    it('should set initial value if provided', () => {
      const input = new AmountInput({
        name: 'amount',
        value: 500
      });

      const element = input.render();
      expect(element.value).toBe('500');
    });

    it('should set disabled state', () => {
      const input = new AmountInput({
        name: 'amount',
        disabled: true
      });

      const element = input.render();
      expect(element.disabled).toBe(true);
    });

    it('should set readonly state', () => {
      const input = new AmountInput({
        name: 'amount',
        readonly: true
      });

      const element = input.render();
      expect(element.readOnly).toBe(true);
    });
  });

  describe('Value Management', () => {
    it('should get current value', () => {
      const input = new AmountInput({ name: 'amount', value: 100 });
      const element = input.render();
      container.appendChild(element);

      expect(input.getValue()).toBe(100);
    });

    it('should set new value', () => {
      const input = new AmountInput({ name: 'amount' });
      const element = input.render();
      container.appendChild(element);

      input.setValue(250);
      expect(input.getValue()).toBe(250);
      expect(element.value).toBe('250');
    });

    it('should parse string values to numbers', () => {
      const input = new AmountInput({ name: 'amount' });
      const element = input.render();
      container.appendChild(element);

      element.value = '300';
      expect(input.getValue()).toBe(300);
    });

    it('should handle empty value as 0', () => {
      const input = new AmountInput({ name: 'amount' });
      const element = input.render();
      container.appendChild(element);

      element.value = '';
      expect(input.getValue()).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate required field', () => {
      const input = new AmountInput({ name: 'amount', required: true });
      const element = input.render();
      container.appendChild(element);

      // Empty value
      element.value = '';
      let result = input.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('обязательно');

      // Valid value
      element.value = '100';
      result = input.validate();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate minimum constraint', () => {
      const input = new AmountInput({ name: 'amount', min: 10 });
      const element = input.render();
      container.appendChild(element);

      // Below minimum
      element.value = '5';
      let result = input.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Минимальное значение: 10');

      // At minimum
      element.value = '10';
      result = input.validate();
      expect(result.valid).toBe(true);

      // Above minimum
      element.value = '15';
      result = input.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate maximum constraint', () => {
      const input = new AmountInput({ name: 'amount', max: 100 });
      const element = input.render();
      container.appendChild(element);

      // Above maximum
      element.value = '150';
      let result = input.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Максимальное значение: 100');

      // At maximum
      element.value = '100';
      result = input.validate();
      expect(result.valid).toBe(true);

      // Below maximum
      element.value = '50';
      result = input.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate both min and max constraints', () => {
      const input = new AmountInput({ name: 'amount', min: 10, max: 100 });
      const element = input.render();
      container.appendChild(element);

      // Below min
      element.value = '5';
      expect(input.validate().valid).toBe(false);

      // In range
      element.value = '50';
      expect(input.validate().valid).toBe(true);

      // Above max
      element.value = '150';
      expect(input.validate().valid).toBe(false);
    });
  });

  describe('Event Callbacks', () => {
    it('should trigger onChange callback', () => {
      let changedValue: number | null = null;
      const input = new AmountInput({
        name: 'amount',
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = input.render();
      container.appendChild(element);

      // Simulate input change
      element.value = '250';
      element.dispatchEvent(new Event('input'));

      expect(changedValue).toBe(250);
    });

    it('should trigger onBlur callback', () => {
      let blurredValue: number | null = null;
      const input = new AmountInput({
        name: 'amount',
        onBlur: (value) => {
          blurredValue = value;
        }
      });

      const element = input.render();
      container.appendChild(element);

      element.value = '500';
      element.dispatchEvent(new Event('blur'));

      expect(blurredValue).toBe(500);
    });
  });

  describe('Focus Management', () => {
    it('should focus the input element', () => {
      const input = new AmountInput({ name: 'amount' });
      const element = input.render();
      container.appendChild(element);

      input.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('Cleanup', () => {
    it('should destroy and cleanup DOM', () => {
      const input = new AmountInput({ name: 'amount' });
      const element = input.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      input.destroy();
      expect(input.getElement()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle decimal values with step', () => {
      const input = new AmountInput({
        name: 'amount',
        step: 0.01
      });
      const element = input.render();
      container.appendChild(element);

      element.value = '99.99';
      expect(input.getValue()).toBe(99.99);
    });

    it('should handle negative numbers if min allows', () => {
      const input = new AmountInput({
        name: 'amount',
        min: -100
      });
      const element = input.render();
      container.appendChild(element);

      element.value = '-50';
      expect(input.getValue()).toBe(-50);
      expect(input.validate().valid).toBe(true);
    });

    it('should handle very large numbers', () => {
      const input = new AmountInput({
        name: 'amount',
        max: 999999999
      });
      const element = input.render();
      container.appendChild(element);

      element.value = '123456789';
      expect(input.getValue()).toBe(123456789);
      expect(input.validate().valid).toBe(true);
    });
  });
});

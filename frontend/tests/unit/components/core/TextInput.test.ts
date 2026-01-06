/**
 * Unit tests for TextInput component
 *
 * Tests rendering, validation, and value management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextInput } from '@components/core/TextInput';

describe('TextInput', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render input element with correct attributes', () => {
      const input = new TextInput({
        name: 'username',
        type: 'text',
        placeholder: 'Enter username'
      });

      const element = input.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLInputElement);
      expect(element.type).toBe('text');
      expect(element.name).toBe('username');
      expect(element.placeholder).toBe('Enter username');
      expect(element.className).toContain('input');
      expect(element.className).toContain('input-bordered');
    });

    it('should render email type input', () => {
      const input = new TextInput({
        name: 'email',
        type: 'email'
      });

      const element = input.render();
      expect(element.type).toBe('email');
    });

    it('should render tel type input', () => {
      const input = new TextInput({
        name: 'phone',
        type: 'tel'
      });

      const element = input.render();
      expect(element.type).toBe('tel');
    });

    it('should render url type input', () => {
      const input = new TextInput({
        name: 'website',
        type: 'url'
      });

      const element = input.render();
      expect(element.type).toBe('url');
    });

    it('should apply custom className', () => {
      const input = new TextInput({
        name: 'test',
        className: 'custom-input'
      });

      const element = input.render();
      expect(element.className).toContain('custom-input');
    });

    it('should set initial value', () => {
      const input = new TextInput({
        name: 'username',
        value: 'john_doe'
      });

      const element = input.render();
      expect(element.value).toBe('john_doe');
    });

    it('should set disabled state', () => {
      const input = new TextInput({
        name: 'username',
        disabled: true
      });

      const element = input.render();
      expect(element.disabled).toBe(true);
    });

    it('should set readonly state', () => {
      const input = new TextInput({
        name: 'username',
        readonly: true
      });

      const element = input.render();
      expect(element.readOnly).toBe(true);
    });

    it('should set maxLength attribute', () => {
      const input = new TextInput({
        name: 'code',
        maxLength: 10
      });

      const element = input.render();
      expect(element.maxLength).toBe(10);
    });

    it('should set pattern attribute', () => {
      const input = new TextInput({
        name: 'postal',
        pattern: '[0-9]{5}'
      });

      const element = input.render();
      expect(element.pattern).toBe('[0-9]{5}');
    });

    it('should set autocomplete attribute', () => {
      const input = new TextInput({
        name: 'email',
        autocomplete: 'email'
      });

      const element = input.render();
      expect(element.getAttribute('autocomplete')).toBe('email');
    });
  });

  describe('Value Management', () => {
    it('should get current value', () => {
      const input = new TextInput({ name: 'test', value: 'hello' });
      const element = input.render();
      container.appendChild(element);

      expect(input.getValue()).toBe('hello');
    });

    it('should set new value', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      input.setValue('new value');
      expect(element.value).toBe('new value');
      expect(input.getValue()).toBe('new value');
    });

    it('should handle empty value', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      element.value = '';
      expect(input.getValue()).toBe('');
    });

    it('should return value as-is without trimming', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      element.value = '  hello  ';
      // getValue() returns raw value, trimming happens in validate()
      expect(input.getValue()).toBe('  hello  ');
    });
  });

  describe('Validation', () => {
    it('should validate required field', () => {
      const input = new TextInput({ name: 'test', required: true });
      const element = input.render();
      container.appendChild(element);

      // Empty value
      element.value = '';
      let result = input.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();

      // Valid value
      element.value = 'test';
      result = input.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate maxLength constraint', () => {
      const input = new TextInput({ name: 'code', maxLength: 5 });
      const element = input.render();
      container.appendChild(element);

      // Within limit
      element.value = 'abc';
      let result = input.validate();
      expect(result.valid).toBe(true);

      // At limit
      element.value = 'abcde';
      result = input.validate();
      expect(result.valid).toBe(true);

      // Over limit
      element.value = 'abcdef';
      result = input.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Максимальная длина');
    });

    it('should validate email pattern', () => {
      const input = new TextInput({
        name: 'email',
        type: 'email',
        pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
      });
      const element = input.render();
      container.appendChild(element);

      // Invalid email
      element.value = 'invalid-email';
      let result = input.validate();
      expect(result.valid).toBe(false);

      // Valid email
      element.value = 'test@example.com';
      result = input.validate();
      expect(result.valid).toBe(true);
    });

    it('should allow empty value when not required', () => {
      const input = new TextInput({ name: 'optional', required: false });
      const element = input.render();
      container.appendChild(element);

      element.value = '';
      const result = input.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('Event Callbacks', () => {
    it('should trigger onChange callback', () => {
      let changedValue: string | null = null;
      const input = new TextInput({
        name: 'test',
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = input.render();
      container.appendChild(element);

      element.value = 'new value';
      element.dispatchEvent(new Event('input'));

      expect(changedValue).toBe('new value');
    });

    it('should pass raw value in onChange callback', () => {
      let changedValue: string | null = null;
      const input = new TextInput({
        name: 'test',
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = input.render();
      container.appendChild(element);

      element.value = '  spaces  ';
      element.dispatchEvent(new Event('input'));

      // onChange passes raw value, trimming is responsibility of consumer
      expect(changedValue).toBe('  spaces  ');
    });
  });

  describe('Focus Management', () => {
    it('should focus the input element', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      input.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('Cleanup', () => {
    it('should destroy and cleanup DOM', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      input.destroy();
      expect(input.getElement()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      const specialChars = '<script>alert("xss")</script>';
      element.value = specialChars;
      expect(input.getValue()).toBe(specialChars.trim());
    });

    it('should handle unicode characters', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      element.value = 'Привет 你好 🎉';
      expect(input.getValue()).toBe('Привет 你好 🎉');
    });

    it('should handle very long strings', () => {
      const input = new TextInput({ name: 'test' });
      const element = input.render();
      container.appendChild(element);

      const longString = 'a'.repeat(1000);
      element.value = longString;
      expect(input.getValue()).toBe(longString);
    });

    it('should handle only whitespace as empty', () => {
      const input = new TextInput({ name: 'test', required: true });
      const element = input.render();
      container.appendChild(element);

      element.value = '   ';
      const result = input.validate();
      expect(result.valid).toBe(false);
    });
  });
});

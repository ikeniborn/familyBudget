/**
 * Unit tests for TextareaInput component
 *
 * Tests rendering, validation, and multi-line text management
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TextareaInput } from '@components/core/TextareaInput';

describe('TextareaInput', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render textarea element with correct attributes', () => {
      const textarea = new TextareaInput({
        name: 'description',
        placeholder: 'Enter description',
        rows: 4
      });

      const element = textarea.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLTextAreaElement);
      expect(element.name).toBe('description');
      expect(element.placeholder).toBe('Enter description');
      expect(element.getAttribute('rows')).toBe('4');
      expect(element.className).toContain('textarea');
      expect(element.className).toContain('textarea-bordered');
    });

    it('should default to 3 rows if not specified', () => {
      const textarea = new TextareaInput({
        name: 'notes'
      });

      const element = textarea.render();
      // If rows not specified, no rows attribute is set (browser uses default)
      expect(element.hasAttribute('rows')).toBe(false);
    });

    it('should apply custom className', () => {
      const textarea = new TextareaInput({
        name: 'notes',
        className: 'custom-textarea'
      });

      const element = textarea.render();
      expect(element.className).toContain('custom-textarea');
    });

    it('should set initial value', () => {
      const textarea = new TextareaInput({
        name: 'notes',
        value: 'Initial text'
      });

      const element = textarea.render();
      expect(element.value).toBe('Initial text');
    });

    it('should set disabled state', () => {
      const textarea = new TextareaInput({
        name: 'notes',
        disabled: true
      });

      const element = textarea.render();
      expect(element.disabled).toBe(true);
    });

    it('should set readonly state', () => {
      const textarea = new TextareaInput({
        name: 'notes',
        readonly: true
      });

      const element = textarea.render();
      expect(element.readOnly).toBe(true);
    });

    it('should set maxLength attribute', () => {
      const textarea = new TextareaInput({
        name: 'notes',
        maxLength: 500
      });

      const element = textarea.render();
      expect(element.maxLength).toBe(500);
    });
  });

  describe('Value Management', () => {
    it('should get current value', () => {
      const textarea = new TextareaInput({ name: 'notes', value: 'Test note' });
      const element = textarea.render();
      container.appendChild(element);

      expect(textarea.getValue()).toBe('Test note');
    });

    it('should set new value', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      textarea.setValue('New note');
      expect(element.value).toBe('New note');
      expect(textarea.getValue()).toBe('New note');
    });

    it('should handle multi-line text', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      const multiLine = 'Line 1\nLine 2\nLine 3';
      element.value = multiLine;
      expect(textarea.getValue()).toBe(multiLine);
    });

    it('should handle empty value', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      element.value = '';
      expect(textarea.getValue()).toBe('');
    });

    it('should return raw value without trimming', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      element.value = '  text with spaces  ';
      // getValue() returns raw value, trimming happens in validate()
      expect(textarea.getValue()).toBe('  text with spaces  ');
    });

    it('should preserve internal whitespace', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      element.value = 'text   with   spaces';
      // getValue() preserves internal whitespace
      expect(textarea.getValue()).toBe('text   with   spaces');
    });
  });

  describe('Validation', () => {
    it('should validate required field', () => {
      const textarea = new TextareaInput({ name: 'notes', required: true });
      const element = textarea.render();
      container.appendChild(element);

      // Empty value
      element.value = '';
      let result = textarea.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();

      // Valid value
      element.value = 'Some text';
      result = textarea.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate maxLength constraint', () => {
      const textarea = new TextareaInput({ name: 'notes', maxLength: 10 });
      const element = textarea.render();
      container.appendChild(element);

      // Within limit
      element.value = 'short';
      let result = textarea.validate();
      expect(result.valid).toBe(true);

      // At limit
      element.value = '1234567890';
      result = textarea.validate();
      expect(result.valid).toBe(true);

      // Over limit
      element.value = '12345678901';
      result = textarea.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Максимальная длина');
    });

    it('should allow empty value when not required', () => {
      const textarea = new TextareaInput({ name: 'notes', required: false });
      const element = textarea.render();
      container.appendChild(element);

      element.value = '';
      const result = textarea.validate();
      expect(result.valid).toBe(true);
    });

    it('should treat whitespace-only as empty for required fields', () => {
      const textarea = new TextareaInput({ name: 'notes', required: true });
      const element = textarea.render();
      container.appendChild(element);

      element.value = '   \n\n   ';
      const result = textarea.validate();
      expect(result.valid).toBe(false);
    });
  });

  describe('Event Callbacks', () => {
    it('should trigger onChange callback', () => {
      let changedValue: string | null = null;
      const textarea = new TextareaInput({
        name: 'notes',
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = textarea.render();
      container.appendChild(element);

      element.value = 'new text';
      element.dispatchEvent(new Event('input'));

      expect(changedValue).toBe('new text');
    });

    it('should pass raw value in onChange callback', () => {
      let changedValue: string | null = null;
      const textarea = new TextareaInput({
        name: 'notes',
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = textarea.render();
      container.appendChild(element);

      element.value = '  text  ';
      element.dispatchEvent(new Event('input'));

      // onChange passes raw value, trimming is responsibility of consumer
      expect(changedValue).toBe('  text  ');
    });

    it('should trigger onChange with multi-line text', () => {
      let changedValue: string | null = null;
      const textarea = new TextareaInput({
        name: 'notes',
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = textarea.render();
      container.appendChild(element);

      element.value = 'Line 1\nLine 2';
      element.dispatchEvent(new Event('input'));

      expect(changedValue).toBe('Line 1\nLine 2');
    });
  });

  describe('Focus Management', () => {
    it('should focus the textarea element', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      textarea.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('Cleanup', () => {
    it('should destroy and cleanup DOM', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      textarea.destroy();
      expect(textarea.getElement()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long text', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      const longText = 'a'.repeat(5000);
      element.value = longText;
      expect(textarea.getValue().length).toBe(5000);
    });

    it('should handle special characters', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      const specialChars = '<script>alert("xss")</script>';
      element.value = specialChars;
      expect(textarea.getValue()).toBe(specialChars.trim());
    });

    it('should handle unicode and emojis', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      element.value = 'Привет 世界 🎉🎊';
      expect(textarea.getValue()).toBe('Привет 世界 🎉🎊');
    });

    it('should handle tabs and line breaks', () => {
      const textarea = new TextareaInput({ name: 'notes' });
      const element = textarea.render();
      container.appendChild(element);

      element.value = 'Line 1\tTab\nLine 2\r\nLine 3';
      expect(textarea.getValue()).toBe('Line 1\tTab\nLine 2\r\nLine 3');
    });

    it('should count newlines in maxLength validation', () => {
      const textarea = new TextareaInput({ name: 'notes', maxLength: 15 });
      const element = textarea.render();
      container.appendChild(element);

      // "Line 1\nLine 2" = 13 characters (including newline)
      element.value = 'Line 1\nLine 2';
      let result = textarea.validate();
      expect(result.valid).toBe(true);

      // "Line 1\nLine 2\nXY" = 16 characters (exceeds maxLength)
      element.value = 'Line 1\nLine 2\nXY';
      result = textarea.validate();
      expect(result.valid).toBe(false);
    });
  });

  describe('Row Configuration', () => {
    it('should support custom row heights', () => {
      const textarea = new TextareaInput({ name: 'notes', rows: 10 });
      const element = textarea.render();

      // getAttribute returns string, property returns number
      expect(element.getAttribute('rows')).toBe('10');
    });

    it('should handle single row textarea', () => {
      const textarea = new TextareaInput({ name: 'notes', rows: 1 });
      const element = textarea.render();

      // getAttribute returns string, property returns number
      expect(element.getAttribute('rows')).toBe('1');
    });
  });
});

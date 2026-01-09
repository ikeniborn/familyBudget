/**
 * Unit tests for SelectDropdown component
 *
 * Tests option rendering, selection, and validation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SelectDropdown } from '@components/core/SelectDropdown';
import type { SelectOption } from '@components/types';

describe('SelectDropdown', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  const sampleOptions: SelectOption[] = [
    { value: '', label: '-- Select --' },
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
    { value: '3', label: 'Option 3' }
  ];

  describe('Rendering', () => {
    it('should render select element with correct attributes', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLSelectElement);
      expect(element.name).toBe('category');
      expect(element.className).toContain('select');
      expect(element.className).toContain('select-bordered');
    });

    it('should render all options', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      expect(element.options.length).toBe(4);
      expect(element.options[0].value).toBe('');
      expect(element.options[0].text).toBe('-- Select --');
      expect(element.options[1].value).toBe('1');
      expect(element.options[1].text).toBe('Option 1');
    });

    it('should set initial selected value', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        value: '2'
      });

      const element = select.render();
      expect(element.value).toBe('2');
      expect(select.getValue()).toBe('2');
    });

    it('should mark option as selected in options array', () => {
      const optionsWithSelected: SelectOption[] = [
        { value: '1', label: 'Option 1' },
        { value: '2', label: 'Option 2', selected: true },
        { value: '3', label: 'Option 3' }
      ];

      const select = new SelectDropdown({
        name: 'category',
        options: optionsWithSelected
      });

      const element = select.render();
      expect(element.value).toBe('2');
      expect(element.options[1].selected).toBe(true);
    });

    it('should set disabled state', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        disabled: true
      });

      const element = select.render();
      expect(element.disabled).toBe(true);
    });

    it('should apply custom className', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        className: 'custom-select'
      });

      const element = select.render();
      expect(element.className).toContain('custom-select');
    });
  });

  describe('Multiple Selection', () => {
    it('should enable multiple selection', () => {
      const select = new SelectDropdown({
        name: 'tags',
        options: sampleOptions,
        multiple: true,
        size: 4
      });

      const element = select.render();
      expect(element.multiple).toBe(true);
      expect(element.size).toBe(4);
    });

    it('should return array of selected values for multiple select', () => {
      const select = new SelectDropdown({
        name: 'tags',
        options: sampleOptions,
        multiple: true
      });

      const element = select.render();
      container.appendChild(element);

      // Select multiple options
      element.options[1].selected = true;
      element.options[2].selected = true;

      const values = select.getValue();
      expect(Array.isArray(values)).toBe(true);
      expect(values).toContain('1');
      expect(values).toContain('2');
    });
  });

  describe('Value Management', () => {
    it('should get current value', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        value: '2'
      });

      select.render();
      expect(select.getValue()).toBe('2');
    });

    it('should set new value', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      container.appendChild(element);

      select.setValue('3');
      expect(element.value).toBe('3');
      expect(select.getValue()).toBe('3');
    });

    it('should handle empty string as value', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      container.appendChild(element);

      select.setValue('');
      expect(element.value).toBe('');
      expect(select.getValue()).toBe('');
    });

    it('should update options dynamically', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      container.appendChild(element);

      const newOptions: SelectOption[] = [
        { value: 'a', label: 'Option A' },
        { value: 'b', label: 'Option B' }
      ];

      select.updateOptions(newOptions);

      expect(element.options.length).toBe(2);
      expect(element.options[0].value).toBe('a');
      expect(element.options[0].text).toBe('Option A');
    });
  });

  describe('Validation', () => {
    it('should validate required field', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        required: true
      });

      const element = select.render();
      container.appendChild(element);

      // Empty value
      element.value = '';
      let result = select.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Выберите значение из списка');

      // Valid value
      element.value = '1';
      result = select.validate();
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should allow empty value when not required', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        required: false
      });

      const element = select.render();
      container.appendChild(element);

      element.value = '';
      const result = select.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('Event Callbacks', () => {
    it('should trigger onChange callback', () => {
      let changedValue: string | string[] | null = null;
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions,
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = select.render();
      container.appendChild(element);

      element.value = '2';
      element.dispatchEvent(new Event('change'));

      expect(changedValue).toBe('2');
    });

    it('should trigger onChange with array for multiple select', () => {
      let changedValue: string | string[] | null = null;
      const select = new SelectDropdown({
        name: 'tags',
        options: sampleOptions,
        multiple: true,
        onChange: (value) => {
          changedValue = value;
        }
      });

      const element = select.render();
      container.appendChild(element);

      element.options[1].selected = true;
      element.options[2].selected = true;
      element.dispatchEvent(new Event('change'));

      expect(Array.isArray(changedValue)).toBe(true);
      expect(changedValue).toContain('1');
      expect(changedValue).toContain('2');
    });
  });

  describe('Disabled Options', () => {
    it('should render disabled options', () => {
      const optionsWithDisabled: SelectOption[] = [
        { value: '1', label: 'Option 1' },
        { value: '2', label: 'Option 2 (disabled)', disabled: true },
        { value: '3', label: 'Option 3' }
      ];

      const select = new SelectDropdown({
        name: 'category',
        options: optionsWithDisabled
      });

      const element = select.render();
      expect(element.options[1].disabled).toBe(true);
    });
  });

  describe('Focus Management', () => {
    it('should focus the select element', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      container.appendChild(element);

      select.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('Cleanup', () => {
    it('should destroy and cleanup', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: sampleOptions
      });

      const element = select.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      select.destroy();
      expect(select.getElement()).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty options array', () => {
      const select = new SelectDropdown({
        name: 'category',
        options: []
      });

      const element = select.render();
      expect(element.options.length).toBe(0);
    });

    it('should handle numeric values', () => {
      const numericOptions: SelectOption[] = [
        { value: 1, label: 'One' },
        { value: 2, label: 'Two' },
        { value: 3, label: 'Three' }
      ];

      const select = new SelectDropdown({
        name: 'number',
        options: numericOptions,
        value: 2
      });

      const element = select.render();
      expect(element.value).toBe('2');
    });

    it('should handle special characters in labels', () => {
      const specialOptions: SelectOption[] = [
        { value: '1', label: 'Option & <special>' },
        { value: '2', label: 'Option "with" quotes' }
      ];

      const select = new SelectDropdown({
        name: 'category',
        options: specialOptions
      });

      const element = select.render();
      expect(element.options[0].text).toBe('Option & <special>');
      expect(element.options[1].text).toBe('Option "with" quotes');
    });
  });
});

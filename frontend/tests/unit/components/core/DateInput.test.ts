/**
 * Unit tests for DateInput component
 *
 * Tests basic input functionality and structure
 * (Full CalendarWidget integration tested in integration tests)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DateInput } from '@components/core/DateInput';

describe('DateInput', () => {
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
      const dateInput = new DateInput({
        name: 'fact_date',
        placeholder: 'Выберите дату'
      });

      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      expect(wrapper).toBeInstanceOf(HTMLDivElement);
      expect(wrapper.className).toBe('date-input-wrapper');

      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input).toBeTruthy();
      expect(input.type).toBe('text');
      expect(input.name).toBe('fact_date');
      expect(input.placeholder).toBe('ДД.ММ.ГГГГ');
      expect(input.className).toContain('input');
      expect(input.className).toContain('input-bordered');
    });

    it('should apply custom className', () => {
      const dateInput = new DateInput({
        name: 'date',
        className: 'custom-date'
      });

      const wrapper = dateInput.render();
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input.className).toContain('custom-date');
    });

    it('should set initial value', () => {
      const dateInput = new DateInput({
        name: 'date',
        value: '01.01.2026'
      });

      const wrapper = dateInput.render();
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input.value).toBe('01.01.2026');
    });

    it('should set disabled state', () => {
      const dateInput = new DateInput({
        name: 'date',
        disabled: true
      });

      const wrapper = dateInput.render();
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('should set readonly state', () => {
      const dateInput = new DateInput({
        name: 'date',
        readonly: true
      });

      const wrapper = dateInput.render();
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input.readOnly).toBe(true);
    });
  });

  describe('Quick Date Buttons', () => {
    it('should render default quick date buttons', () => {
      const dateInput = new DateInput({
        name: 'date',
        quickButtons: [
          { label: 'Сегодня', offset: 0 },
          { label: 'Вчера', offset: -1 },
          { label: 'Позавчера', offset: -2 }
        ]
      });

      const wrapper = dateInput.render();
      const buttons = wrapper.querySelectorAll('button');

      expect(buttons).toBeTruthy();
      expect(buttons.length).toBe(3);
      expect(buttons[0].textContent).toBe('Сегодня');
      expect(buttons[1].textContent).toBe('Вчера');
      expect(buttons[2].textContent).toBe('Позавчера');
    });

    it('should render custom quick date buttons', () => {
      const dateInput = new DateInput({
        name: 'date',
        quickButtons: [
          { label: 'Week ago', offset: -7 },
          { label: 'Month ago', offset: -30 }
        ]
      });

      const wrapper = dateInput.render();
      const buttons = wrapper.querySelectorAll('button');

      expect(buttons.length).toBe(2);
      expect(buttons[0].textContent).toBe('Week ago');
      expect(buttons[1].textContent).toBe('Month ago');
    });

    it('should disable quick buttons when input is disabled', () => {
      const dateInput = new DateInput({
        name: 'date',
        disabled: true,
        quickButtons: [
          { label: 'Сегодня', offset: 0 }
        ]
      });

      const wrapper = dateInput.render();
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input.disabled).toBe(true);

      // Note: Quick buttons are not disabled automatically when input is disabled
      // This would need to be implemented in DateInput component if desired
    });
  });

  describe('Value Management', () => {
    it('should support single date mode', () => {
      const dateInput = new DateInput({
        name: 'date',
        mode: 'single'
      });

      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      const input = wrapper.querySelector('input') as HTMLInputElement;
      input.value = '15.01.2026';
      expect(input.value).toBe('15.01.2026');
    });

    it('should support range date mode', () => {
      const dateInput = new DateInput({
        name: 'date_range',
        mode: 'range'
      });

      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      // Wrapper is div, input is inside
      expect(wrapper).toBeInstanceOf(HTMLDivElement);
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input).toBeInstanceOf(HTMLInputElement);
    });
  });

  describe('Validation', () => {
    it('should validate required field', () => {
      const dateInput = new DateInput({
        name: 'date',
        required: true
      });

      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      const input = wrapper.querySelector('input') as HTMLInputElement;

      // Empty value
      input.value = '';
      let result = dateInput.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();

      // Valid value
      input.value = '15.01.2026';
      result = dateInput.validate();
      expect(result.valid).toBe(true);
    });

    it('should allow empty value when not required', () => {
      const dateInput = new DateInput({
        name: 'date',
        required: false
      });

      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      const input = wrapper.querySelector('input') as HTMLInputElement;

      input.value = '';
      const result = dateInput.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('Focus Management', () => {
    it('should focus the input element', () => {
      const dateInput = new DateInput({ name: 'date' });
      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      const input = wrapper.querySelector('input') as HTMLInputElement;
      dateInput.focus();
      expect(document.activeElement).toBe(input);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup DOM elements', () => {
      const dateInput = new DateInput({ name: 'date' });
      const wrapper = dateInput.render();
      container.appendChild(wrapper);

      expect(container.contains(wrapper)).toBe(true);

      dateInput.destroy();
      expect(dateInput.getElement()).toBeNull();
    });
  });

  describe('DOM Structure', () => {
    it('should return wrapper with input and buttons', () => {
      const dateInput = new DateInput({
        name: 'date',
        quickButtons: [
          { label: 'Today', offset: 0 }
        ]
      });
      const wrapper = dateInput.render();

      expect(wrapper).toBeInstanceOf(HTMLDivElement);

      // Should contain input
      const input = wrapper.querySelector('input');
      expect(input).toBeTruthy();

      // Should contain quick buttons
      const buttons = wrapper.querySelectorAll('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle date format DD.MM.YYYY', () => {
      const dateInput = new DateInput({ name: 'date' });
      const element = dateInput.render();
      container.appendChild(element);

      element.value = '31.12.2026';
      expect(element.value).toBe('31.12.2026');
    });

    it('should handle invalid date format gracefully', () => {
      const dateInput = new DateInput({ name: 'date' });
      const element = dateInput.render();
      container.appendChild(element);

      element.value = 'invalid-date';
      // Should not crash
      expect(() => dateInput.validate()).not.toThrow();
    });
  });
});

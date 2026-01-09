/**
 * Unit tests for RecurringPlanSettings component
 *
 * Tests complex recurring payment configuration UI with MMDD encoding
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecurringPlanSettings } from '@components/composite/RecurringPlanSettings';

describe('RecurringPlanSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render all three sections', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      const element = settings.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLDivElement);
      expect(element.className).toContain('recurring-plan-settings');

      // Should have 3 sections
      const sections = element.querySelectorAll('.form-control');
      expect(sections.length).toBe(3);
    });

    it('should render frequency type select', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      const element = settings.render();
      container.appendChild(element);

      const select = element.querySelector('select[name="recurring_frequency_type"]');
      expect(select).toBeTruthy();

      const options = select?.querySelectorAll('option');
      expect(options?.length).toBe(3);
      expect(options?.[0].textContent).toBe('Еженедельно');
      expect(options?.[1].textContent).toBe('Ежемесячно');
      expect(options?.[2].textContent).toBe('Ежегодно');
    });

    it('should render frequency value input', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      const element = settings.render();
      container.appendChild(element);

      const input = element.querySelector('input[name="recurring_frequency_value"]');
      expect(input).toBeTruthy();
      expect(input?.type).toBe('number');
    });

    it('should render end date input', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      const element = settings.render();
      container.appendChild(element);

      const input = element.querySelector('input[name="recurring_end_date"]');
      expect(input).toBeTruthy();
    });

    it('should apply custom className', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        className: 'custom-settings'
      });

      const element = settings.render();
      expect(element.className).toContain('custom-settings');
    });
  });

  describe('Initial Values', () => {
    it('should default to monthly frequency', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const value = settings.getValue();
      expect(value.frequencyType).toBe('monthly');
    });

    it('should set initial frequency type', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'weekly'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const value = settings.getValue();
      expect(value.frequencyType).toBe('weekly');
    });

    it('should set initial frequency value', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyValue: 15
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const value = settings.getValue();
      expect(value.frequencyValue).toBe(15);
    });

    it('should set initial end date', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        endDate: '31.12.2026'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const value = settings.getValue();
      expect(value.endDate).toBe('31.12.2026');
    });
  });

  describe('Frequency Type Constraints', () => {
    it('should set max value for weekly frequency (1-7)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'weekly'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const input = container.querySelector('input[name="recurring_frequency_value"]') as HTMLInputElement;
      expect(input.max).toBe('7');
    });

    it('should set max value for monthly frequency (1-31)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'monthly'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const input = container.querySelector('input[name="recurring_frequency_value"]') as HTMLInputElement;
      expect(input.max).toBe('31');
    });

    it('should set max value for yearly frequency (1-1231 MMDD)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const input = container.querySelector('input[name="recurring_frequency_value"]') as HTMLInputElement;
      expect(input.max).toBe('1231');
    });
  });

  describe('Help Text', () => {
    it('should show correct help text for weekly', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'weekly'
      });

      const element = settings.render();
      container.appendChild(element);

      const helpText = element.querySelector('.label-text-alt');
      expect(helpText?.textContent).toContain('день недели');
      expect(helpText?.textContent).toContain('1 = Понедельник');
    });

    it('should show correct help text for monthly', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'monthly'
      });

      const element = settings.render();
      container.appendChild(element);

      const helpText = element.querySelector('.label-text-alt');
      expect(helpText?.textContent).toContain('день месяца');
      expect(helpText?.textContent).toContain('1-31');
    });

    it('should show correct help text for yearly', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly'
      });

      const element = settings.render();
      container.appendChild(element);

      const helpText = element.querySelector('.label-text-alt');
      expect(helpText?.textContent).toContain('ММДД');
      expect(helpText?.textContent).toContain('315 = 15 марта');
    });
  });

  describe('Validation', () => {
    it('should validate weekly frequency value (1-7)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'weekly',
        frequencyValue: 8
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(false);
      // AmountInput returns max value error first
      expect(result.error).toContain('Максимальное значение: 7');
    });

    it('should validate monthly frequency value (1-31)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'monthly',
        frequencyValue: 32
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(false);
      // AmountInput returns max value error first
      expect(result.error).toContain('Максимальное значение: 31');
    });

    it('should validate MMDD format for yearly frequency - invalid day', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly',
        frequencyValue: 132 // Invalid: month 1, day 32 (within max 1231)
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('день');
    });

    it('should validate MMDD day component', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly',
        frequencyValue: 342 // Invalid: day 42
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Неверный день');
    });

    it('should accept valid MMDD format', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly',
        frequencyValue: 315 // March 15
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(true);
    });

    it('should accept valid monthly value', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'monthly',
        frequencyValue: 15
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(true);
    });

    it('should accept valid weekly value', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'weekly',
        frequencyValue: 5 // Friday
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const result = settings.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('Value Management', () => {
    it('should get current settings', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'monthly',
        frequencyValue: 15,
        endDate: '31.12.2026'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const value = settings.getValue();

      expect(value.frequencyType).toBe('monthly');
      expect(value.frequencyValue).toBe(15);
      expect(value.endDate).toBe('31.12.2026');
    });

    it('should set settings programmatically', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      settings.setValue({
        frequencyType: 'yearly',
        frequencyValue: 1225, // December 25
        endDate: '31.12.2027'
      });

      const value = settings.getValue();
      expect(value.frequencyType).toBe('yearly');
      expect(value.frequencyValue).toBe(1225);
      expect(value.endDate).toBe('31.12.2027');
    });

    it('should handle null end date', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        endDate: null
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      const value = settings.getValue();
      expect(value.endDate).toBeNull();
    });
  });

  describe('onChange Callback', () => {
    it('should trigger onChange when settings change', () => {
      const onChange = vi.fn();
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        onChange
      });

      settings.render();
      container.appendChild(settings.getElement()!);

      // Simulate frequency type change
      const select = container.querySelector('select[name="recurring_frequency_type"]') as HTMLSelectElement;
      select.value = 'yearly';
      select.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          frequencyType: 'yearly'
        })
      );
    });
  });

  describe('Cleanup', () => {
    it('should destroy all sub-components', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring'
      });

      const element = settings.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      settings.destroy();

      expect(settings.getElement()).toBeNull();
    });
  });

  describe('MMDD Encoding Examples', () => {
    it('should accept January 1 (101)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly',
        frequencyValue: 101
      });

      settings.render();
      expect(settings.validate().valid).toBe(true);
    });

    it('should accept December 31 (1231)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly',
        frequencyValue: 1231
      });

      settings.render();
      expect(settings.validate().valid).toBe(true);
    });

    it('should accept March 15 (315)', () => {
      const settings = new RecurringPlanSettings({
        name: 'recurring',
        frequencyType: 'yearly',
        frequencyValue: 315
      });

      settings.render();
      expect(settings.validate().valid).toBe(true);
    });
  });
});

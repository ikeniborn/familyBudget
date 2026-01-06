/**
 * Unit tests for ReminderSettings component
 *
 * Tests reminder configuration with checkbox and conditional visibility
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReminderSettings } from '@components/composite/ReminderSettings';

describe('ReminderSettings', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render all sections', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      const element = reminder.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLDivElement);
      expect(element.className).toContain('reminder-settings');

      // Should have enabled checkbox, datetime, and message sections
      const sections = element.querySelectorAll('.form-control');
      expect(sections.length).toBe(3);
    });

    it('should render enabled checkbox', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      const element = reminder.render();
      container.appendChild(element);

      const checkbox = element.querySelector('input[name="reminder_enabled"]') as HTMLInputElement;
      expect(checkbox).toBeTruthy();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBe(false);
    });

    it('should render datetime input', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      const element = reminder.render();
      container.appendChild(element);

      const input = element.querySelector('input[name="reminder_datetime"]');
      expect(input).toBeTruthy();
    });

    it('should render message input', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      const element = reminder.render();
      container.appendChild(element);

      const textarea = element.querySelector('textarea[name="reminder_message"]');
      expect(textarea).toBeTruthy();
      expect(textarea?.getAttribute('maxlength')).toBe('200');
    });

    it('should apply custom className', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        className: 'custom-reminder'
      });

      const element = reminder.render();
      expect(element.className).toContain('custom-reminder');
    });
  });

  describe('Initial Values', () => {
    it('should default to disabled', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const value = reminder.getValue();
      expect(value.enabled).toBe(false);
      expect(value.datetime).toBeNull();
      expect(value.message).toBeNull();
    });

    it('should set initial enabled state', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true
      });

      const element = reminder.render();
      container.appendChild(element);

      const checkbox = element.querySelector('input[name="reminder_enabled"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('should set initial datetime', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const value = reminder.getValue();
      expect(value.datetime).toBe('01.01.2026');
    });

    it('should set initial message', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        message: 'Payment due'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const value = reminder.getValue();
      expect(value.message).toBe('Payment due');
    });
  });

  describe('Conditional Visibility', () => {
    it('should hide datetime and message when disabled', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: false
      });

      const element = reminder.render();
      container.appendChild(element);

      const datetimeContainer = element.querySelectorAll('.form-control')[1];
      const messageContainer = element.querySelectorAll('.form-control')[2];

      expect(datetimeContainer.className).toContain('hidden');
      expect(messageContainer.className).toContain('hidden');
    });

    it('should show datetime and message when enabled', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true
      });

      const element = reminder.render();
      container.appendChild(element);

      const datetimeContainer = element.querySelectorAll('.form-control')[1];
      const messageContainer = element.querySelectorAll('.form-control')[2];

      expect(datetimeContainer.className).not.toContain('hidden');
      expect(messageContainer.className).not.toContain('hidden');
    });

    it('should toggle visibility when checkbox changes', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: false
      });

      const element = reminder.render();
      container.appendChild(element);

      const checkbox = element.querySelector('input[name="reminder_enabled"]') as HTMLInputElement;
      const datetimeContainer = element.querySelectorAll('.form-control')[1];
      const messageContainer = element.querySelectorAll('.form-control')[2];

      // Initially hidden
      expect(datetimeContainer.className).toContain('hidden');
      expect(messageContainer.className).toContain('hidden');

      // Check the checkbox
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      // Should be visible now
      expect(datetimeContainer.className).not.toContain('hidden');
      expect(messageContainer.className).not.toContain('hidden');

      // Uncheck
      checkbox.checked = false;
      checkbox.dispatchEvent(new Event('change'));

      // Should be hidden again
      expect(datetimeContainer.className).toContain('hidden');
      expect(messageContainer.className).toContain('hidden');
    });
  });

  describe('Validation', () => {
    it('should not require validation when disabled', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: false
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const result = reminder.validate();
      expect(result.valid).toBe(true);
    });

    it('should require datetime when enabled', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const result = reminder.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('дату напоминания');
    });

    it('should validate successfully with datetime', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const result = reminder.validate();
      expect(result.valid).toBe(true);
    });

    it('should validate message maxLength', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026',
        message: 'a'.repeat(201) // Over limit
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const result = reminder.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toContain('200 символов');
    });

    it('should accept message within limit', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026',
        message: 'Payment reminder'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const result = reminder.validate();
      expect(result.valid).toBe(true);
    });

    it('should allow empty message', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026',
        message: ''
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const result = reminder.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('Value Management', () => {
    it('should return disabled config when unchecked', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: false,
        datetime: '01.01.2026',
        message: 'Test'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const value = reminder.getValue();

      expect(value.enabled).toBe(false);
      expect(value.datetime).toBeNull();
      expect(value.message).toBeNull();
    });

    it('should return full config when enabled', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026',
        message: 'Payment due'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      const value = reminder.getValue();

      expect(value.enabled).toBe(true);
      expect(value.datetime).toBe('01.01.2026');
      expect(value.message).toBe('Payment due');
    });

    it('should set values programmatically', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      reminder.setValue({
        enabled: true,
        datetime: '15.01.2026',
        message: 'Important reminder'
      });

      const value = reminder.getValue();
      expect(value.enabled).toBe(true);
      expect(value.datetime).toBe('15.01.2026');
      expect(value.message).toBe('Important reminder');
    });

    it('should handle partial setValue', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        datetime: '01.01.2026'
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      // Update only message
      reminder.setValue({ message: 'New message' });

      const value = reminder.getValue();
      expect(value.enabled).toBe(true);
      expect(value.datetime).toBe('01.01.2026');
      expect(value.message).toBe('New message');
    });
  });

  describe('onChange Callback', () => {
    it('should trigger onChange when enabled changes', () => {
      const onChange = vi.fn();
      const reminder = new ReminderSettings({
        name: 'reminder',
        onChange
      });

      const element = reminder.render();
      container.appendChild(element);

      const checkbox = element.querySelector('input[name="reminder_enabled"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true
        })
      );
    });

    it('should trigger onChange when datetime changes', () => {
      const onChange = vi.fn();
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        onChange
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      // Set value programmatically which triggers onChange
      reminder.setValue({
        enabled: true,
        datetime: '15.01.2026',
        message: null
      });

      // onChange should be called via internal handleChange
      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          datetime: '15.01.2026'
        })
      );
    });

    it('should trigger onChange when message changes', () => {
      const onChange = vi.fn();
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true,
        onChange
      });

      reminder.render();
      container.appendChild(reminder.getElement()!);

      // Trigger message textarea change
      const textarea = container.querySelector('textarea[name="reminder_message"]') as HTMLTextAreaElement;
      textarea.value = 'New message';
      textarea.dispatchEvent(new Event('input'));

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should destroy all sub-components', () => {
      const reminder = new ReminderSettings({
        name: 'reminder'
      });

      const element = reminder.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      reminder.destroy();

      expect(reminder.getElement()).toBeNull();
    });
  });

  describe('Help Text', () => {
    it('should show datetime help text', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true
      });

      const element = reminder.render();
      container.appendChild(element);

      const datetimeHelp = element.querySelectorAll('.label-text-alt')[0];
      expect(datetimeHelp?.textContent).toContain('уведомление');
    });

    it('should show message help text', () => {
      const reminder = new ReminderSettings({
        name: 'reminder',
        enabled: true
      });

      const element = reminder.render();
      container.appendChild(element);

      const messageHelp = element.querySelectorAll('.label-text-alt')[1];
      expect(messageHelp?.textContent).toContain('Максимум 200 символов');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: enable -> set values -> validate -> get config', () => {
      const onChange = vi.fn();
      const reminder = new ReminderSettings({
        name: 'reminder',
        onChange
      });

      const element = reminder.render();
      container.appendChild(element);

      // Enable reminder
      const checkbox = element.querySelector('input[name="reminder_enabled"]') as HTMLInputElement;
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));

      // Set values
      reminder.setValue({
        enabled: true,
        datetime: '01.01.2026',
        message: 'Test reminder'
      });

      // Validate
      const validation = reminder.validate();
      expect(validation.valid).toBe(true);

      // Get config
      const config = reminder.getValue();
      expect(config).toEqual({
        enabled: true,
        datetime: '01.01.2026',
        message: 'Test reminder'
      });

      expect(onChange).toHaveBeenCalled();
    });
  });
});

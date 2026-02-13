/**
 * Unit tests for FormField component
 *
 * Tests label rendering, error display, and help text
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { FormField } from '@components/core/FormField';

describe('FormField', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render wrapper with form-control class', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Test Field',
        name: 'test',
        children: input
      });

      const element = field.render();
      expect(element.className).toContain('form-control');
    });

    it('should render label with correct text', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Email Address',
        name: 'email',
        children: input
      });

      const element = field.render();
      const label = element.querySelector('label');

      expect(label).toBeTruthy();
      expect(label?.textContent).toContain('Email Address');
    });

    it('should show required indicator when required', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Password',
        name: 'password',
        required: true,
        children: input
      });

      const element = field.render();
      const labelText = element.querySelector('.label-text');

      expect(labelText).toBeTruthy();
      expect(labelText?.textContent).toContain('Password *');
    });

    it('should not show required indicator when not required', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Optional Field',
        name: 'optional',
        required: false,
        children: input
      });

      const element = field.render();
      const labelText = element.querySelector('.label-text');

      expect(labelText).toBeTruthy();
      expect(labelText?.textContent).toBe('Optional Field');
      expect(labelText?.textContent).not.toContain('*');
    });

    it('should append children element', () => {
      const input = document.createElement('input');
      input.type = 'text';

      const field = new FormField({
        label: 'Test',
        name: 'test',
        children: input
      });

      const element = field.render();

      // Input should be set with id='test' (from name prop)
      const childInput = element.querySelector('input#test');

      expect(childInput).toBe(input);
    });

    it('should apply custom className', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Test',
        name: 'test',
        className: 'custom-wrapper',
        children: input
      });

      const element = field.render();
      expect(element.className).toContain('custom-wrapper');
    });
  });

  describe('Help Text', () => {
    it('should show help text when provided', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Email',
        name: 'email',
        helpText: 'We will never share your email',
        children: input
      });

      const element = field.render();
      const helpSpan = element.querySelector('.label-text-alt');

      expect(helpSpan).toBeTruthy();
      expect(helpSpan?.textContent).toBe('We will never share your email');
      expect(helpSpan?.className).toContain('text-base-content/70');
    });

    it('should not render help text element when not provided', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Name',
        name: 'name',
        children: input
      });

      const element = field.render();
      const labels = element.querySelectorAll('label');

      // Should only have one label (for the field itself, not help text)
      expect(labels.length).toBe(1);
    });
  });

  describe('Error Display', () => {
    it('should show error when showError is called', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Email',
        name: 'email',
        children: input
      });

      const element = field.render();
      field.showError('Invalid email format');

      const errorSpan = element.querySelector('.label-text-alt.text-error');

      expect(errorSpan).toBeTruthy();
      expect(errorSpan?.textContent).toBe('Invalid email format');
    });

    it('should clear error when clearError is called', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Email',
        name: 'email',
        children: input
      });

      const element = field.render();
      field.showError('Invalid email');

      let errorSpan = element.querySelector('.label-text-alt.text-error');
      expect(errorSpan).toBeTruthy();

      field.clearError();
      errorSpan = element.querySelector('.label-text-alt.text-error');
      expect(errorSpan).toBeNull();
    });

    it('should show initial error if provided in props', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Email',
        name: 'email',
        error: 'Email is required',
        children: input
      });

      const element = field.render();
      const errorSpan = element.querySelector('.label-text-alt.text-error');

      expect(errorSpan).toBeTruthy();
      expect(errorSpan?.textContent).toBe('Email is required');
    });

    it('should show error alongside help text', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Email',
        name: 'email',
        helpText: 'Enter your email address',
        children: input
      });

      const element = field.render();
      container.appendChild(element);

      // Initially shows help text
      const helpText = element.querySelector('.text-base-content\\/70');
      expect(helpText?.textContent).toBe('Enter your email address');

      // After error, shows error element
      field.showError('Invalid email');
      const errorText = element.querySelector('.text-error');
      expect(errorText?.textContent).toBe('Invalid email');
    });
  });

  describe('DOM Access', () => {
    it('should return wrapper element from getElement', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Test',
        name: 'test',
        children: input
      });

      field.render();
      const wrapper = field.getElement();

      expect(wrapper).toBeInstanceOf(HTMLDivElement);
      expect(wrapper?.className).toContain('form-control');
    });
  });

  describe('Cleanup', () => {
    it('should destroy and cleanup', () => {
      const input = document.createElement('input');
      const field = new FormField({
        label: 'Test',
        name: 'test',
        children: input
      });

      const element = field.render();
      container.appendChild(element);

      expect(container.contains(element)).toBe(true);

      field.destroy();
      expect(field.getElement()).toBeNull();
    });
  });

  describe('Integration with Input Components', () => {
    it('should work with input element', () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'input input-bordered';

      const field = new FormField({
        label: 'Username',
        name: 'username',
        required: true,
        children: input
      });

      const element = field.render();
      const fieldInput = element.querySelector('input');

      expect(fieldInput).toBe(input);
      expect(fieldInput?.type).toBe('text');
      expect(fieldInput?.className).toContain('input-bordered');
    });

    it('should work with select element', () => {
      const select = document.createElement('select');
      select.className = 'select select-bordered';

      const option = document.createElement('option');
      option.value = '1';
      option.textContent = 'Option 1';
      select.appendChild(option);

      const field = new FormField({
        label: 'Choose Option',
        name: 'option',
        children: select
      });

      const element = field.render();
      const fieldSelect = element.querySelector('select');

      expect(fieldSelect).toBe(select);
      expect(fieldSelect?.options.length).toBe(1);
    });

    it('should work with textarea element', () => {
      const textarea = document.createElement('textarea');
      textarea.className = 'textarea textarea-bordered';

      const field = new FormField({
        label: 'Description',
        name: 'description',
        children: textarea
      });

      const element = field.render();
      const fieldTextarea = element.querySelector('textarea');

      expect(fieldTextarea).toBe(textarea);
      expect(fieldTextarea?.className).toContain('textarea-bordered');
    });
  });
});

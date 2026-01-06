/**
 * Unit tests for CostCenterSelect component
 *
 * Tests API integration for loading cost centers with MSW mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CostCenterSelect } from '@components/composite/CostCenterSelect';
import { server } from '../../../setup/msw';
import { http, HttpResponse } from 'msw';
import { mockCostCenters } from '../../../setup/mswHandlers';

describe('CostCenterSelect', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render select element', () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLSelectElement);
      expect(element.name).toBe('cost_center_id');
    });

    it('should render with placeholder option before loading', () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      expect(element.options.length).toBe(1);
      expect(element.options[0].textContent).toBe('-- Выберите место затрат --');
    });

    it('should use custom placeholder', () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        placeholder: 'Select cost center'
      });

      const element = select.render();
      container.appendChild(element);

      expect(element.options[0].textContent).toBe('Select cost center');
    });
  });

  describe('API Integration', () => {
    it('should load cost centers from API', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      // Should have placeholder + 3 active centers (excluding inactive one)
      expect(element.options.length).toBe(4);
      expect(element.options[1].textContent).toBe('Семейный бюджет');
      expect(element.options[2].textContent).toBe('Ремонт квартиры');
      expect(element.options[3].textContent).toBe('Отпуск 2026');
    });

    it('should filter out inactive cost centers', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      select.render();
      await select.loadOptions();

      expect(select.isLoaded()).toBe(true);

      // Should NOT include "Закрытый проект" (is_active: false)
      const element = select.getElement()!;
      const optionTexts = Array.from(element.options).map(opt => opt.textContent);
      expect(optionTexts).not.toContain('Закрытый проект');
    });

    it('should mark as loaded after successful load', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      select.render(); // MUST render before loadOptions
      expect(select.isLoaded()).toBe(false);

      await select.loadOptions();

      expect(select.isLoaded()).toBe(true);
    });

    it('should handle API errors', async () => {
      // Mock error response
      server.use(
        http.get('/api/v1/cost-centers', () => {
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
          );
        })
      );

      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      await expect(select.loadOptions()).rejects.toThrow();
      expect(select.isLoaded()).toBe(false);
    });

    it('should handle network errors', async () => {
      // Mock network error
      server.use(
        http.get('/api/v1/cost-centers', () => {
          return HttpResponse.error();
        })
      );

      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      await expect(select.loadOptions()).rejects.toThrow();
    });
  });

  describe('Value Management', () => {
    it('should get current value', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      select.setValue(1);
      expect(select.getValue()).toBe(1);
    });

    it('should set value programmatically', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      select.setValue(2);

      const elementValue = element.value;
      expect(elementValue).toBe('2');
    });

    it('should handle null value', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        value: 1
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      select.setValue(null);
      expect(select.getValue()).toBeNull();
    });

    it('should restore value after loading if set before', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        value: 2
      });

      const element = select.render();
      container.appendChild(element);

      // Before loading, value is set in props but not in DOM (option doesn't exist yet)
      // Don't check element.value here - it will be '' because option '2' doesn't exist yet

      await select.loadOptions();

      // Value should be restored after loading
      expect(select.getValue()).toBe(2);
      expect(element.value).toBe('2'); // Now the option exists
    });
  });

  describe('Validation', () => {
    it('should validate required field', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        required: true
      });

      select.render();
      container.appendChild(select.getElement()!);

      await select.loadOptions();

      // Empty value
      select.setValue(null);
      let result = select.validate();
      expect(result.valid).toBe(false);

      // Valid value
      select.setValue(1);
      result = select.validate();
      expect(result.valid).toBe(true);
    });

    it('should allow empty value when not required', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        required: false
      });

      select.render();
      await select.loadOptions();

      select.setValue(null);
      const result = select.validate();
      expect(result.valid).toBe(true);
    });
  });

  describe('onChange Callback', () => {
    it('should trigger onChange when value changes', async () => {
      const onChange = vi.fn();
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        onChange
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      element.value = '1';
      element.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalledWith(1);
    });

    it('should pass null when empty option selected', async () => {
      const onChange = vi.fn();
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        onChange
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      element.value = '';
      element.dispatchEvent(new Event('change'));

      expect(onChange).toHaveBeenCalledWith(null);
    });
  });

  describe('Focus Management', () => {
    it('should focus the select element', () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      select.focus();
      expect(document.activeElement).toBe(element);
    });
  });

  describe('Cleanup', () => {
    it('should destroy the component', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      const element = select.render();
      container.appendChild(element);

      await select.loadOptions();

      expect(container.contains(element)).toBe(true);

      select.destroy();
      expect(select.getElement()).toBeNull();
    });
  });

  describe('Response Format Handling', () => {
    it('should handle response with data wrapper', async () => {
      // Default mock returns { data: [...] }
      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      select.render();
      await select.loadOptions();

      expect(select.isLoaded()).toBe(true);
    });

    it('should handle response without data wrapper', async () => {
      // Mock direct array response
      server.use(
        http.get('/api/v1/cost-centers', () => {
          return HttpResponse.json(mockCostCenters);
        })
      );

      const select = new CostCenterSelect({
        name: 'cost_center_id'
      });

      select.render();
      await select.loadOptions();

      expect(select.isLoaded()).toBe(true);
    });
  });

  describe('Initial State', () => {
    it('should set disabled state', () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        disabled: true
      });

      const element = select.render();
      expect(element.disabled).toBe(true);
    });

    it('should apply custom className', () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        className: 'custom-select'
      });

      const element = select.render();
      expect(element.className).toContain('custom-select');
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: create -> load -> select -> validate', async () => {
      const onChange = vi.fn();
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        required: true,
        onChange
      });

      // Render
      const element = select.render();
      container.appendChild(element);

      // Load options
      await select.loadOptions();
      expect(select.isLoaded()).toBe(true);

      // Select value
      select.setValue(1);
      expect(select.getValue()).toBe(1);

      // Validate
      const validation = select.validate();
      expect(validation.valid).toBe(true);

      // Trigger onChange
      element.value = '2';
      element.dispatchEvent(new Event('change'));
      expect(onChange).toHaveBeenCalledWith(2);
    });

    it('should handle optional cost center field', async () => {
      const select = new CostCenterSelect({
        name: 'cost_center_id',
        required: false
      });

      select.render();
      await select.loadOptions();

      // Empty value should be valid
      select.setValue(null);
      expect(select.validate().valid).toBe(true);

      // Non-empty value should also be valid
      select.setValue(1);
      expect(select.validate().valid).toBe(true);
    });
  });
});

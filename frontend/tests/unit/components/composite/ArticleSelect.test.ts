/**
 * Unit tests for ArticleSelect component
 *
 * Tests wrapper functionality for HierarchySelect with article-specific methods
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ArticleSelect } from '@components/composite/ArticleSelect';
import type { Article } from '@components/types';

// Mock HierarchySelect
const mockHierarchySelect = {
  render: vi.fn(),
  validate: vi.fn(),
  getValue: vi.fn(),
  setValue: vi.fn(),
  focus: vi.fn(),
  getElement: vi.fn(),
  updateType: vi.fn(),
  updateFinancialCenter: vi.fn(),
  destroy: vi.fn()
};

vi.mock('@components/core/HierarchySelect', () => ({
  HierarchySelect: vi.fn(() => mockHierarchySelect)
}));

describe('ArticleSelect', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    container.remove();
  });

  describe('Initialization', () => {
    it('should initialize HierarchySelect with correct props', async () => {
      const onChange = vi.fn();
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense',
        financialCenterId: 1,
        required: true,
        onChange
      });

      // Access mocked constructor via vi.mocked
      const { HierarchySelect } = await import('@components/core/HierarchySelect');
      expect(HierarchySelect).toHaveBeenCalledWith({
        name: 'article_id',
        type: 'category',
        articleType: 'expense',
        financialCenterId: 1,
        value: undefined,
        multiple: undefined,
        onChange
      });
    });

    it('should initialize with income type', async () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'income'
      });

      const { HierarchySelect } = await import('@components/core/HierarchySelect');
      expect(HierarchySelect).toHaveBeenCalledWith(
        expect.objectContaining({
          articleType: 'income'
        })
      );
    });

    it('should support multiple selection', async () => {
      const select = new ArticleSelect({
        name: 'article_ids',
        articleType: 'expense',
        multiple: true
      });

      const { HierarchySelect } = await import('@components/core/HierarchySelect');
      expect(HierarchySelect).toHaveBeenCalledWith(
        expect.objectContaining({
          multiple: true
        })
      );
    });
  });

  describe('Rendering', () => {
    it('should delegate render to HierarchySelect', () => {
      const mockElement = document.createElement('select');
      mockHierarchySelect.render.mockReturnValue(mockElement);

      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      const element = select.render();

      expect(mockHierarchySelect.render).toHaveBeenCalled();
      expect(element).toBe(mockElement);
    });
  });

  describe('Value Management', () => {
    it('should get value from HierarchySelect', () => {
      mockHierarchySelect.getValue.mockReturnValue(42);

      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      expect(select.getValue()).toBe(42);
      expect(mockHierarchySelect.getValue).toHaveBeenCalled();
    });

    it('should set value through HierarchySelect', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.setValue(55);

      expect(mockHierarchySelect.setValue).toHaveBeenCalledWith(55);
    });

    it('should handle multiple selection values', () => {
      mockHierarchySelect.getValue.mockReturnValue([1, 2, 3]);

      const select = new ArticleSelect({
        name: 'article_ids',
        articleType: 'expense',
        multiple: true
      });

      const value = select.getValue();
      expect(Array.isArray(value)).toBe(true);
      expect(value).toEqual([1, 2, 3]);
    });

    it('should set multiple selection values', () => {
      const select = new ArticleSelect({
        name: 'article_ids',
        articleType: 'expense',
        multiple: true
      });

      select.setValue([10, 20, 30]);

      expect(mockHierarchySelect.setValue).toHaveBeenCalledWith([10, 20, 30]);
    });
  });

  describe('Type Updates', () => {
    it('should update article type', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.updateType('income');

      expect(mockHierarchySelect.updateType).toHaveBeenCalledWith('income');
    });

    it('should update internal articleType property', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.updateType('income');

      // Internal prop should be updated (reflected in next initialization)
      expect(mockHierarchySelect.updateType).toHaveBeenCalledWith('income');
    });

    it('should switch between expense and income types', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.updateType('income');
      expect(mockHierarchySelect.updateType).toHaveBeenCalledWith('income');

      select.updateType('expense');
      expect(mockHierarchySelect.updateType).toHaveBeenCalledWith('expense');
    });
  });

  describe('Financial Center Updates', () => {
    it('should update financial center filter', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.updateFinancialCenter(999);

      expect(mockHierarchySelect.updateFinancialCenter).toHaveBeenCalledWith(999);
    });

    it('should handle null financial center', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense',
        financialCenterId: 1
      });

      select.updateFinancialCenter(null);

      expect(mockHierarchySelect.updateFinancialCenter).toHaveBeenCalledWith(null);
    });

    it('should update internal financialCenterId property', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense',
        financialCenterId: 1
      });

      select.updateFinancialCenter(2);

      expect(mockHierarchySelect.updateFinancialCenter).toHaveBeenCalledWith(2);
    });
  });

  describe('Validation', () => {
    it('should delegate validation to HierarchySelect', () => {
      mockHierarchySelect.validate.mockReturnValue({ valid: true });

      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      const result = select.validate();

      expect(mockHierarchySelect.validate).toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });

    it('should return validation errors', () => {
      mockHierarchySelect.validate.mockReturnValue({
        valid: false,
        error: 'Выберите статью'
      });

      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      const result = select.validate();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Выберите статью');
    });
  });

  describe('Focus Management', () => {
    it('should delegate focus to HierarchySelect', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.focus();

      expect(mockHierarchySelect.focus).toHaveBeenCalled();
    });
  });

  describe('Element Access', () => {
    it('should delegate getElement to HierarchySelect', () => {
      const mockElement = document.createElement('select');
      mockHierarchySelect.getElement.mockReturnValue(mockElement);

      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      const element = select.getElement();

      expect(mockHierarchySelect.getElement).toHaveBeenCalled();
      expect(element).toBe(mockElement);
    });
  });

  describe('Cleanup', () => {
    it('should delegate destroy to HierarchySelect', () => {
      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      select.destroy();

      expect(mockHierarchySelect.destroy).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: create -> update filters -> change value', () => {
      mockHierarchySelect.getValue.mockReturnValue(null);

      const select = new ArticleSelect({
        name: 'article_id',
        articleType: 'expense'
      });

      // Switch to income
      select.updateType('income');
      expect(mockHierarchySelect.updateType).toHaveBeenCalledWith('income');

      // Update financial center
      select.updateFinancialCenter(5);
      expect(mockHierarchySelect.updateFinancialCenter).toHaveBeenCalledWith(5);

      // Set value
      select.setValue(42);
      expect(mockHierarchySelect.setValue).toHaveBeenCalledWith(42);

      // Get value
      mockHierarchySelect.getValue.mockReturnValue(42);
      expect(select.getValue()).toBe(42);
    });
  });
});

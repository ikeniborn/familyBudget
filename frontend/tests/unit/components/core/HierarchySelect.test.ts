/**
 * Unit tests for HierarchySelect component
 *
 * Tests generic tree select wrapper (public API only)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HierarchySelect } from '@components/core/HierarchySelect';
import type { Article } from '@components/types';

// HierarchySelect uses global BudgetShared.ChoicesCategoryTree
// Mock is provided in setup.ts

describe('HierarchySelect', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  describe('Rendering', () => {
    it('should render select element with correct attributes', () => {
      const select = new HierarchySelect<Article>({
        name: 'article_id',
        type: 'category'
      });

      const element = select.render();
      container.appendChild(element);

      expect(element).toBeInstanceOf(HTMLSelectElement);
      expect(element.id).toBe('article_id');
      expect(element.name).toBe('article_id');
    });

    // Note: ChoicesCategoryTree integration tested in integration tests
  });

  describe('Value Management', () => {

    it('should set value', () => {
      const select = new HierarchySelect<Article>({
        name: 'article_id',
        type: 'category'
      });

      const element = select.render();
      container.appendChild(element);

      select.setValue(3);
      
      // Mock updates select.value
      expect(element.value).toBe('3');
    });

    it('should handle null value', () => {
      const select = new HierarchySelect<Article>({
        name: 'article_id',
        type: 'category'
      });

      select.render();
      container.appendChild(select.getElement()!);

      const value = select.getValue();
      expect(value).toBeNull();
    });
  });

  describe('Validation', () => {
    // Note: Validation with actual values tested in integration tests

    it('should validate required field without value', () => {
      const select = new HierarchySelect<Article>({
        name: 'article_id',
        type: 'category',
        required: true
      });

      select.render();
      container.appendChild(select.getElement()!);

      const result = select.validate();
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Generic Type Safety', () => {
    it('should work with Article type', () => {
      const select = new HierarchySelect<Article>({
        name: 'article_id',
        type: 'category'
      });

      expect(select).toBeDefined();
    });

    it('should work with custom types', () => {
      interface CustomType {
        id: number;
        name: string;
      }

      const select = new HierarchySelect<CustomType>({
        name: 'custom_id',
        type: 'category'
      });

      expect(select).toBeDefined();
    });
  });

  describe('Focus Management', () => {
    it('should focus the select element', () => {
      const select = new HierarchySelect<Article>({
        name: 'article_id',
        type: 'category'
      });

      const element = select.render();
      container.appendChild(element);

      select.focus();
      expect(document.activeElement).toBe(element);
    });
  });
});

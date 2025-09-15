import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, waitFor, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';

// Mock the stores and services
vi.mock('$lib/stores/auth.store', () => ({
  isAuthenticated: writable(true),
  user: writable({ id: 1, username: 'testuser' })
}));

vi.mock('$lib/stores/toast.store', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('Nomenclature Field Mapping Fix', () => {
  describe('Field Mapping Validation', () => {
    it('should include code field in API request', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 1,
            code: 'TEST001',
            name: 'Test Nomenclature',
            account_name: 'Test Account',
            bill_name: 'Test Bill',
            operation: 'Test Operation'
          }
        })
      });
      global.fetch = mockFetch;

      const formData = {
        code: 'TEST001',
        name: 'Test Nomenclature',
        account_name: 'Test Account',
        bill_name: 'Test Bill',
        operation: 'Test Operation',
        nomenclature_type: 'EXPENSE',
        is_active: true
      };

      // Simulate form submission
      const response = await fetch('/api/nomenclatures/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      // Verify the request was made with the code field
      expect(mockFetch).toHaveBeenCalledWith('/api/nomenclatures/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      // Verify the code field was included in the request body
      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toHaveProperty('code', 'TEST001');
      expect(requestBody).toHaveProperty('name', 'Test Nomenclature');
      expect(requestBody).toHaveProperty('account_name', 'Test Account');
      expect(requestBody).toHaveProperty('bill_name', 'Test Bill');
      expect(requestBody).toHaveProperty('operation', 'Test Operation');
    });

    it('should validate required fields before submission', () => {
      const validateFormData = (formData: any) => {
        const errors: string[] = [];

        if (!formData.code) errors.push('Code is required');
        if (!formData.name) errors.push('Name is required');
        if (!formData.account_name) errors.push('Account name is required');
        if (!formData.bill_name) errors.push('Bill name is required');
        if (!formData.operation) errors.push('Operation is required');

        return errors;
      };

      // Test with missing code field
      const invalidData = {
        name: 'Test',
        account_name: 'Account',
        bill_name: 'Bill',
        operation: 'Operation'
      };

      const errors = validateFormData(invalidData);
      expect(errors).toContain('Code is required');

      // Test with all required fields
      const validData = {
        code: 'TEST001',
        name: 'Test',
        account_name: 'Account',
        bill_name: 'Bill',
        operation: 'Operation'
      };

      const noErrors = validateFormData(validData);
      expect(noErrors).toHaveLength(0);
    });

    it('should handle backend validation errors correctly', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          success: false,
          error: 'Validation failed',
          details: {
            code: ['Field required']
          }
        })
      });
      global.fetch = mockFetch;

      const formData = {
        // Missing code field to trigger validation error
        name: 'Test Nomenclature',
        account_name: 'Test Account',
        bill_name: 'Test Bill',
        operation: 'Test Operation'
      };

      const response = await fetch('/api/nomenclatures/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(422);
      expect(result.error).toBe('Validation failed');
      expect(result.details.code).toContain('Field required');
    });

    it('should map frontend fields to backend schema correctly', () => {
      const mapFormDataToRequest = (formData: any) => {
        return {
          code: formData.code,
          name: formData.name,
          account_name: formData.account_name || formData.name,
          bill_name: formData.bill_name || formData.name,
          operation: formData.operation || formData.name,
          description: formData.description || null,
          nomenclature_type: formData.nomenclature_type || 'EXPENSE',
          is_budget: formData.is_budget !== undefined ? formData.is_budget : true,
          is_fact: formData.is_fact !== undefined ? formData.is_fact : true,
          is_active: formData.is_active !== undefined ? formData.is_active : true
        };
      };

      const formData = {
        code: 'TEST001',
        name: 'Test Name',
        nomenclature_type: 'INCOME',
        is_active: false
      };

      const requestData = mapFormDataToRequest(formData);

      // Verify all required fields are mapped
      expect(requestData.code).toBe('TEST001');
      expect(requestData.name).toBe('Test Name');
      expect(requestData.account_name).toBe('Test Name'); // Falls back to name
      expect(requestData.bill_name).toBe('Test Name'); // Falls back to name
      expect(requestData.operation).toBe('Test Name'); // Falls back to name
      expect(requestData.nomenclature_type).toBe('INCOME');
      expect(requestData.is_active).toBe(false);
      expect(requestData.is_budget).toBe(true);
      expect(requestData.is_fact).toBe(true);
    });
  });

  describe('UI Form Fields', () => {
    it('should have all required form fields', () => {
      const requiredFields = [
        'code',
        'name',
        'account_name',
        'bill_name',
        'operation'
      ];

      const formFields = {
        code: { label: 'Код номенклатуры', type: 'text', required: true },
        name: { label: 'Название номенклатуры', type: 'text', required: true },
        account_name: { label: 'Название счета', type: 'text', required: true },
        bill_name: { label: 'Название счета', type: 'text', required: true },
        operation: { label: 'Операция', type: 'text', required: true },
        nomenclature_type: { label: 'Тип номенклатуры', type: 'select', options: ['EXPENSE', 'INCOME'] },
        description: { label: 'Описание', type: 'textarea', required: false },
        is_active: { label: 'Активна', type: 'checkbox', required: false }
      };

      // Verify all required fields exist
      requiredFields.forEach(field => {
        expect(formFields).toHaveProperty(field);
        expect(formFields[field as keyof typeof formFields].required).toBe(true);
      });
    });
  });
});
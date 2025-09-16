/**
 * Test suite for simplified nomenclature form changes.
 * Verifies that the form works correctly without account_name, bill_name, and operation fields.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import type { Nomenclature } from '$lib/types';

// Mock the page component
import NomenclaturePage from '../routes/(protected)/settings/nomenclatures/+page.svelte';

// Mock dependencies
vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn()
  })
}));

vi.mock('$lib/stores/auth.store', () => ({
  isAdmin: { subscribe: vi.fn((callback) => callback(true)) }
}));

// Mock API service
const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn()
};

vi.mock('$lib/services/api', () => ({
  api: mockApi
}));

describe('Nomenclature Simplified Form', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default API responses
    mockApi.get.mockResolvedValue({
      success: true,
      data: []
    });

    mockApi.post.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        code: 'TEST001',
        name: 'Test Nomenclature',
        description: 'Test description',
        nomenclature_type: 'EXPENSE',
        account_name: null,
        bill_name: null,
        operation: null,
        is_budget: true,
        is_fact: true,
        is_active: true
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render form without removed fields', async () => {
    render(NomenclaturePage);

    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Click add button to open modal
    const addButton = screen.getByRole('button', { name: /добавить номенклатуру/i });
    await fireEvent.click(addButton);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText('Добавить номенклатуру')).toBeInTheDocument();
    });

    // Check that required fields are present
    expect(screen.getByLabelText(/код/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/название/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/описание/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/тип/i)).toBeInTheDocument();

    // Check that removed fields are NOT present
    expect(screen.queryByLabelText(/счет/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/счёт/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/bill/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/операция/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/operation/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/account_name/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/bill_name/i)).not.toBeInTheDocument();
  });

  it('should successfully create nomenclature with only required fields', async () => {
    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Open add modal
    const addButton = screen.getByRole('button', { name: /добавить номенклатуру/i });
    await fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Добавить номенклатуру')).toBeInTheDocument();
    });

    // Fill in only the simplified form fields
    const codeInput = screen.getByLabelText(/код/i);
    const nameInput = screen.getByLabelText(/название/i);
    const descriptionInput = screen.getByLabelText(/описание/i);

    await fireEvent.input(codeInput, { target: { value: 'SIMPLE001' } });
    await fireEvent.input(nameInput, { target: { value: 'Simple Nomenclature' } });
    await fireEvent.input(descriptionInput, { target: { value: 'Test description' } });

    // Submit form
    const saveButton = screen.getByRole('button', { name: /сохранить/i });
    await fireEvent.click(saveButton);

    // Verify API call was made with correct data structure
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/nomenclatures/', {
        code: 'SIMPLE001',
        name: 'Simple Nomenclature',
        description: 'Test description',
        nomenclature_type: 'EXPENSE',
        is_budget: true,
        is_fact: true,
        is_active: true
      });
    });

    // Verify no removed fields were included in the request
    const apiCall = mockApi.post.mock.calls[0];
    const requestData = apiCall[1];
    expect(requestData).not.toHaveProperty('account_name');
    expect(requestData).not.toHaveProperty('bill_name');
    expect(requestData).not.toHaveProperty('operation');
  });

  it('should handle form validation for required fields only', async () => {
    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Open add modal
    const addButton = screen.getByRole('button', { name: /добавить номенклатуру/i });
    await fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Добавить номенклатуру')).toBeInTheDocument();
    });

    // Try to submit empty form
    const saveButton = screen.getByRole('button', { name: /сохранить/i });
    await fireEvent.click(saveButton);

    // Should not call API with empty required fields
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('should handle API response with null optional fields correctly', async () => {
    // Mock API response with null optional fields
    mockApi.get.mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          code: 'EXIST001',
          name: 'Existing Nomenclature',
          description: 'Existing description',
          nomenclature_type: 'EXPENSE',
          account_name: null,
          bill_name: null,
          operation: null,
          is_budget: true,
          is_fact: true,
          is_active: true
        }
      ]
    });

    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Existing Nomenclature')).toBeInTheDocument();
    });

    // Verify that nomenclature displays correctly even with null optional fields
    expect(screen.getByText('EXIST001')).toBeInTheDocument();
    expect(screen.getByText('Existing Nomenclature')).toBeInTheDocument();
  });

  it('should handle editing nomenclature without optional fields', async () => {
    const mockNomenclature: Nomenclature = {
      id: 1,
      nomenclature_id: 1,
      code: 'EDIT001',
      name: 'Edit Test',
      description: 'Edit description',
      nomenclature_type: 'EXPENSE',
      account_name: null,
      bill_name: null,
      operation: null,
      is_budget: true,
      is_fact: true,
      is_active: true,
      user_id: 1
    };

    mockApi.get.mockResolvedValue({
      success: true,
      data: [mockNomenclature]
    });

    mockApi.put.mockResolvedValue({
      success: true,
      data: {
        ...mockNomenclature,
        name: 'Updated Name'
      }
    });

    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Edit Test')).toBeInTheDocument();
    });

    // Find and click edit button
    const editButtons = screen.getAllByRole('button');
    const editButton = editButtons.find(btn => btn.getAttribute('aria-label')?.includes('редактировать'));

    if (editButton) {
      await fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByText('Редактировать номенклатуру')).toBeInTheDocument();
      });

      // Update name
      const nameInput = screen.getByDisplayValue('Edit Test');
      await fireEvent.input(nameInput, { target: { value: 'Updated Name' } });

      // Submit
      const saveButton = screen.getByRole('button', { name: /сохранить/i });
      await fireEvent.click(saveButton);

      // Verify API call
      await waitFor(() => {
        expect(mockApi.put).toHaveBeenCalledWith(`/nomenclatures/${mockNomenclature.id}/`, {
          code: 'EDIT001',
          name: 'Updated Name',
          description: 'Edit description',
          nomenclature_type: 'EXPENSE',
          is_budget: true,
          is_fact: true,
          is_active: true
        });
      });

      // Verify no removed fields were included
      const apiCall = mockApi.put.mock.calls[0];
      const requestData = apiCall[1];
      expect(requestData).not.toHaveProperty('account_name');
      expect(requestData).not.toHaveProperty('bill_name');
      expect(requestData).not.toHaveProperty('operation');
    }
  });

  it('should handle TypeScript types correctly without optional fields', async () => {
    // This test verifies that TypeScript interfaces work correctly
    const nomenclatureData = {
      code: 'TYPE001',
      name: 'Type Test',
      description: 'Type description',
      nomenclature_type: 'EXPENSE' as const,
      is_budget: true,
      is_fact: true,
      is_active: true
    };

    // Mock successful API response
    mockApi.post.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        ...nomenclatureData,
        account_name: null,
        bill_name: null,
        operation: null
      }
    });

    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Open add modal
    const addButton = screen.getByRole('button', { name: /добавить номенклатуру/i });
    await fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('Добавить номенклатуру')).toBeInTheDocument();
    });

    // Fill form
    const codeInput = screen.getByLabelText(/код/i);
    const nameInput = screen.getByLabelText(/название/i);
    const descriptionInput = screen.getByLabelText(/описание/i);

    await fireEvent.input(codeInput, { target: { value: nomenclatureData.code } });
    await fireEvent.input(nameInput, { target: { value: nomenclatureData.name } });
    await fireEvent.input(descriptionInput, { target: { value: nomenclatureData.description } });

    // Submit
    const saveButton = screen.getByRole('button', { name: /сохранить/i });
    await fireEvent.click(saveButton);

    // Verify proper typing and API call
    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/nomenclatures/', nomenclatureData);
    });
  });

  it('should handle backward compatibility with existing nomenclatures that have optional fields', async () => {
    // Mock response with nomenclatures that have the old optional fields
    const legacyNomenclatures = [
      {
        id: 1,
        code: 'LEGACY001',
        name: 'Legacy Nomenclature 1',
        description: 'Has old fields',
        nomenclature_type: 'EXPENSE',
        account_name: 'Legacy Account',
        bill_name: 'Legacy Bill',
        operation: 'Legacy Operation',
        is_budget: true,
        is_fact: true,
        is_active: true
      },
      {
        id: 2,
        code: 'NEW001',
        name: 'New Nomenclature',
        description: 'No old fields',
        nomenclature_type: 'INCOME',
        account_name: null,
        bill_name: null,
        operation: null,
        is_budget: true,
        is_fact: true,
        is_active: true
      }
    ];

    mockApi.get.mockResolvedValue({
      success: true,
      data: legacyNomenclatures
    });

    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Legacy Nomenclature 1')).toBeInTheDocument();
      expect(screen.getByText('New Nomenclature')).toBeInTheDocument();
    });

    // Both nomenclatures should display correctly regardless of optional field presence
    expect(screen.getByText('LEGACY001')).toBeInTheDocument();
    expect(screen.getByText('NEW001')).toBeInTheDocument();
  });

  it('should calculate statistics correctly without considering removed fields', async () => {
    const nomenclatures = [
      {
        id: 1,
        code: 'STAT001',
        name: 'Active Expense',
        nomenclature_type: 'EXPENSE',
        is_active: true,
        account_name: null,
        bill_name: null,
        operation: null
      },
      {
        id: 2,
        code: 'STAT002',
        name: 'Inactive Income',
        nomenclature_type: 'INCOME',
        is_active: false,
        account_name: null,
        bill_name: null,
        operation: null
      },
      {
        id: 3,
        code: 'STAT003',
        name: 'Active Income',
        nomenclature_type: 'INCOME',
        is_active: true,
        account_name: 'Account', // Has optional field
        bill_name: null,
        operation: null
      }
    ];

    mockApi.get.mockResolvedValue({
      success: true,
      data: nomenclatures
    });

    render(NomenclaturePage);

    await waitFor(() => {
      expect(screen.getByText('Управление номенклатурами')).toBeInTheDocument();
    });

    // Wait for statistics to be calculated and displayed
    await waitFor(() => {
      // Should show total count
      expect(screen.getByText('3')).toBeInTheDocument(); // Total nomenclatures

      // Should show active/inactive counts
      expect(screen.getByText('2')).toBeInTheDocument(); // Active nomenclatures
      expect(screen.getByText('1')).toBeInTheDocument(); // Inactive nomenclatures
    });

    // Statistics should work correctly regardless of optional field presence
    expect(screen.getByText('Active Expense')).toBeInTheDocument();
    expect(screen.getByText('Inactive Income')).toBeInTheDocument();
    expect(screen.getByText('Active Income')).toBeInTheDocument();
  });
});
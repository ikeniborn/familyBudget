import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import ReportFilters from './ReportFilters.svelte';

// Mock stores
const mockPeriodStore = writable({
  items: [
    {
      period_id: 1,
      period_name: '2025.01',
      period_ru_name: '2025 Янв'
    }
  ],
  loading: false,
  error: null
});

const mockFinancialCenterStore = writable({
  items: [
    {
      id: 1,
      name: 'Development Center',
      financial_center_id: undefined,  // Old field is undefined
      financial_center_name: undefined  // Old field is undefined
    },
    {
      id: 2,
      name: 'Marketing Center',
      financial_center_id: 2,  // Has both old and new fields
      financial_center_name: 'Old Marketing Name'
    }
  ],
  loading: false,
  error: null
});

const mockCostCenterStore = writable({
  items: [
    {
      id: 1,
      name: 'Web Development',
      cost_center_id: undefined,  // Old field is undefined
      cost_center_name: undefined  // Old field is undefined
    },
    {
      id: 2,
      name: 'Mobile Development',
      cost_center_id: 2,  // Has both old and new fields
      cost_center_name: 'Old Mobile Name'
    }
  ],
  loading: false,
  error: null
});

const mockCurrentUser = writable({
  id: 1,
  user_id: 1,
  user_name: 'Test User'
});

vi.mock('$lib/stores', () => ({
  periodStore: mockPeriodStore,
  financialCenterStore: mockFinancialCenterStore,
  costCenterStore: mockCostCenterStore
}));

vi.mock('$lib/stores/auth.store', () => ({
  currentUser: mockCurrentUser
}));

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn()
  })
}));

describe('ReportFilters Field Mapping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle financial centers with new field structure (id, name)', async () => {
    const onApplyFilters = vi.fn();
    const { container } = render(ReportFilters, {
      props: {
        onApplyFilters,
        isLoading: false
      }
    });

    // Wait for component to render
    await vi.delay(100);

    // Check that select options are rendered correctly
    const financialCenterSelect = container.querySelector('#financial-center');
    expect(financialCenterSelect).toBeTruthy();

    const options = financialCenterSelect?.querySelectorAll('option');
    expect(options).toBeTruthy();
    expect(options?.length).toBe(3); // 'all' + 2 items

    // Check option values and labels
    if (options) {
      expect(options[0].value).toBe('all');
      expect(options[0].textContent).toBe('Все ФЦ');

      expect(options[1].value).toBe('1');
      expect(options[1].textContent).toBe('Development Center');

      expect(options[2].value).toBe('2');
      expect(options[2].textContent).toBe('Marketing Center');
    }
  });

  it('should handle cost centers with new field structure (id, name)', async () => {
    const onApplyFilters = vi.fn();
    const { container } = render(ReportFilters, {
      props: {
        onApplyFilters,
        isLoading: false
      }
    });

    // Wait for component to render
    await vi.delay(100);

    // Check that select options are rendered correctly
    const costCenterSelect = container.querySelector('#cost-center');
    expect(costCenterSelect).toBeTruthy();

    const options = costCenterSelect?.querySelectorAll('option');
    expect(options).toBeTruthy();
    expect(options?.length).toBe(3); // 'all' + 2 items

    // Check option values and labels
    if (options) {
      expect(options[0].value).toBe('all');
      expect(options[0].textContent).toBe('Все МВЗ');

      expect(options[1].value).toBe('1');
      expect(options[1].textContent).toBe('Web Development');

      expect(options[2].value).toBe('2');
      expect(options[2].textContent).toBe('Mobile Development');
    }
  });

  it('should not throw error when fields are undefined', async () => {
    // Set store with all undefined old fields
    mockFinancialCenterStore.set({
      items: [
        {
          id: 1,
          name: 'Test Center',
          financial_center_id: undefined,
          financial_center_name: undefined
        }
      ],
      loading: false,
      error: null
    });

    mockCostCenterStore.set({
      items: [
        {
          id: 1,
          name: 'Test Cost Center',
          cost_center_id: undefined,
          cost_center_name: undefined
        }
      ],
      loading: false,
      error: null
    });

    const onApplyFilters = vi.fn();

    // This should not throw an error
    expect(() => {
      render(ReportFilters, {
        props: {
          onApplyFilters,
          isLoading: false
        }
      });
    }).not.toThrow();
  });

  it('should handle empty stores gracefully', async () => {
    // Set empty stores
    mockFinancialCenterStore.set({
      items: [],
      loading: false,
      error: null
    });

    mockCostCenterStore.set({
      items: [],
      loading: false,
      error: null
    });

    const onApplyFilters = vi.fn();
    const { container } = render(ReportFilters, {
      props: {
        onApplyFilters,
        isLoading: false
      }
    });

    // Wait for component to render
    await vi.delay(100);

    // Check that select options only have 'all' option
    const financialCenterSelect = container.querySelector('#financial-center');
    const financialOptions = financialCenterSelect?.querySelectorAll('option');
    expect(financialOptions?.length).toBe(1); // Only 'all'

    const costCenterSelect = container.querySelector('#cost-center');
    const costOptions = costCenterSelect?.querySelectorAll('option');
    expect(costOptions?.length).toBe(1); // Only 'all'
  });

  it('should use fallback value when both id fields are missing', async () => {
    mockFinancialCenterStore.set({
      items: [
        {
          // No id or financial_center_id
          name: 'Test Center'
        } as any
      ],
      loading: false,
      error: null
    });

    const onApplyFilters = vi.fn();
    const { container } = render(ReportFilters, {
      props: {
        onApplyFilters,
        isLoading: false
      }
    });

    // Wait for component to render
    await vi.delay(100);

    const financialCenterSelect = container.querySelector('#financial-center');
    const options = financialCenterSelect?.querySelectorAll('option');

    // Should have fallback value of '0'
    if (options && options[1]) {
      expect(options[1].value).toBe('0');
      expect(options[1].textContent).toBe('Test Center');
    }
  });

  it('should use fallback label when both name fields are missing', async () => {
    mockFinancialCenterStore.set({
      items: [
        {
          id: 1,
          // No name or financial_center_name
        } as any
      ],
      loading: false,
      error: null
    });

    const onApplyFilters = vi.fn();
    const { container } = render(ReportFilters, {
      props: {
        onApplyFilters,
        isLoading: false
      }
    });

    // Wait for component to render
    await vi.delay(100);

    const financialCenterSelect = container.querySelector('#financial-center');
    const options = financialCenterSelect?.querySelectorAll('option');

    // Should have fallback label
    if (options && options[1]) {
      expect(options[1].value).toBe('1');
      expect(options[1].textContent).toBe('Без названия');
    }
  });
});
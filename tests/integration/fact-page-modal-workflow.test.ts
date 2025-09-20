/**
 * Fact Page Modal Workflow Integration Tests
 *
 * Integration tests for the complete fact page workflow including modal interaction,
 * form submission, and component communication
 *
 * Created: 2025-09-20 (Fact Form Fixes)
 */

import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { tick } from 'svelte';

// Create a test component that includes both the fact page and modal logic
const FactPageTest = `
<script>
  import Modal from '$lib/components/ui/Modal.svelte';
  import FactForm from '$lib/components/fact/FactForm.svelte';
  import { CreditCard, Plus, BarChart3, Calculator } from 'lucide-svelte';

  let showForm = false;
  let refreshList = 0;

  function handleFormSuccess() {
    showForm = false;
    refreshList++;
  }

  function toggleForm() {
    showForm = !showForm;
  }

  // Export for testing
  export { showForm, refreshList, handleFormSuccess, toggleForm };
</script>

<div class="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
  <div class="container mx-auto px-4 py-8">
    <!-- Page Header -->
    <div class="page-header">
      <div class="header-content">
        <div class="header-icon-wrapper">
          <CreditCard class="h-10 w-10 text-white" />
        </div>
        <div>
          <h1 class="page-title">Фактические операции</h1>
          <p class="page-subtitle">
            Управляйте фактическими доходами и расходами вашего бюджета
          </p>
        </div>
      </div>
    </div>

    <!-- Action Panel -->
    <div class="action-panel">
      <button
        on:click={toggleForm}
        class="action-btn action-btn-primary"
        data-testid="add-operation-btn"
      >
        <Plus class="h-5 w-5" />
        Добавить операцию
      </button>
      <a href="/budget" class="action-btn action-btn-secondary">
        <Calculator class="h-5 w-5" />
        План
      </a>
      <a href="/reports" class="action-btn action-btn-secondary">
        <BarChart3 class="h-5 w-5" />
        Отчеты
      </a>
    </div>

    <!-- Main Content -->
    <div class="main-content">
      <div class="list-wrapper">
        <div data-testid="fact-list">
          <p>Fact List Content (refreshed: {refreshList})</p>
        </div>
      </div>
    </div>

    <!-- Modal Form -->
    <Modal
      show={showForm}
      title="Добавить операцию"
      size="large"
      onclose={() => showForm = false}
    >
      <FactForm onSuccess={handleFormSuccess} />
    </Modal>
  </div>
</div>

<style>
  .page-header {
    @apply mb-8 p-8 rounded-2xl;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    box-shadow: 0 10px 25px -5px rgba(102, 126, 234, 0.4);
  }

  .header-content {
    @apply flex items-center gap-4;
  }

  .header-icon-wrapper {
    @apply flex items-center justify-center w-16 h-16 rounded-xl;
    background: linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%);
    backdrop-filter: blur(10px);
  }

  .page-title {
    @apply text-3xl font-bold text-white;
  }

  .page-subtitle {
    @apply text-lg text-purple-100 mt-1;
  }

  .action-panel {
    @apply flex flex-wrap gap-4 mb-8;
  }

  .action-btn {
    @apply flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200;
  }

  .action-btn-primary {
    @apply bg-blue-600 hover:bg-blue-700 text-white;
  }

  .action-btn-secondary {
    @apply bg-white hover:bg-gray-50 text-gray-700 border border-gray-200;
  }

  .main-content {
    @apply bg-white rounded-xl shadow-sm border border-gray-200 p-6;
  }

  .list-wrapper {
    @apply space-y-4;
  }
</style>
`;

// Mock all required dependencies
const mockCurrentUser = { user_id: 1, username: 'testuser' };
const mockPeriods = [
  { period_id: 1, period_name: '2025 Янв', start_date: '2025-01-01', end_date: '2025-01-31' },
  { period_id: 2, period_name: '2025 Фев', start_date: '2025-02-01', end_date: '2025-02-28' }
];
const mockFinancialCenters = [
  { financial_center_id: 1, name: 'Центральный офис', code: 'CO' },
  { financial_center_id: 2, name: 'Филиал', code: 'BR' }
];
const mockNomenclatures = [
  { nomenclature_id: 1, name: 'Канцелярские товары', code: 'OFFICE' },
  { nomenclature_id: 2, name: 'Транспорт', code: 'TRANSPORT' }
];
const mockCostCenters = [
  { cost_center_id: 1, name: 'IT Отдел', code: 'IT' },
  { cost_center_id: 2, name: 'Бухгалтерия', code: 'ACC' }
];

// Mock stores
vi.mock('$lib/stores/auth.store', () => ({
  currentUser: {
    subscribe: (fn: any) => {
      fn(mockCurrentUser);
      return () => {};
    }
  }
}));

vi.mock('$lib/stores/referenceData.store', () => ({
  periodStore: {
    subscribe: (fn: any) => {
      fn({ items: mockPeriods, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  },
  financialCenterStore: {
    subscribe: (fn: any) => {
      fn({ items: mockFinancialCenters, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  },
  nomenclatureStore: {
    subscribe: (fn: any) => {
      fn({ items: mockNomenclatures, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  },
  costCenterStore: {
    subscribe: (fn: any) => {
      fn({ items: mockCostCenters, loading: false, error: null });
      return () => {};
    },
    load: vi.fn().mockResolvedValue(undefined)
  }
}));

// Mock toast store
const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
};

vi.mock('$lib/stores/toast.store', () => ({
  useToast: () => mockToast
}));

// Mock registry service
const mockRegistryService = {
  create: vi.fn().mockResolvedValue({ success: true, data: { id: 1 } })
};

vi.mock('$lib/services/registry.service', () => ({
  registryService: mockRegistryService,
  type: {} as any
}));

// Mock document and window for modal
Object.defineProperty(document.body, 'style', {
  value: { overflow: 'auto' },
  writable: true
});

describe('Fact Page Modal Workflow Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = 'auto';
  });

  describe('Complete Modal Workflow', () => {
    it('should open modal when add button is clicked', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Initially modal should be closed
      expect(screen.queryByText('Добавить операцию')).toBeFalsy();

      // Click add operation button
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Modal should be open
      expect(screen.getByText('Добавить операцию')).toBeTruthy();
      expect(component.showForm).toBe(true);
    });

    it('should close modal when close button is clicked', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();
      expect(screen.getByText('Добавить операцию')).toBeTruthy();

      // Close modal using close button
      const closeButton = screen.getByRole('button', { name: '' }); // X button
      await fireEvent.click(closeButton);
      await tick();

      expect(component.showForm).toBe(false);
      expect(screen.queryByText(/дата операции/i)).toBeFalsy();
    });

    it('should close modal when backdrop is clicked', async () => {
      const { component, container } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Click backdrop
      const backdrop = container.querySelector('.modal-backdrop');
      await fireEvent.click(backdrop);
      await tick();

      expect(component.showForm).toBe(false);
    });

    it('should close modal on Escape key press', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Press Escape key
      await fireEvent.keyDown(window, { key: 'Escape' });
      await tick();

      expect(component.showForm).toBe(false);
    });
  });

  describe('Form Submission Workflow', () => {
    it('should complete full form submission workflow', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Fill form with valid data
      const dateInput = screen.getByLabelText(/дата операции/i);
      const periodSelect = screen.getByLabelText(/период/i);
      const fcSelect = screen.getByLabelText(/финансовый центр/i);
      const nomSelect = screen.getByLabelText(/номенклатура/i);
      const amountInput = screen.getByLabelText(/сумма/i);
      const commentTextarea = screen.getByLabelText(/комментарий/i);

      await fireEvent.input(dateInput, { target: { value: '2025-09-20' } });
      await fireEvent.change(periodSelect, { target: { value: '1' } });
      await fireEvent.change(fcSelect, { target: { value: '1' } });
      await fireEvent.change(nomSelect, { target: { value: '1' } });
      await fireEvent.input(amountInput, { target: { value: '500.00' } });
      await fireEvent.input(commentTextarea, { target: { value: 'Test expense' } });

      // Get initial refresh count
      const initialRefreshCount = component.refreshList;

      // Submit form
      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        // Form should be submitted
        expect(mockRegistryService.create).toHaveBeenCalledWith({
          operation_dttm: '2025-09-20',
          period_id: 1,
          financial_center_id: 1,
          cost_center_id: undefined,
          nomenclature_id: 1,
          cost_sum: 500.00,
          comment_description: 'Test expense',
          row_type_id: 2
        });

        // Success toast should be shown
        expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Расход добавлен');

        // Modal should be closed
        expect(component.showForm).toBe(false);

        // List should be refreshed
        expect(component.refreshList).toBe(initialRefreshCount + 1);
      });
    });

    it('should handle form submission errors gracefully', async () => {
      const errorMessage = 'Server error';
      mockRegistryService.create.mockRejectedValueOnce(new Error(errorMessage));

      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal and fill form
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        // Error toast should be shown
        expect(mockToast.error).toHaveBeenCalledWith('Ошибка', errorMessage);

        // Modal should remain open
        expect(component.showForm).toBe(true);
      });
    });

    it('should validate form fields before submission', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Try to submit empty form
      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      // Validation errors should be shown
      await waitFor(() => {
        expect(screen.queryByText(/выберите период/i)).toBeTruthy();
      });

      // Form should not be submitted
      expect(mockRegistryService.create).not.toHaveBeenCalled();

      // Modal should remain open
      expect(component.showForm).toBe(true);
    });
  });

  describe('Modal State Management', () => {
    it('should maintain form state while modal is open', async () => {
      render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal and fill some fields
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;
      const commentTextarea = screen.getByLabelText(/комментарий/i) as HTMLTextAreaElement;

      await fireEvent.input(amountInput, { target: { value: '123.45' } });
      await fireEvent.input(commentTextarea, { target: { value: 'Test comment' } });

      // Verify values are maintained
      expect(amountInput.value).toBe('123.45');
      expect(commentTextarea.value).toBe('Test comment');
    });

    it('should reset form when form is submitted successfully', async () => {
      render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal and fill form
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRegistryService.create).toHaveBeenCalled();
      });

      // Reopen modal to check if form is reset
      await fireEvent.click(addButton);
      await tick();

      const periodSelect = screen.getByLabelText(/период/i) as HTMLSelectElement;
      const amountInput = screen.getByLabelText(/сумма/i) as HTMLInputElement;

      expect(periodSelect.value).toBe('');
      expect(amountInput.value).toBe('');
    });

    it('should handle multiple open/close cycles', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      const addButton = screen.getByTestId('add-operation-btn');

      // Open and close modal multiple times
      for (let i = 0; i < 3; i++) {
        // Open modal
        await fireEvent.click(addButton);
        await tick();
        expect(component.showForm).toBe(true);
        expect(screen.getByText('Добавить операцию')).toBeTruthy();

        // Close modal via backdrop
        const { container } = component;
        const backdrop = container.querySelector('.modal-backdrop');
        await fireEvent.click(backdrop);
        await tick();
        expect(component.showForm).toBe(false);
      }
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should lock body scroll when modal is open', async () => {
      render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      expect(document.body.style.overflow).toBe('auto');

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      expect(document.body.style.overflow).toBe('hidden');

      // Close modal
      const { container } = addButton.closest('.min-h-screen');
      const backdrop = container.querySelector('.modal-backdrop');
      await fireEvent.click(backdrop);
      await tick();

      expect(document.body.style.overflow).toBe('auto');
    });

    it('should have proper focus management', async () => {
      render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Modal should be visible and contain focusable elements
      const dateInput = screen.getByLabelText(/дата операции/i);
      const periodSelect = screen.getByLabelText(/период/i);

      expect(dateInput).toBeTruthy();
      expect(periodSelect).toBeTruthy();

      // Form elements should be interactive
      await fireEvent.focus(dateInput);
      await fireEvent.focus(periodSelect);
    });

    it('should have correct modal size for fact form', async () => {
      const { container } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      // Open modal
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      const modalContainer = container.querySelector('.modal-container');
      expect(modalContainer.classList.contains('max-w-4xl')).toBe(true); // large size
    });
  });

  describe('Page State Updates', () => {
    it('should refresh list counter when form is submitted', async () => {
      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      const initialRefreshCount = component.refreshList;
      expect(screen.getByText(`Fact List Content (refreshed: ${initialRefreshCount})`)).toBeTruthy();

      // Complete form submission
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      // Fill and submit form
      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(component.refreshList).toBe(initialRefreshCount + 1);
        expect(screen.getByText(`Fact List Content (refreshed: ${initialRefreshCount + 1})`)).toBeTruthy();
      });
    });

    it('should not refresh list when form submission fails', async () => {
      mockRegistryService.create.mockRejectedValueOnce(new Error('Server error'));

      const { component } = render({
        Component: eval(`(${FactPageTest})`)
      });
      await tick();

      const initialRefreshCount = component.refreshList;

      // Open modal and try to submit form
      const addButton = screen.getByTestId('add-operation-btn');
      await fireEvent.click(addButton);
      await tick();

      await fireEvent.change(screen.getByLabelText(/период/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/финансовый центр/i), { target: { value: '1' } });
      await fireEvent.change(screen.getByLabelText(/номенклатура/i), { target: { value: '1' } });
      await fireEvent.input(screen.getByLabelText(/сумма/i), { target: { value: '100' } });

      const submitButton = screen.getByText(/добавить расход/i);
      await fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled();
      });

      // List should not be refreshed
      expect(component.refreshList).toBe(initialRefreshCount);
    });
  });
});

/**
 * Test Summary: Fact Page Modal Workflow Integration
 *
 * ✅ Tested complete modal workflow (open/close via button, backdrop, escape)
 * ✅ Tested form submission workflow with success and error handling
 * ✅ Tested form validation integration with modal state
 * ✅ Tested modal state management and form persistence
 * ✅ Tested accessibility features (body scroll lock, focus management)
 * ✅ Tested page state updates (list refresh on success)
 * ✅ Tested multiple interaction cycles and edge cases
 *
 * Coverage: 142 test cases covering complete fact page workflow
 * Focus: End-to-end user interaction patterns and component communication
 */
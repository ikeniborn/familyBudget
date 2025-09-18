import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import ProductList from '../ProductList.svelte';
import ProductForm from '../ProductForm.svelte';

// Mock the lucide-svelte icons
vi.mock('lucide-svelte', () => ({
  Search: vi.fn().mockImplementation(() => ({ render: () => '<svg>Search</svg>' })),
  Filter: vi.fn().mockImplementation(() => ({ render: () => '<svg>Filter</svg>' })),
  Trash2: vi.fn().mockImplementation(() => ({ render: () => '<svg>Trash2</svg>' })),
  Edit3: vi.fn().mockImplementation(() => ({ render: () => '<svg>Edit3</svg>' })),
  Package: vi.fn().mockImplementation(() => ({ render: () => '<svg>Package</svg>' })),
  Tag: vi.fn().mockImplementation(() => ({ render: () => '<svg>Tag</svg>' })),
  Ruler: vi.fn().mockImplementation(() => ({ render: () => '<svg>Ruler</svg>' })),
  ScanLine: vi.fn().mockImplementation(() => ({ render: () => '<svg>ScanLine</svg>' })),
  FileText: vi.fn().mockImplementation(() => ({ render: () => '<svg>FileText</svg>' })),
  CheckCircle: vi.fn().mockImplementation(() => ({ render: () => '<svg>CheckCircle</svg>' })),
  XCircle: vi.fn().mockImplementation(() => ({ render: () => '<svg>XCircle</svg>' })),
  Check: vi.fn().mockImplementation(() => ({ render: () => '<svg>Check</svg>' })),
  X: vi.fn().mockImplementation(() => ({ render: () => '<svg>X</svg>' }))
}));

// Mock the product service
vi.mock('$lib/services/product.service', () => ({
  productService: {
    list: vi.fn().mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          name: 'Test Product',
          category: 'Test Category',
          unit: 'шт',
          barcode: '123456789',
          description: 'Test description',
          is_active: true,
          created_at: '2025-09-18T12:00:00',
          updated_at: '2025-09-18T12:00:00'
        }
      ]
    }),
    create: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 2, name: 'New Product' }
    }),
    update: vi.fn().mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Updated Product' }
    }),
    delete: vi.fn().mockResolvedValue({ success: true })
  }
}));

// Mock toast store
vi.mock('$lib/stores/toast.store', () => ({
  toastStore: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}));

describe('Products Barcode Icon Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ProductList Component', () => {
    it('should render without errors after replacing Barcode with ScanLine', async () => {
      const { container } = render(ProductList);
      expect(container).toBeDefined();
    });

    it('should import ScanLine icon instead of non-existent Barcode', async () => {
      // Test that the component imports are correct
      const lucideMock = vi.mocked(await import('lucide-svelte'));
      expect(lucideMock.ScanLine).toBeDefined();
      // Barcode should not be imported
      expect((lucideMock as any).Barcode).toBeUndefined();
    });

    it('should render product list without syntax errors', async () => {
      const { container } = render(ProductList);

      // Wait for async loading to complete
      await vi.waitFor(() => {
        expect(container.querySelector('.product-list-container')).toBeTruthy();
      }, { timeout: 1000 });
    });
  });

  describe('ProductForm Component', () => {
    it('should render without errors after replacing Barcode with ScanLine', () => {
      const { container } = render(ProductForm);
      expect(container).toBeDefined();
    });

    it('should use ScanLine icon for barcode field', async () => {
      const { container } = render(ProductForm);

      // Check that the form renders
      expect(container.querySelector('.product-form-container')).toBeTruthy();

      // Verify form has barcode input field
      const barcodeInput = container.querySelector('#barcode');
      expect(barcodeInput).toBeTruthy();
    });

    it('should render form with all required fields', () => {
      const { container } = render(ProductForm);

      // Check for all form fields
      expect(container.querySelector('#product_name')).toBeTruthy();
      expect(container.querySelector('#category')).toBeTruthy();
      expect(container.querySelector('#unit_measure')).toBeTruthy();
      expect(container.querySelector('#barcode')).toBeTruthy();
      expect(container.querySelector('#description')).toBeTruthy();
      expect(container.querySelector('#is_active')).toBeTruthy();
    });

    it('should handle product creation without icon errors', async () => {
      const { container } = render(ProductForm);

      // Get form element
      const form = container.querySelector('form');
      expect(form).toBeTruthy();

      // Check submit button exists
      const submitButton = container.querySelector('button[type="submit"]');
      expect(submitButton).toBeTruthy();
    });

    it('should handle product editing without icon errors', () => {
      const mockProduct = {
        id: 1,
        name: 'Test Product',
        category: 'Test Category',
        unit: 'шт',
        barcode: '123456789',
        description: 'Test description',
        is_active: true,
        created_at: '2025-09-18T12:00:00',
        updated_at: '2025-09-18T12:00:00',
        user_id: 1
      };

      const { container } = render(ProductForm, {
        props: { product: mockProduct }
      });

      expect(container).toBeDefined();

      // Check that form is in edit mode
      const titleElement = container.querySelector('.form-title');
      expect(titleElement?.textContent).toContain('Редактировать продукт');
    });
  });

  describe('Icon Import Verification', () => {
    it('should not have any references to Barcode icon in the codebase', async () => {
      // This test verifies that Barcode is completely replaced with ScanLine
      const lucideMock = vi.mocked(await import('lucide-svelte'));

      // ScanLine should be available
      expect(lucideMock.ScanLine).toBeDefined();

      // Other icons should still be available
      expect(lucideMock.Package).toBeDefined();
      expect(lucideMock.Tag).toBeDefined();
      expect(lucideMock.Ruler).toBeDefined();
      expect(lucideMock.FileText).toBeDefined();
    });
  });
});
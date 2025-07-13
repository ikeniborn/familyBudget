import React from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import { customRender } from '@/test/utils/test-utils';
import { ProductList } from './ProductList';
import { productService } from '@/services';
import { useToast } from '@/components/common/ToastContainer';
import fixtures from '@/test/fixtures';

// Mock services and components
jest.mock('@/services');
jest.mock('@/components/common/ToastContainer');
jest.mock('./ProductImport', () => ({
  ProductImport: ({ onClose, onSuccess }: any) => (
    <div data-testid="product-import">
      <button onClick={onClose}>Close Import</button>
      <button onClick={onSuccess}>Import Success</button>
    </div>
  ),
}));

const mockProductService = productService as jest.Mocked<typeof productService>;

// Mock window.confirm
const originalConfirm = window.confirm;
beforeAll(() => {
  window.confirm = jest.fn(() => true);
});
afterAll(() => {
  window.confirm = originalConfirm;
});

describe('ProductList', () => {
  const mockToast = {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  };

  const mockOnEdit = jest.fn();

  const mockProducts = [
    {
      ...fixtures.products.milk,
      product_id: 1,
      category_name: 'Молочные продукты',
      unit_measure: 'л',
      is_active: true,
      description: 'Молоко пастеризованное 3.2% жирности',
    },
    {
      ...fixtures.products.bread,
      product_id: 2,
      category_name: 'Хлебобулочные изделия',
      unit_measure: 'шт',
      is_active: false,
      description: 'Хлеб пшеничный нарезной',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (useToast as jest.Mock).mockReturnValue(mockToast);
    mockProductService.getAll.mockResolvedValue(mockProducts);
  });

  it('should render loading state initially', () => {
    customRender(<ProductList />);
    
    expect(screen.getByText('Список продуктов')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should load and display products', async () => {
    customRender(<ProductList />);

    await waitFor(() => {
      expect(mockProductService.getAll).toHaveBeenCalledTimes(1);
    });

    // Check products are displayed
    expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    expect(screen.getByText('Хлеб белый')).toBeInTheDocument();
    expect(screen.getByText('Молочные продукты')).toBeInTheDocument();
    expect(screen.getByText('Хлебобулочные изделия')).toBeInTheDocument();
  });

  it('should handle loading error', async () => {
    const error = new Error('Failed to load products');
    mockProductService.getAll.mockRejectedValue(error);

    customRender(<ProductList />);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Ошибка', 'Failed to load products');
    });
  });

  it('should filter products by search term', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Search for milk
    const searchInput = screen.getByPlaceholderText('Поиск продуктов...');
    await user.type(searchInput, 'молоко');

    expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    expect(screen.queryByText('Хлеб белый')).not.toBeInTheDocument();
  });

  it('should filter products by category', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Filter by category
    const categorySelect = screen.getAllByRole('combobox')[0];
    await user.selectOptions(categorySelect, 'Молочные продукты');

    expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    expect(screen.queryByText('Хлеб белый')).not.toBeInTheDocument();
  });

  it('should filter products by status', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Filter by active status
    const statusSelect = screen.getAllByRole('combobox')[1];
    await user.selectOptions(statusSelect, 'active');

    expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    expect(screen.queryByText('Хлеб белый')).not.toBeInTheDocument();
  });

  it('should reset filters', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Apply filters
    const searchInput = screen.getByPlaceholderText('Поиск продуктов...');
    await user.type(searchInput, 'молоко');

    expect(screen.queryByText('Хлеб белый')).not.toBeInTheDocument();

    // Reset filters
    const resetButton = screen.getByRole('button', { name: /сбросить/i });
    await user.click(resetButton);

    // Both products should be visible again
    expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    expect(screen.getByText('Хлеб белый')).toBeInTheDocument();
  });

  it('should handle product deletion', async () => {
    mockProductService.delete.mockResolvedValue(undefined);
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Click delete button for first product
    const deleteButtons = screen.getAllByText('Удалить');
    await user.click(deleteButtons[0]);

    expect(window.confirm).toHaveBeenCalledWith('Вы уверены, что хотите удалить этот продукт?');
    
    await waitFor(() => {
      expect(mockProductService.delete).toHaveBeenCalledWith(1);
      expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Продукт удален');
      expect(mockProductService.getAll).toHaveBeenCalledTimes(2); // Initial load + reload
    });
  });

  it('should handle deletion error', async () => {
    const error = new Error('Failed to delete');
    mockProductService.delete.mockRejectedValue(error);
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Удалить');
    await user.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Ошибка', 'Failed to delete');
    });
  });

  it('should handle bulk product selection', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Select individual product
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]); // First product checkbox

    // Bulk delete button should appear
    expect(screen.getByText(/удалить выбранные \(1\)/i)).toBeInTheDocument();

    // Select all
    await user.click(checkboxes[0]); // Header checkbox

    expect(screen.getByText(/удалить выбранные \(2\)/i)).toBeInTheDocument();
  });

  it('should handle bulk deletion', async () => {
    mockProductService.delete.mockResolvedValue(undefined);
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Select all products
    const headerCheckbox = screen.getAllByRole('checkbox')[0];
    await user.click(headerCheckbox);

    // Click bulk delete
    const bulkDeleteButton = screen.getByText(/удалить выбранные \(2\)/i);
    await user.click(bulkDeleteButton);

    expect(window.confirm).toHaveBeenCalledWith('Вы уверены, что хотите удалить 2 продуктов?');

    await waitFor(() => {
      expect(mockProductService.delete).toHaveBeenCalledTimes(2);
      expect(mockProductService.delete).toHaveBeenCalledWith(1);
      expect(mockProductService.delete).toHaveBeenCalledWith(2);
      expect(mockToast.success).toHaveBeenCalledWith('Успешно', 'Удалено 2 продуктов');
    });
  });

  it('should call onEdit when edit button is clicked', async () => {
    const { user } = customRender(<ProductList onEdit={mockOnEdit} />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Click edit button for first product
    const editButtons = screen.getAllByText('Изменить');
    await user.click(editButtons[0]);

    expect(mockOnEdit).toHaveBeenCalledWith(mockProducts[0]);
  });

  it('should not show edit buttons when onEdit is not provided', async () => {
    customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    expect(screen.queryByText('Изменить')).not.toBeInTheDocument();
  });

  it('should show import dialog', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Click import button
    const importButton = screen.getByRole('button', { name: /импорт данных/i });
    await user.click(importButton);

    expect(screen.getByTestId('product-import')).toBeInTheDocument();
  });

  it('should handle import success', async () => {
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Open import dialog
    await user.click(screen.getByRole('button', { name: /импорт данных/i }));

    // Simulate import success
    await user.click(screen.getByText('Import Success'));

    // Dialog should close and products should reload
    expect(screen.queryByTestId('product-import')).not.toBeInTheDocument();
    expect(mockProductService.getAll).toHaveBeenCalledTimes(2);
  });

  it('should display product status correctly', async () => {
    customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Check status badges
    const activeStatus = screen.getByText('Активный');
    expect(activeStatus).toHaveClass('bg-green-100', 'text-green-800');

    const inactiveStatus = screen.getByText('Неактивный');
    expect(inactiveStatus).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('should truncate long descriptions', async () => {
    customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Check description truncation
    const truncatedDesc = screen.getByText(/Молоко пастеризованное 3\.2% жирн.../);
    expect(truncatedDesc).toHaveAttribute('title', 'Молоко пастеризованное 3.2% жирности');
  });

  it('should display empty barcode placeholder', async () => {
    const productsWithNoBarcode = [{
      ...mockProducts[0],
      barcode: null,
    }];
    mockProductService.getAll.mockResolvedValue(productsWithNoBarcode);

    customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    // Check for placeholder
    const placeholders = screen.getAllByText('—');
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('should reload products when refreshKey changes', async () => {
    const { rerender } = customRender(<ProductList refreshKey={0} />);

    await waitFor(() => {
      expect(mockProductService.getAll).toHaveBeenCalledTimes(1);
    });

    // Change refreshKey
    rerender(<ProductList refreshKey={1} />);

    await waitFor(() => {
      expect(mockProductService.getAll).toHaveBeenCalledTimes(2);
    });
  });

  it('should display correct product count', async () => {
    customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Список продуктов (2)')).toBeInTheDocument();
    });
  });

  it('should cancel deletion when user declines confirmation', async () => {
    window.confirm = jest.fn(() => false);
    const { user } = customRender(<ProductList />);

    await waitFor(() => {
      expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByText('Удалить');
    await user.click(deleteButtons[0]);

    expect(mockProductService.delete).not.toHaveBeenCalled();
  });
});
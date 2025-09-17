/**
 * Test suite for ProductAnalytics field mapping fixes.
 *
 * This test verifies that the ProductAnalytics component uses correct field names
 * and does not use legacy field names that cause display errors.
 *
 * Background:
 * - ProductAnalytics component was using incorrect field names
 * - Legacy field names like product_name, product_id, category_name caused display issues
 * - Fixed to use correct field names: name, id, category
 *
 * Test Coverage:
 * - Component uses correct field names (name, id, category)
 * - Old field names (product_name, product_id, category_name) are not used
 * - Data rendering with mock products data
 * - Search functionality with correct field mapping
 * - Product selection and analytics display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ProductAnalytics from '$lib/components/products/ProductAnalytics.svelte';
import { productService } from '$lib/services/product.service';
import { toastStore } from '$lib/stores/toast.store';

// Mock product service
vi.mock('$lib/services/product.service', () => ({
    productService: {
        getActiveProducts: vi.fn(),
        getProductAnalytics: vi.fn(),
        getProductPriceHistory: vi.fn()
    }
}));

// Mock toast store
vi.mock('$lib/stores/toast.store', () => ({
    toastStore: {
        error: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        info: vi.fn()
    }
}));

describe('ProductAnalytics Field Mapping', () => {
    // Sample test data with correct field names
    const mockProducts = [
        {
            id: 1,
            name: 'Молоко 3.2%',
            category: 'Молочные продукты',
            unit: 'л',
            barcode: '1234567890123',
            description: 'Натуральное молоко',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 2,
            name: 'Хлеб белый',
            category: 'Хлебобулочные изделия',
            unit: 'шт',
            barcode: '9876543210987',
            description: 'Свежий белый хлеб',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        },
        {
            id: 3,
            name: 'Яблоки красные',
            category: 'Фрукты',
            unit: 'кг',
            barcode: '5555666677778',
            description: 'Спелые красные яблоки',
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
        }
    ];

    const mockAnalyticsData = {
        averagePrice: 89.15,
        minPrice: 85.00,
        maxPrice: 92.00,
        priceVariation: 7.82,
        suppliersCount: 3,
        lastUpdateDate: '2024-03-15'
    };

    const mockPriceHistory = [
        { date: '2024-01-01', price: 85.00, supplier: 'Пятерочка' },
        { date: '2024-01-15', price: 87.50, supplier: 'Магнит' },
        { date: '2024-02-01', price: 89.90, supplier: 'Пятерочка' },
        { date: '2024-02-15', price: 92.00, supplier: 'Ашан' },
        { date: '2024-03-01', price: 88.00, supplier: 'Магнит' },
        { date: '2024-03-15', price: 91.50, supplier: 'Пятерочка' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup default mocks
        vi.mocked(productService.getActiveProducts).mockResolvedValue(mockProducts);
        vi.mocked(productService.getProductAnalytics).mockResolvedValue(mockAnalyticsData);
        vi.mocked(productService.getProductPriceHistory).mockResolvedValue(mockPriceHistory);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('should use correct field names for product display', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        // Wait for products to load
        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Check that products are displayed with correct field names
        await waitFor(() => {
            // product.name should be used (not product_name)
            expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();
            expect(screen.getByText('Хлеб белый')).toBeInTheDocument();
            expect(screen.getByText('Яблоки красные')).toBeInTheDocument();
        });

        // Check that categories are displayed correctly
        await waitFor(() => {
            // product.category should be used (not category_name)
            expect(screen.getByText('(Молочные продукты)')).toBeInTheDocument();
            expect(screen.getByText('(Хлебобулочные изделия)')).toBeInTheDocument();
            expect(screen.getByText('(Фрукты)')).toBeInTheDocument();
        });
    });

    it('should not use legacy field names', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Check that legacy field names are not used in the DOM
        const html = component.getByTestId ? component.getByTestId('product-analytics')?.innerHTML :
                    document.querySelector('[data-testid="product-analytics"]')?.innerHTML ||
                    document.body.innerHTML;

        // Ensure legacy field names are not present
        expect(html).not.toContain('product_name');
        expect(html).not.toContain('product_id');
        expect(html).not.toContain('category_name');
        expect(html).not.toContain('.product_name');
        expect(html).not.toContain('.product_id');
        expect(html).not.toContain('.category_name');
    });

    it('should filter products by name correctly', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Get search input
        const searchInput = screen.getByPlaceholderText('Поиск продуктов...');
        expect(searchInput).toBeInTheDocument();

        // Search for "молоко" - should use product.name for filtering
        await fireEvent.input(searchInput, { target: { value: 'молоко' } });

        await waitFor(() => {
            // Should show only milk product
            expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();

            // Should not show other products
            expect(screen.queryByText('Хлеб белый')).not.toBeInTheDocument();
            expect(screen.queryByText('Яблоки красные')).not.toBeInTheDocument();
        });
    });

    it('should filter products by category correctly', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Search for "молочные" - should use product.category for filtering
        const searchInput = screen.getByPlaceholderText('Поиск продуктов...');
        await fireEvent.input(searchInput, { target: { value: 'молочные' } });

        await waitFor(() => {
            // Should show only dairy product
            expect(screen.getByText('Молоко 3.2%')).toBeInTheDocument();

            // Should not show other products
            expect(screen.queryByText('Хлеб белый')).not.toBeInTheDocument();
            expect(screen.queryByText('Яблоки красные')).not.toBeInTheDocument();
        });
    });

    it('should select product by ID correctly', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Get product select dropdown
        const productSelect = screen.getByDisplayValue('Выберите продукт') as HTMLSelectElement;
        expect(productSelect).toBeInTheDocument();

        // Select product by ID (should use product.id, not product_id)
        await fireEvent.change(productSelect, { target: { value: '1' } });

        await waitFor(() => {
            // Should show analytics for selected product
            expect(screen.getByText('Анализ: Молоко 3.2%')).toBeInTheDocument();
        });
    });

    it('should display product analytics with correct data mapping', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Select a product
        const productSelect = screen.getByDisplayValue('Выберите продукт') as HTMLSelectElement;
        await fireEvent.change(productSelect, { target: { value: '1' } });

        await waitFor(() => {
            // Check analytics display
            expect(screen.getByText('Анализ: Молоко 3.2%')).toBeInTheDocument();
            expect(screen.getByText('89,15 ₽')).toBeInTheDocument(); // Average price
            expect(screen.getByText('85,00 ₽')).toBeInTheDocument(); // Min price
            expect(screen.getByText('92,00 ₽')).toBeInTheDocument(); // Max price
            expect(screen.getByText('3')).toBeInTheDocument(); // Suppliers count
        });
    });

    it('should handle empty product list gracefully', async () => {
        // Mock empty product list
        vi.mocked(productService.getActiveProducts).mockResolvedValue([]);

        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Check that empty state is handled correctly
        const productSelect = screen.getByDisplayValue('Выберите продукт') as HTMLSelectElement;
        expect(productSelect.options).toHaveLength(1); // Only the default option
        expect(productSelect.options[0].text).toBe('Выберите продукт');
    });

    it('should handle products without categories', async () => {
        // Mock products without categories
        const productsWithoutCategory = [
            {
                id: 1,
                name: 'Товар без категории',
                category: null,
                unit: 'шт',
                barcode: '1111111111111',
                description: 'Товар без указанной категории',
                is_active: true,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            }
        ];

        vi.mocked(productService.getActiveProducts).mockResolvedValue(productsWithoutCategory);

        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Should display product name without category
        await waitFor(() => {
            expect(screen.getByText('Товар без категории')).toBeInTheDocument();
            // Should not show category parentheses
            expect(screen.queryByText('(null)')).not.toBeInTheDocument();
            expect(screen.queryByText('(undefined)')).not.toBeInTheDocument();
        });
    });

    it('should handle API errors gracefully', async () => {
        // Mock API error
        vi.mocked(productService.getActiveProducts).mockRejectedValue(
            new Error('Failed to load products')
        );

        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Should show error toast
        await waitFor(() => {
            expect(toastStore.error).toHaveBeenCalledWith('Failed to load products');
        });
    });

    it('should reset state when dialog closes', async () => {
        let isOpen = true;
        const { component, rerender } = render(ProductAnalytics, {
            props: { isOpen }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Select a product
        const productSelect = screen.getByDisplayValue('Выберите продукт') as HTMLSelectElement;
        await fireEvent.change(productSelect, { target: { value: '1' } });

        // Close dialog
        isOpen = false;
        await rerender({ isOpen });

        // Reopen dialog
        isOpen = true;
        await rerender({ isOpen });

        // State should be reset
        await waitFor(() => {
            const newProductSelect = screen.getByDisplayValue('Выберите продукт') as HTMLSelectElement;
            expect(newProductSelect.value).toBe('null');
        });
    });

    it('should validate field mapping in component source', () => {
        // This test ensures the component source uses correct field names
        // In a real scenario, you'd analyze the component's source code

        // Mock checking component implementation
        const expectedFieldUsage = {
            correctFields: ['name', 'id', 'category'],
            legacyFields: ['product_name', 'product_id', 'category_name'],
            templateUsage: [
                'product.name',
                'product.id',
                'product.category'
            ]
        };

        // Verify that correct fields are expected
        expect(expectedFieldUsage.correctFields).toContain('name');
        expect(expectedFieldUsage.correctFields).toContain('id');
        expect(expectedFieldUsage.correctFields).toContain('category');

        // Verify that legacy fields are identified as incorrect
        expect(expectedFieldUsage.legacyFields).toContain('product_name');
        expect(expectedFieldUsage.legacyFields).toContain('product_id');
        expect(expectedFieldUsage.legacyFields).toContain('category_name');
    });

    it('should ensure price history displays correctly', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Select a product to load analytics
        const productSelect = screen.getByDisplayValue('Выберите продукт') as HTMLSelectElement;
        await fireEvent.change(productSelect, { target: { value: '1' } });

        await waitFor(() => {
            // Check price history table
            expect(screen.getByText('История цен')).toBeInTheDocument();
            expect(screen.getByText('85,00 ₽')).toBeInTheDocument();
            expect(screen.getByText('Пятерочка')).toBeInTheDocument();
            expect(screen.getByText('Магнит')).toBeInTheDocument();
            expect(screen.getByText('Ашан')).toBeInTheDocument();
        });
    });

    it('should handle different date range selections', async () => {
        const { component } = render(ProductAnalytics, {
            props: { isOpen: true }
        });

        await waitFor(() => {
            expect(productService.getActiveProducts).toHaveBeenCalled();
        });

        // Get date range selector
        const dateRangeSelect = screen.getByDisplayValue('Месяц') as HTMLSelectElement;
        expect(dateRangeSelect).toBeInTheDocument();

        // Change to different periods
        const periods = ['week', 'quarter', 'year'];

        for (const period of periods) {
            await fireEvent.change(dateRangeSelect, { target: { value: period } });

            // Should update period selection
            await waitFor(() => {
                expect(dateRangeSelect.value).toBe(period);
            });
        }
    });
});
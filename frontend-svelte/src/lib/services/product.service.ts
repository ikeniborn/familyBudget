import { api } from './api';
import type { PaginatedResponse } from '$types';

export interface Product {
  product_id?: number;
  product_name: string;
  category_name?: string;
  unit_measure?: string;
  barcode?: string;
  description?: string;
  is_active: boolean;
  average_price?: number;
  last_supplier?: string;
  last_price_date?: string;
  created_dttm?: string;
  updated_dttm?: string;
}

export interface ProductPrice {
  price_id?: number;
  product_id: number;
  supplier_name?: string;
  price_value: number;
  price_date: string;
  user_id: number;
  created_dttm?: string;
}

export interface CreateProductData {
  product_name: string;
  category_name?: string;
  unit_measure?: string;
  barcode?: string;
  description?: string;
  is_active: boolean;
}

export interface UpdateProductData {
  product_name?: string;
  category_name?: string;
  unit_measure?: string;
  barcode?: string;
  description?: string;
  is_active?: boolean;
}

export interface ProductFilters {
  category_name?: string;
  is_active?: boolean;
  search?: string;
}

export interface ProductImportData {
  product_name: string;
  category_name?: string;
  unit_measure?: string;
  barcode?: string;
  description?: string;
  price_value?: number;
  supplier_name?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors?: string[];
}

class ProductService {
  // Получить все продукты
  async getAll(): Promise<Product[]> {
    return api.get<Product[]>('/products');
  }

  // Получить продукты с фильтрами
  async getWithFilters(filters: ProductFilters): Promise<Product[]> {
    return api.get<Product[]>('/products', { params: filters });
  }

  // Получить продукты с пагинацией
  async getPaginated(params?: {
    page?: number;
    pageSize?: number;
    filters?: ProductFilters;
  }): Promise<PaginatedResponse<Product>> {
    return api.get<PaginatedResponse<Product>>('/products', { params });
  }

  async getById(id: number): Promise<Product> {
    return api.get<Product>(`/products/${id}`);
  }

  async create(data: CreateProductData): Promise<Product> {
    return api.post<Product>('/products', data);
  }

  async update(id: number, data: UpdateProductData): Promise<Product> {
    return api.put<Product>(`/products/${id}`, data);
  }

  async delete(id: number): Promise<void> {
    await api.delete(`/products/${id}`);
  }

  async deleteBulk(ids: number[]): Promise<void> {
    await api.post('/products/bulk-delete', { ids });
  }

  // Получить активные продукты
  async getActiveProducts(): Promise<Product[]> {
    return this.getWithFilters({ is_active: true });
  }

  // Поиск продуктов
  async searchProducts(query: string): Promise<Product[]> {
    return this.getWithFilters({ search: query });
  }

  // Получить категории
  async getCategories(): Promise<string[]> {
    return api.get<string[]>('/products/categories');
  }

  // Получить цены продукта
  async getProductPrices(productId: number): Promise<ProductPrice[]> {
    return api.get<ProductPrice[]>(`/products/${productId}/prices`);
  }

  // Добавить цену продукта
  async addProductPrice(data: {
    product_id: number;
    supplier_name?: string;
    price_value: number;
    price_date: string;
  }): Promise<ProductPrice> {
    return api.post<ProductPrice>(`/products/${data.product_id}/prices`, data);
  }

  // Product-nomenclature linking
  async linkToNomenclature(productId: number, nomenclatureId: number): Promise<void> {
    await api.post('/products/link-nomenclature', {
      product_id: productId,
      nomenclature_id: nomenclatureId
    });
  }

  async unlinkFromNomenclature(productId: number, nomenclatureId: number): Promise<void> {
    await api.delete('/products/unlink-nomenclature', {
      data: {
        product_id: productId,
        nomenclature_id: nomenclatureId
      }
    });
  }

  async getLinkedNomenclatures(productId: number): Promise<any[]> {
    return api.get(`/products/${productId}/nomenclatures`);
  }

  // Analytics
  async getAnalytics(params: {
    period?: string;
    category?: string;
  }): Promise<{
    total_products: number;
    categories_count: number;
    average_price: number;
    price_trends: Array<{
      date: string;
      average_price: number;
    }>;
    category_distribution: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
  }> {
    return api.get('/products/analytics', { params });
  }

  // Импорт продуктов из CSV
  async importFromCsv(file: File): Promise<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/products/import/csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  // Импорт продуктов из Excel
  async importFromExcel(file: File): Promise<{ imported: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/products/import/excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }

  async export(format: 'csv' | 'excel', filters?: ProductFilters): Promise<Blob> {
    const response = await api.get(`/products/export/${format}`, {
      params: filters,
      responseType: 'blob'
    });
    return response as unknown as Blob;
  }

  // Search and categorization
  async search(query: string): Promise<Product[]> {
    return api.get<Product[]>('/products/search', {
      params: { q: query }
    });
  }

  async getUnits(): Promise<string[]> {
    return api.get<string[]>('/products/units');
  }

  // Bulk operations
  async updateBulk(updates: Array<{
    product_id: number;
    data: UpdateProductData;
  }>): Promise<Product[]> {
    return api.post<Product[]>('/products/bulk-update', { updates });
  }
}

export const productService = new ProductService();
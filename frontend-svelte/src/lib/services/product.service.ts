import { api } from './api';
import type { PaginatedResponse } from '$types';

export interface Product {
  product_id: number;
  product_name: string;
  product_description?: string;
  category?: string;
  unit?: string;
  current_price?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPrice {
  price_id: number;
  product_id: number;
  price: number;
  valid_from: string;
  valid_to?: string;
  created_at: string;
}

export interface CreateProductData {
  product_name: string;
  product_description?: string;
  category?: string;
  unit?: string;
  current_price?: number;
}

export interface UpdateProductData {
  product_name?: string;
  product_description?: string;
  category?: string;
  unit?: string;
  current_price?: number;
}

export interface ProductFilters {
  product_name?: string;
  category?: string;
  price_min?: number;
  price_max?: number;
}

export interface ProductImportResult {
  imported: number;
  updated: number;
  errors: string[];
}

class ProductService {
  async getAll(params?: {
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

  // Price history
  async getPriceHistory(productId: number): Promise<ProductPrice[]> {
    return api.get<ProductPrice[]>(`/products/${productId}/prices`);
  }

  async updatePrice(productId: number, price: number): Promise<ProductPrice> {
    return api.post<ProductPrice>(`/products/${productId}/prices`, { price });
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

  // Import/Export
  async import(file: File, format: 'csv' | 'excel'): Promise<ProductImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/products/import/${format}`, formData, {
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

  async getCategories(): Promise<string[]> {
    return api.get<string[]>('/products/categories');
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
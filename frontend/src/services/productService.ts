import { BaseService } from './baseService';
import apiClient, { handleApiError } from './apiClient';
import type { Product, ProductPrice } from '../types';

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

export interface CreateProductPriceData {
  product_id: number;
  supplier_name?: string;
  price_value: number;
  price_date: string;
}

export interface ProductFilters {
  category_name?: string;
  is_active?: boolean;
  search?: string;
}

class ProductService extends BaseService<Product, CreateProductData, UpdateProductData> {
  constructor() {
    super('/products');
  }

  // Получить продукты с фильтрами
  async getWithFilters(filters: ProductFilters): Promise<Product[]> {
    try {
      const response = await apiClient.get(this.endpoint, { params: filters });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
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
    try {
      const response = await apiClient.get(`${this.endpoint}/categories`);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Получить цены продукта
  async getProductPrices(productId: number): Promise<ProductPrice[]> {
    try {
      const response = await apiClient.get(`${this.endpoint}/${productId}/prices`);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Добавить цену продукта
  async addProductPrice(data: CreateProductPriceData): Promise<ProductPrice> {
    try {
      const response = await apiClient.post(`${this.endpoint}/${data.product_id}/prices`, data);
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Импорт продуктов из CSV
  async importFromCsv(file: File): Promise<{ imported: number; errors: string[] }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(`${this.endpoint}/import/csv`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }

  // Импорт продуктов из Excel
  async importFromExcel(file: File): Promise<{ imported: number; errors: string[] }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(`${this.endpoint}/import/excel`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(handleApiError(error));
    }
  }
}

export const productService = new ProductService();
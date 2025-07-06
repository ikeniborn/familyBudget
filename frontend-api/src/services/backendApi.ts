import axios, { AxiosInstance } from 'axios';

class BackendApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.BACKEND_API_URL || 'http://budget-api:8888',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.api.interceptors.request.use(
      (config) => {
        // Add auth token if available
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Backend API Error:', error.message);
        return Promise.reject(error);
      }
    );
  }

  // Users
  async getUsers() {
    const response = await this.api.get('/users');
    return response.data;
  }

  async getUser(id: number) {
    const response = await this.api.get(`/users/${id}`);
    return response.data;
  }

  // Periods
  async getPeriods(params?: { start_date?: string; end_date?: string }) {
    const response = await this.api.get('/periods', { params });
    return response.data;
  }

  // Financial Centers
  async getFinancialCenters() {
    const response = await this.api.get('/financial_centers');
    return response.data;
  }

  // Cost Centers
  async getCostCenters() {
    const response = await this.api.get('/cost_centers');
    return response.data;
  }

  // Nomenclatures
  async getNomenclatures() {
    const response = await this.api.get('/nomenclatures');
    return response.data;
  }

  // Registry
  async createRegistryEntry(data: any) {
    const response = await this.api.post('/registry', data);
    return response.data;
  }

  async getLastRegistryRows(rowTypeId: number, limit: number = 5) {
    const response = await this.api.get('/registry/last', {
      params: { row_type_id: rowTypeId, limit },
    });
    return response.data;
  }

  // Reports
  async getReport(type: string, params: any) {
    const response = await this.api.get(`/reports/${type}`, { params });
    return response.data;
  }

  // Products (new functionality)
  async getProducts(params?: { page?: number; limit?: number; search?: string }) {
    const response = await this.api.get('/products', { params });
    return response.data;
  }

  async createProduct(data: any) {
    const response = await this.api.post('/products', data);
    return response.data;
  }

  async updateProduct(id: number, data: any) {
    const response = await this.api.put(`/products/${id}`, data);
    return response.data;
  }

  async deleteProduct(id: number) {
    const response = await this.api.delete(`/products/${id}`);
    return response.data;
  }

  async importProducts(type: 'csv' | 'excel' | 'google-sheets', data: any) {
    const response = await this.api.post(`/products/import/${type}`, data);
    return response.data;
  }
}

export const backendApi = new BackendApiService();
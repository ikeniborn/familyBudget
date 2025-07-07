import axios, { AxiosInstance } from 'axios';

// Store user context for the service
let currentUserId: string | null = null;

export function setUserContext(userId: string) {
  currentUserId = userId;
}

class BackendApiServiceSecure {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: process.env.BACKEND_API_URL || 'http://budget-api:8888',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add user context
    this.api.interceptors.request.use(
      (config) => {
        // Add user ID to headers for all requests
        if (currentUserId) {
          config.headers['X-User-Id'] = currentUserId;
        }
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
        if (error.response) {
          // Handle specific error cases
          switch (error.response.status) {
            case 401:
              console.error('Unauthorized: User ID is required');
              break;
            case 403:
              console.error('Forbidden: Access denied');
              break;
            case 404:
              console.error('Not found:', error.response.data.detail);
              break;
            default:
              console.error('Backend API Error:', error.response.data);
          }
        } else {
          console.error('Backend API Error:', error.message);
        }
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

  async getPeriod(id: number) {
    const response = await this.api.get(`/periods/${id}`);
    return response.data;
  }

  // Financial Centers
  async getFinancialCenters() {
    const response = await this.api.get('/financial_centers');
    return response.data;
  }

  async getFinancialCenter(id: number) {
    const response = await this.api.get(`/financial_centers/${id}`);
    return response.data;
  }

  // Cost Centers
  async getCostCenters() {
    const response = await this.api.get('/cost_centers');
    return response.data;
  }

  async getCostCenter(id: number) {
    const response = await this.api.get(`/cost_centers/${id}`);
    return response.data;
  }

  // Nomenclatures
  async getNomenclatures() {
    const response = await this.api.get('/nomenclatures');
    return response.data;
  }

  async getNomenclature(id: number) {
    const response = await this.api.get(`/nomenclatures/${id}`);
    return response.data;
  }

  // Row Types
  async getRowTypes() {
    const response = await this.api.get('/row_types');
    return response.data;
  }

  async getRowType(id: number) {
    const response = await this.api.get(`/row_types/${id}`);
    return response.data;
  }

  // Registry
  async createRegistryEntry(data: any) {
    const response = await this.api.post('/registry', data);
    return response.data;
  }

  async getLastRegistryRows(rowTypeId?: number, limit: number = 5) {
    const response = await this.api.get('/registry/last_row', {
      params: { row_type_id: rowTypeId, limit_rows: limit },
    });
    return response.data;
  }

  // Reports
  async getBudgetRowTypeNomenclatureReport(params: {
    financial_center_id: number;
    period_id: number;
    nomenclature_id?: number;
  }) {
    const response = await this.api.get('/report/budget/row_type_nomenclature', { params });
    return response.data;
  }

  async getCompareRowTypeNomenclatureReport(params: {
    financial_center_id: number;
    period_id: number;
  }) {
    const response = await this.api.get('/report/compare/row_type_nomenclature', { params });
    return response.data;
  }

  async getCompareRowTypeOperationReport(params: {
    financial_center_id: number;
    period_id: number;
  }) {
    const response = await this.api.get('/report/compare/row_type_operation', { params });
    return response.data;
  }

  async getCompareRowTypeBillReport(params: {
    financial_center_id: number;
    period_id: number;
  }) {
    const response = await this.api.get('/report/compare/row_type_bill', { params });
    return response.data;
  }

  async getCompareRowTypeAccountReport(params: {
    financial_center_id: number;
    period_id: number;
  }) {
    const response = await this.api.get('/report/compare/row_type_account', { params });
    return response.data;
  }

  async getBudgetTotalReport(params: {
    financial_center_id: number;
    period_id: number;
  }) {
    const response = await this.api.get('/report/budget/total', { params });
    return response.data;
  }

  async getBudgetBillAccountReport(params: {
    financial_center_id: number;
    period_id: number;
  }) {
    const response = await this.api.get('/report/budget/bill_account', { params });
    return response.data;
  }

  // Products (new functionality)
  async getProducts(params?: { page?: number; limit?: number; search?: string }) {
    const response = await this.api.get('/products', { params });
    return response.data;
  }

  async getProduct(id: number) {
    const response = await this.api.get(`/products/${id}`);
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

  // Health check
  async healthCheck() {
    const response = await this.api.get('/health');
    return response.data;
  }
}

export const backendApiSecure = new BackendApiServiceSecure();
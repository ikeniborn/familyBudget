import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,
      headers: {
        'Content-Type': 'application/json'
      },
      withCredentials: true // Enable cookies for session authentication
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // FastAPI uses session cookies, no need to manually add tokens
        // withCredentials: true already ensures cookies are sent
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for session handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          // Session expired, redirect to login
          // Не редиректим для защищенных страниц - они сами обработают
          if (!window.location.pathname.startsWith('/fact') && 
              !window.location.pathname.startsWith('/budget') &&
              !window.location.pathname.startsWith('/reports') &&
              !window.location.pathname.startsWith('/reference') &&
              !window.location.pathname.startsWith('/dashboard') &&
              !window.location.pathname.startsWith('/settings')) {
            this.handleUnauthorized();
          }
        }
        
        return Promise.reject(error);
      }
    );
  }


  private handleUnauthorized(): void {
    // Session expired, redirect to login
    // Не редиректим, если уже на странице логина
    if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  // Generic request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}

// Export singleton instance
export const api = new ApiClient();

// Default export for easier import in existing code
export default api;

// Export specific service modules
export * from './auth.service';
export * from './periods.service';
export * from './registry.service';
export * from './reportService';
export * from './reportDataTransformer';
export * from './userService';
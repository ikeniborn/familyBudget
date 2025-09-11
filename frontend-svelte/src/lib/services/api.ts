import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { browser } from '$app/environment';

class ApiClient {
  private client: AxiosInstance;
  private isHandling401 = false;

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
        
        if (error.response?.status === 401) {
          // Prevent multiple 401 handlers from running simultaneously
          if (!this.isHandling401 && !originalRequest._retry) {
            this.isHandling401 = true;
            originalRequest._retry = true;
            
            // Don't redirect if already on login or auth endpoints
            const pathname = window.location.pathname;
            if (!pathname.includes('/login') &&
                !originalRequest.url?.includes('/auth/')) {
              console.warn('Session expired or invalid, redirecting to login...');
              this.handleUnauthorized();
            }
            
            // Reset flag after a short delay
            setTimeout(() => {
              this.isHandling401 = false;
            }, 1000);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async handleUnauthorized(): Promise<void> {
    if (browser) {
      // Import auth store dynamically to avoid circular dependencies
      const { authStore } = await import('$lib/stores/auth.store');
      await authStore.handleAuthError();
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
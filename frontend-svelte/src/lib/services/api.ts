import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';

class ApiClient {
  private client: AxiosInstance;
  private isRefreshing = false;
  private failedQueue: Array<{ resolve: Function; reject: Function }> = [];

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
        // Add auth token if available
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor with token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // Если токен уже обновляется, добавляем в очередь
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject });
            }).then(token => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return this.client(originalRequest);
            }).catch(err => {
              return Promise.reject(err);
            });
          }

          originalRequest._retry = true;
          this.isRefreshing = true;

          try {
            const newToken = await this.refreshToken();
            
            if (newToken) {
              // Обновляем все ожидающие запросы
              this.processQueue(null, newToken);
              
              // Повторяем оригинальный запрос
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client(originalRequest);
            } else {
              throw new Error('Failed to refresh token');
            }
          } catch (refreshError) {
            this.processQueue(refreshError, null);
            this.handleUnauthorized();
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  private processQueue(error: any, token: string | null = null) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error);
      } else {
        resolve(token);
      }
    });
    
    this.failedQueue = [];
  }
  
  private async refreshToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();
    
    if (!refreshToken) {
      return null;
    }
    
    try {
      // Обращаемся к authService для обновления токена
      const response = await axios.post('/api/auth/refresh', {
        refreshToken
      }, {
        withCredentials: true
      });
      
      // Обрабатываем новую структуру ответа от сервера
      if (response.data.success && response.data.tokens?.accessToken) {
        this.saveTokens(response.data.tokens.accessToken, response.data.tokens.refreshToken || refreshToken);
        return response.data.tokens.accessToken;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    
    return null;
  }

  private getAuthToken(): string | null {
    // Get token from localStorage (JWT access token or legacy auth token)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token') || localStorage.getItem('auth_token');
    }
    return null;
  }
  
  private getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }
  
  private saveTokens(accessToken: string, refreshToken?: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('auth_token', accessToken); // Обратная совместимость
      
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken);
      }
    }
  }
  
  private clearTokens(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_token'); // Обратная совместимость
    }
  }

  private handleUnauthorized(): void {
    // Clear auth and redirect to login
    this.clearTokens();
    
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
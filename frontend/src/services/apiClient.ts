import axios, { type AxiosResponse, type AxiosError } from 'axios';

// Создаем экземпляр axios с базовой конфигурацией
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // для работы с сессиями
});

// Request interceptor для добавления токенов авторизации если нужно
apiClient.interceptors.request.use(
  (config) => {
    // Логирование запросов в dev режиме
    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor для обработки ошибок
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Логирование успешных ответов в dev режиме
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error: AxiosError) => {
    console.error('❌ Response Error:', error);
    
    // Обработка различных типов ошибок
    if (error.response) {
      // Сервер ответил с кодом ошибки
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Неавторизован - перенаправление на логин
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          break;
        case 403:
          // Доступ запрещен
          console.error('Access forbidden:', data);
          break;
        case 404:
          // Не найдено
          console.error('Resource not found:', error.config?.url);
          break;
        case 500:
          // Внутренняя ошибка сервера
          console.error('Internal server error:', data);
          break;
        default:
          console.error(`API Error ${status}:`, data);
      }
    } else if (error.request) {
      // Запрос был отправлен, но ответа не получено
      console.error('No response received:', error.request);
    } else {
      // Ошибка при настройке запроса
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Типы для API ответов
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

// Утилитарные функции для работы с API
export const handleApiError = (error: AxiosError): string => {
  if (error.response?.data) {
    const apiError = error.response.data as ApiError;
    return apiError.message || 'Произошла ошибка';
  }
  return error.message || 'Произошла неизвестная ошибка';
};

export const createApiUrl = (path: string, params?: Record<string, any>): string => {
  const url = new URL(path, window.location.origin + '/api');
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.pathname + url.search;
};

export default apiClient;
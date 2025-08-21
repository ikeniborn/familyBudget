import { toastStore } from '$lib/stores/toast.store';
import type { FormValidationResult } from '$lib/hooks/useFormValidation';

// Standard HTTP status codes
export enum HttpStatusCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  UNPROCESSABLE_ENTITY = 422,
  INTERNAL_SERVER_ERROR = 500,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
}

// Error types
export interface ApiError {
  message: string;
  code?: string;
  field?: string;
  details?: Record<string, any>;
}

export interface ApiErrorResponse {
  error?: string;
  errors?: ApiError[];
  detail?: string | Record<string, string>;
  message?: string;
  status?: number;
  statusText?: string;
}

export interface ServerErrorContext {
  operation: string; // e.g., 'create', 'update', 'delete'
  resource: string; // e.g., 'nomenclature', 'period'
  retry?: () => Promise<void>;
}

// Russian error messages for common cases
const commonErrorMessages = {
  // Network errors
  network: 'Ошибка соединения с сервером. Проверьте подключение к интернету.',
  timeout: 'Превышено время ожидания ответа сервера. Попробуйте позже.',
  
  // Authentication errors
  unauthorized: 'Необходимо войти в систему для выполнения данной операции.',
  forbidden: 'Недостаточно прав для выполнения данной операции.',
  token_expired: 'Сессия истекла. Пожалуйста, войдите в систему заново.',
  
  // Validation errors
  validation_failed: 'Проверьте правильность введенных данных.',
  required_field: 'Это поле обязательно для заполнения.',
  invalid_format: 'Неверный формат данных.',
  
  // Resource errors
  not_found: 'Запрашиваемый ресурс не найден.',
  already_exists: 'Объект с такими параметрами уже существует.',
  in_use: 'Объект используется и не может быть удален.',
  
  // Server errors
  server_error: 'Внутренняя ошибка сервера. Обратитесь к администратору.',
  maintenance: 'Сервер временно недоступен. Ведутся технические работы.',
  
  // Generic fallbacks
  unknown: 'Произошла неизвестная ошибка. Попробуйте позже.',
  operation_failed: 'Операция не выполнена. Попробуйте еще раз.',
};

// Field mapping for different entity types
const fieldMappings: Record<string, Record<string, string>> = {
  nomenclature: {
    nomenclature_name: 'nomenclature_name',
    name: 'nomenclature_name',
    nomenclature_type: 'nomenclature_type',
    type: 'nomenclature_type',
    parent_id: 'parent_id',
    parent: 'parent_id',
    nomenclature_order: 'nomenclature_order',
    order: 'nomenclature_order',
    color: 'color',
    icon: 'icon',
    is_active: 'is_active',
    active: 'is_active',
  },
  financial_center: {
    financial_center_name: 'financial_center_name',
    name: 'financial_center_name',
    financial_center_description: 'financial_center_description',
    description: 'financial_center_description',
    parent_id: 'parent_id',
    parent: 'parent_id',
    financial_center_order: 'financial_center_order',
    order: 'financial_center_order',
    is_active: 'is_active',
    active: 'is_active',
  },
  cost_center: {
    cost_center_name: 'cost_center_name',
    name: 'cost_center_name',
    cost_center_description: 'cost_center_description',
    description: 'cost_center_description',
    financial_center_id: 'financial_center_id',
    financial_center: 'financial_center_id',
    budget_limit: 'budget_limit',
    limit: 'budget_limit',
    budget_period: 'budget_period',
    period: 'budget_period',
    cost_center_order: 'cost_center_order',
    order: 'cost_center_order',
    is_active: 'is_active',
    active: 'is_active',
  },
  period: {
    period_name: 'period_name',
    name: 'period_name',
    period_year: 'period_year',
    year: 'period_year',
    period_month: 'period_month',
    month: 'period_month',
    period_start_date: 'period_start_date',
    start_date: 'period_start_date',
    period_end_date: 'period_end_date',
    end_date: 'period_end_date',
  },
  product: {
    name: 'name',
    product_name: 'name',
    description: 'description',
    product_description: 'description',
    barcode: 'barcode',
    product_barcode: 'barcode',
    unit: 'unit',
    product_unit: 'unit',
  },
  registry: {
    period_id: 'period_id',
    period: 'period_id',
    financial_center_id: 'financial_center_id',
    financial_center: 'financial_center_id',
    cost_center_id: 'cost_center_id',
    cost_center: 'cost_center_id',
    nomenclature_id: 'nomenclature_id',
    nomenclature: 'nomenclature_id',
    row_type: 'row_type',
    type: 'row_type',
    amount: 'amount',
    sum: 'amount',
    description: 'description',
  },
};

/**
 * Extracts and normalizes error information from API response
 */
export function extractApiError(error: any): ApiErrorResponse {
  // Handle Axios errors
  if (error.response) {
    return {
      status: error.response.status,
      statusText: error.response.statusText,
      ...error.response.data,
    };
  }
  
  // Handle network errors
  if (error.request) {
    return {
      message: commonErrorMessages.network,
      status: 0,
    };
  }
  
  // Handle other errors
  return {
    message: error.message || commonErrorMessages.unknown,
  };
}

/**
 * Maps server field names to form field names
 */
export function mapFieldNames(errors: Record<string, string>, entityType: string): Record<string, string> {
  const mapping = fieldMappings[entityType] || {};
  const mappedErrors: Record<string, string> = {};
  
  Object.entries(errors).forEach(([field, message]) => {
    const mappedField = mapping[field] || field;
    mappedErrors[mappedField] = message;
  });
  
  return mappedErrors;
}

/**
 * Handles server validation errors by extracting field errors and general messages
 */
export function handleServerValidationError<T extends Record<string, any>>(
  error: any,
  formValidation: FormValidationResult<T>,
  entityType: string,
  context: ServerErrorContext
): void {
  const apiError = extractApiError(error);
  
  // Handle different types of validation errors
  let fieldErrors: Record<string, string> = {};
  let generalError: string | null = null;
  
  if (apiError.detail) {
    if (typeof apiError.detail === 'object') {
      // Field-specific errors
      fieldErrors = mapFieldNames(apiError.detail, entityType);
    } else {
      // General error message
      generalError = apiError.detail;
    }
  } else if (apiError.errors) {
    // Array of errors
    apiError.errors.forEach(err => {
      if (err.field) {
        const mapping = fieldMappings[entityType] || {};
        const mappedField = mapping[err.field] || err.field;
        fieldErrors[mappedField] = err.message;
      } else {
        generalError = err.message;
      }
    });
  } else if (apiError.error || apiError.message) {
    generalError = apiError.error || apiError.message;
  }
  
  // Set form errors
  if (Object.keys(fieldErrors).length > 0) {
    formValidation.setServerErrors(fieldErrors);
  }
  
  if (generalError) {
    formValidation.setServerErrors({ _form: generalError });
  }
  
  // Show toast notification for critical errors
  if (apiError.status && apiError.status >= 500) {
    toastStore.error(
      'Ошибка сервера',
      generalError || commonErrorMessages.server_error
    );
  }
}

/**
 * Handles different types of server errors with appropriate user feedback
 */
export function handleServerError(
  error: any,
  context: ServerErrorContext
): void {
  const apiError = extractApiError(error);
  const { operation, resource } = context;
  
  let title = 'Ошибка';
  let message = commonErrorMessages.unknown;
  
  // Determine error message based on status code and operation
  switch (apiError.status) {
    case HttpStatusCode.BAD_REQUEST:
      title = 'Неверные данные';
      message = apiError.message || commonErrorMessages.validation_failed;
      break;
      
    case HttpStatusCode.UNAUTHORIZED:
      title = 'Необходима авторизация';
      message = commonErrorMessages.unauthorized;
      // Could trigger redirect to login
      break;
      
    case HttpStatusCode.FORBIDDEN:
      title = 'Доступ запрещен';
      message = commonErrorMessages.forbidden;
      break;
      
    case HttpStatusCode.NOT_FOUND:
      title = 'Не найдено';
      message = `${getResourceDisplayName(resource)} не найден${getResourceGender(resource)}.`;
      break;
      
    case HttpStatusCode.CONFLICT:
      title = 'Конфликт данных';
      if (operation === 'create') {
        message = commonErrorMessages.already_exists;
      } else if (operation === 'delete') {
        message = commonErrorMessages.in_use;
      } else {
        message = apiError.message || 'Данные были изменены другим пользователем.';
      }
      break;
      
    case HttpStatusCode.UNPROCESSABLE_ENTITY:
      title = 'Ошибка валидации';
      message = apiError.message || commonErrorMessages.validation_failed;
      break;
      
    case HttpStatusCode.INTERNAL_SERVER_ERROR:
    case HttpStatusCode.BAD_GATEWAY:
    case HttpStatusCode.SERVICE_UNAVAILABLE:
    case HttpStatusCode.GATEWAY_TIMEOUT:
      title = 'Ошибка сервера';
      message = commonErrorMessages.server_error;
      break;
      
    case 0: // Network error
      title = 'Ошибка соединения';
      message = commonErrorMessages.network;
      break;
      
    default:
      if (apiError.message) {
        message = apiError.message;
      }
      break;
  }
  
  // Show error toast
  toastStore.error(title, message);
}

/**
 * Handles network retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const apiError = extractApiError(error);
      
      // Don't retry on client errors (4xx)
      if (apiError.status && apiError.status >= 400 && apiError.status < 500) {
        throw error;
      }
      
      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }
      
      // Wait before retrying with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
    }
  }
  
  throw lastError;
}

/**
 * Helper to get display names for resources
 */
function getResourceDisplayName(resource: string): string {
  const displayNames: Record<string, string> = {
    nomenclature: 'Категория',
    financial_center: 'Финансовый центр',
    cost_center: 'МВЗ',
    period: 'Период',
    product: 'Товар',
    registry: 'Транзакция',
  };
  
  return displayNames[resource] || 'Объект';
}

/**
 * Helper to get grammatical gender for resources
 */
function getResourceGender(resource: string): string {
  const femineResources = ['nomenclature', 'registry'];
  return femineResources.includes(resource) ? 'а' : '';
}

/**
 * Enhanced error handler that combines form validation and server error handling
 */
export function handleFormSubmissionError<T extends Record<string, any>>(
  error: any,
  formValidation: FormValidationResult<T>,
  entityType: string,
  context: ServerErrorContext
): void {
  const apiError = extractApiError(error);
  
  // Handle validation errors (422) - show in form
  if (apiError.status === HttpStatusCode.UNPROCESSABLE_ENTITY || 
      apiError.status === HttpStatusCode.BAD_REQUEST) {
    handleServerValidationError(error, formValidation, entityType, context);
    return;
  }
  
  // Handle other errors - show as toast
  handleServerError(error, context);
}

/**
 * Creates a standardized error handler for form submissions
 */
export function createFormErrorHandler<T extends Record<string, any>>(
  formValidation: FormValidationResult<T>,
  entityType: string
) {
  return (operation: string, resource: string = entityType) => 
    (error: any) => {
      handleFormSubmissionError(error, formValidation, entityType, {
        operation,
        resource,
      });
    };
}

/**
 * Global error boundary for catching unhandled errors
 */
export function setupGlobalErrorHandler(): void {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    
    // Try to extract meaningful error information
    if (event.reason?.response) {
      handleServerError(event.reason, {
        operation: 'unknown',
        resource: 'unknown',
      });
    } else {
      toastStore.error(
        'Неожиданная ошибка',
        'Произошла неожиданная ошибка. Обновите страницу и попробуйте снова.'
      );
    }
    
    // Prevent the default browser error handling
    event.preventDefault();
  });
}

export default {
  extractApiError,
  mapFieldNames,
  handleServerValidationError,
  handleServerError,
  withRetry,
  handleFormSubmissionError,
  createFormErrorHandler,
  setupGlobalErrorHandler,
};
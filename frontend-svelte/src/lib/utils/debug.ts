/**
 * Централизованная система логирования для Family Budget
 *
 * Предоставляет унифицированный интерфейс для логирования с поддержкой:
 * - Различных уровней логирования (debug, info, warn, error)
 * - Категоризации логов (AUTH, API, UI, NAVIGATION, STORE)
 * - Автоматического форматирования с временными метками
 * - Фильтрации логов в зависимости от окружения
 * - Красивого вывода с эмоджи и цветами
 *
 * @example
 * ```typescript
 * import { debugLog, infoLog, warnLog, errorLog } from '$lib/utils/debug';
 *
 * // Базовое использование
 * debugLog('AUTH', 'User authentication started');
 * infoLog('API', 'Data fetched successfully');
 * warnLog('UI', 'Component re-rendered multiple times');
 * errorLog('STORE', 'Failed to update user state', error);
 * ```
 */

// Типы для категорий логирования
export type LogCategory =
  | 'AUTH'        // Аутентификация и авторизация
  | 'API'         // API запросы и ответы
  | 'UI'          // Компоненты пользовательского интерфейса
  | 'NAVIGATION'  // Навигация и маршрутизация
  | 'STORE'       // Управление состоянием приложения
  | 'GENERAL';    // Общие логи

// Уровни логирования
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Интерфейс для конфигурации логирования
interface LogConfig {
  enabled: boolean;
  level: LogLevel;
  categories: LogCategory[];
  showTimestamp: boolean;
  showStackTrace: boolean;
}

// Цвета для различных категорий и уровней
const COLORS = {
  AUTH: '#4CAF50',        // Зеленый
  API: '#2196F3',         // Синий
  UI: '#FF9800',          // Оранжевый
  NAVIGATION: '#9C27B0',  // Фиолетовый
  STORE: '#F44336',       // Красный
  GENERAL: '#607D8B',     // Серый

  debug: '#9E9E9E',       // Светло-серый
  info: '#2196F3',        // Синий
  warn: '#FF9800',        // Оранжевый
  error: '#F44336'        // Красный
} as const;

// Эмоджи для различных категорий и уровней
const EMOJIS = {
  AUTH: '🔐',
  API: '🌐',
  UI: '🎨',
  NAVIGATION: '🧭',
  STORE: '💾',
  GENERAL: '📝',

  debug: '🐛',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌'
} as const;

/**
 * Определяет текущее окружение выполнения
 */
function getEnvironment(): 'development' | 'production' | 'test' {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.NODE_ENV as 'development' | 'production' | 'test' || 'development';
  }

  // Fallback для браузера
  if (typeof window !== 'undefined') {
    // @ts-ignore - проверяем на наличие Vite dev сервера
    return window.__vite_plugin_react_preamble_installed__ || window.location.hostname === 'localhost'
      ? 'development'
      : 'production';
  }

  return 'production';
}

/**
 * Получает конфигурацию логирования из переменных окружения
 */
function getLogConfig(): LogConfig {
  const env = getEnvironment();
  const isProduction = env === 'production';

  // Получаем переменные окружения (с fallback для браузера)
  const getEnvVar = (key: string, defaultValue: string = ''): string => {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || defaultValue;
    }
    return defaultValue;
  };

  // Парсим разрешенные категории из переменной окружения
  const allowedCategoriesStr = getEnvVar('VITE_LOG_CATEGORIES', '');
  const allowedCategories: LogCategory[] = allowedCategoriesStr
    ? allowedCategoriesStr.split(',').map(cat => cat.trim() as LogCategory)
    : ['AUTH', 'API', 'UI', 'NAVIGATION', 'STORE', 'GENERAL'];

  return {
    enabled: !isProduction || getEnvVar('VITE_LOG_ENABLED') === 'true',
    level: (getEnvVar('VITE_LOG_LEVEL', 'info') as LogLevel),
    categories: allowedCategories,
    showTimestamp: getEnvVar('VITE_LOG_TIMESTAMP', 'true') === 'true',
    showStackTrace: getEnvVar('VITE_LOG_STACK_TRACE', 'true') === 'true'
  };
}

/**
 * Определяет приоритет уровня логирования
 */
function getLogLevelPriority(level: LogLevel): number {
  const priorities = { debug: 0, info: 1, warn: 2, error: 3 };
  return priorities[level];
}

/**
 * Форматирует временную метку
 */
function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').replace('Z', '');
}

/**
 * Создает отформатированное сообщение лога
 */
function formatLogMessage(
  level: LogLevel,
  category: LogCategory,
  message: string,
  config: LogConfig
): string {
  const parts: string[] = [];

  // Добавляем временную метку
  if (config.showTimestamp) {
    parts.push(`[${formatTimestamp()}]`);
  }

  // Добавляем эмоджи и категорию
  const categoryEmoji = EMOJIS[category];
  const levelEmoji = EMOJIS[level];
  parts.push(`${levelEmoji} ${categoryEmoji} [${category}/${level.toUpperCase()}]`);

  // Добавляем сообщение
  parts.push(message);

  return parts.join(' ');
}

/**
 * Выводит лог в консоль с соответствующим стилем
 */
function outputLog(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: any,
  error?: Error
): void {
  const config = getLogConfig();

  // Проверяем, нужно ли выводить этот лог
  if (!config.enabled) return;
  if (getLogLevelPriority(level) < getLogLevelPriority(config.level)) return;
  if (!config.categories.includes(category)) return;

  const formattedMessage = formatLogMessage(level, category, message, config);
  const categoryColor = COLORS[category];
  const levelColor = COLORS[level];

  // Определяем метод консоли
  const consoleMethod = level === 'error' ? 'error'
                      : level === 'warn' ? 'warn'
                      : level === 'info' ? 'info'
                      : 'log';

  // Выводим основное сообщение
  if (typeof console !== 'undefined') {
    if (data !== undefined) {
      console[consoleMethod](
        `%c${formattedMessage}`,
        `color: ${levelColor}; font-weight: bold;`,
        data
      );
    } else {
      console[consoleMethod](
        `%c${formattedMessage}`,
        `color: ${levelColor}; font-weight: bold;`
      );
    }

    // Выводим stack trace для ошибок
    if (error && config.showStackTrace && level === 'error') {
      console.error('Stack trace:', error.stack);
    }
  }
}

/**
 * Логирование уровня DEBUG
 * Выводится только в режиме разработки
 *
 * @param category - Категория лога
 * @param message - Сообщение
 * @param data - Дополнительные данные (опционально)
 */
export function debugLog(category: LogCategory, message: string, data?: any): void {
  outputLog('debug', category, message, data);
}

/**
 * Логирование уровня INFO
 * Важная информация о работе приложения
 *
 * @param category - Категория лога
 * @param message - Сообщение
 * @param data - Дополнительные данные (опционально)
 */
export function infoLog(category: LogCategory, message: string, data?: any): void {
  outputLog('info', category, message, data);
}

/**
 * Логирование уровня WARN
 * Предупреждения о потенциальных проблемах
 *
 * @param category - Категория лога
 * @param message - Сообщение
 * @param data - Дополнительные данные (опционально)
 */
export function warnLog(category: LogCategory, message: string, data?: any): void {
  outputLog('warn', category, message, data);
}

/**
 * Логирование уровня ERROR
 * Критические ошибки приложения
 *
 * @param category - Категория лога
 * @param message - Сообщение
 * @param error - Объект ошибки (опционально)
 * @param data - Дополнительные данные (опционально)
 */
export function errorLog(category: LogCategory, message: string, error?: Error, data?: any): void {
  outputLog('error', category, message, data, error);
}

/**
 * Создает логгер для конкретной категории
 * Упрощает использование в компонентах
 *
 * @param category - Категория логгера
 * @returns Объект с методами логирования
 *
 * @example
 * ```typescript
 * const logger = createLogger('AUTH');
 * logger.debug('Authentication process started');
 * logger.info('User logged in successfully');
 * logger.warn('Session will expire soon');
 * logger.error('Authentication failed', error);
 * ```
 */
export function createLogger(category: LogCategory) {
  return {
    debug: (message: string, data?: any) => debugLog(category, message, data),
    info: (message: string, data?: any) => infoLog(category, message, data),
    warn: (message: string, data?: any) => warnLog(category, message, data),
    error: (message: string, error?: Error, data?: any) => errorLog(category, message, error, data)
  };
}

/**
 * Логирует API запрос с автоматическим форматированием
 *
 * @param method - HTTP метод
 * @param url - URL запроса
 * @param data - Данные запроса (опционально)
 */
export function logApiRequest(method: string, url: string, data?: any): void {
  debugLog('API', `${method.toUpperCase()} ${url}`, data);
}

/**
 * Логирует API ответ с автоматическим форматированием
 *
 * @param method - HTTP метод
 * @param url - URL запроса
 * @param status - HTTP статус ответа
 * @param data - Данные ответа (опционально)
 */
export function logApiResponse(method: string, url: string, status: number, data?: any): void {
  const level = status >= 400 ? 'error' : status >= 300 ? 'warn' : 'info';
  const message = `${method.toUpperCase()} ${url} - ${status}`;

  if (level === 'error') {
    errorLog('API', message, undefined, data);
  } else if (level === 'warn') {
    warnLog('API', message, data);
  } else {
    infoLog('API', message, data);
  }
}

/**
 * Логирует навигацию между страницами
 *
 * @param from - Предыдущая страница
 * @param to - Текущая страница
 */
export function logNavigation(from: string, to: string): void {
  infoLog('NAVIGATION', `Navigation: ${from} → ${to}`);
}

/**
 * Логирует изменения в store
 *
 * @param storeName - Название store
 * @param action - Действие
 * @param data - Данные изменения (опционально)
 */
export function logStoreUpdate(storeName: string, action: string, data?: any): void {
  debugLog('STORE', `${storeName}: ${action}`, data);
}

/**
 * Группирует связанные логи
 * Полезно для отслеживания сложных операций
 *
 * @param groupName - Название группы
 * @param callback - Функция с логами
 *
 * @example
 * ```typescript
 * await logGroup('User Authentication', async () => {
 *   debugLog('AUTH', 'Starting authentication');
 *   // ... код аутентификации
 *   infoLog('AUTH', 'Authentication completed');
 * });
 * ```
 */
export async function logGroup<T>(
  groupName: string,
  callback: () => Promise<T> | T
): Promise<T> {
  if (typeof console !== 'undefined' && console.group) {
    console.group(`🔍 ${groupName}`);
  }

  try {
    const result = await callback();
    return result;
  } finally {
    if (typeof console !== 'undefined' && console.groupEnd) {
      console.groupEnd();
    }
  }
}

/**
 * Измеряет время выполнения операции
 *
 * @param label - Метка операции
 * @param callback - Функция для измерения
 * @returns Результат функции
 *
 * @example
 * ```typescript
 * const result = await measureTime('API Request', async () => {
 *   return await fetch('/api/data');
 * });
 * ```
 */
export async function measureTime<T>(
  label: string,
  callback: () => Promise<T> | T
): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await callback();
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    debugLog('GENERAL', `⏱️ ${label} completed in ${duration}ms`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    errorLog('GENERAL', `⏱️ ${label} failed after ${duration}ms`, error as Error);
    throw error;
  }
}

// Экспортируем типы для использования в других модулях
export type { LogCategory, LogLevel };

/**
 * Пример использования системы логирования:
 *
 * ```typescript
 * import {
 *   debugLog,
 *   infoLog,
 *   warnLog,
 *   errorLog,
 *   createLogger,
 *   logApiRequest,
 *   logApiResponse,
 *   logNavigation,
 *   logStoreUpdate,
 *   logGroup,
 *   measureTime
 * } from '$lib/utils/debug';
 *
 * // Создание специализированного логгера
 * const authLogger = createLogger('AUTH');
 *
 * // Логирование аутентификации
 * authLogger.debug('Starting login process');
 * authLogger.info('User credentials validated');
 * authLogger.error('Login failed', new Error('Invalid password'));
 *
 * // API логирование
 * logApiRequest('POST', '/api/auth/login', { username: 'user' });
 * logApiResponse('POST', '/api/auth/login', 200, { token: 'abc123' });
 *
 * // Навигация
 * logNavigation('/login', '/dashboard');
 *
 * // Store обновления
 * logStoreUpdate('auth', 'SET_USER', { id: 1, name: 'John' });
 *
 * // Группировка логов
 * await logGroup('Complete User Setup', async () => {
 *   authLogger.info('Creating user profile');
 *   authLogger.info('Setting up preferences');
 *   authLogger.info('Sending welcome email');
 * });
 *
 * // Измерение производительности
 * const data = await measureTime('Fetch Dashboard Data', async () => {
 *   return await fetch('/api/dashboard');
 * });
 * ```
 *
 * Конфигурация через переменные окружения (.env):
 * ```
 * # Включить логирование в production
 * VITE_LOG_ENABLED=true
 *
 * # Уровень логирования (debug, info, warn, error)
 * VITE_LOG_LEVEL=info
 *
 * # Разрешенные категории (через запятую)
 * VITE_LOG_CATEGORIES=AUTH,API,UI
 *
 * # Показывать временные метки
 * VITE_LOG_TIMESTAMP=true
 *
 * # Показывать stack trace для ошибок
 * VITE_LOG_STACK_TRACE=true
 * ```
 */
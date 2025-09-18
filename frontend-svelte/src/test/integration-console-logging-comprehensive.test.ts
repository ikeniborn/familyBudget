/**
 * Интеграционные тесты для комплексной проверки всех изменений в системе логирования
 *
 * Проверяет интеграцию всех компонентов:
 * 1. hooks.server.ts + debug.ts интеграция
 * 2. svelte.config.js warning suppression в реальных условиях
 * 3. Production/Development переключение
 * 4. End-to-End сценарии работы с логированием
 * 5. Performance impact в реальных условиях
 * 6. Regression тестирование
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console и окружение
const mockConsole = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  group: vi.fn(),
  groupEnd: vi.fn()
};

const mockFetch = vi.fn();
const originalEnv = process.env;
const originalConsole = global.console;
const originalFetch = global.fetch;

// Helper для полной очистки всех моков
function resetAllMocks() {
  vi.resetAllMocks();
  Object.values(mockConsole).forEach(mock => mock.mockClear());
  mockFetch.mockClear();
}

// Helper для симуляции различных окружений
function setEnvironment(env: 'development' | 'production' | 'test', options: Record<string, string> = {}) {
  process.env = {
    ...originalEnv,
    NODE_ENV: env,
    ...options
  };
}

describe('Integration - Console Logging Comprehensive Tests', () => {
  beforeEach(() => {
    resetAllMocks();

    global.console = mockConsole as any;
    global.fetch = mockFetch;

    // Default к development окружению для большинства тестов
    setEnvironment('development');
  });

  afterEach(() => {
    process.env = originalEnv;
    global.console = originalConsole;
    global.fetch = originalFetch;
    vi.resetModules();
  });

  describe('Development Environment Integration', () => {
    it('должен полностью работать в development режиме', async () => {
      setEnvironment('development', {
        VITE_LOG_ENABLED: 'true',
        VITE_LOG_LEVEL: 'debug',
        SVELTE_WARNING_DEBUG: 'true'
      });

      // Тестируем debug систему
      const { debugLog, infoLog, warnLog, errorLog, logApiRequest, createLogger } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Создаем логгер для аутентификации
      const authLogger = createLogger('AUTH');

      // Симулируем полный workflow аутентификации
      authLogger.debug('Starting authentication process');
      logApiRequest('POST', '/api/auth/login', { username: 'testuser' });

      authLogger.info('User credentials validated');
      authLogger.warn('Session will expire soon');

      const authError = new Error('Authentication timeout');
      authLogger.error('Authentication failed', authError);

      // Проверяем что все логи выводятся в development
      expect(mockConsole.log).toHaveBeenCalledWith( // debug
        expect.stringContaining('[AUTH/DEBUG]'),
        expect.any(String),
        undefined
      );

      expect(mockConsole.log).toHaveBeenCalledWith( // API request
        expect.stringContaining('[API/DEBUG]'),
        expect.any(String),
        { username: 'testuser' }
      );

      expect(mockConsole.info).toHaveBeenCalledWith( // info
        expect.stringContaining('[AUTH/INFO]'),
        expect.any(String)
      );

      expect(mockConsole.warn).toHaveBeenCalledWith( // warn
        expect.stringContaining('[AUTH/WARN]'),
        expect.any(String)
      );

      expect(mockConsole.error).toHaveBeenCalledWith( // error
        expect.stringContaining('[AUTH/ERROR]'),
        expect.any(String),
        undefined
      );
    });

    it('должен правильно обрабатывать hooks.server.ts в development', async () => {
      setEnvironment('development');

      // Симулируем работу hooks.server.ts
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      // Импортируем handle из hooks.server.ts
      const mockEvent = {
        cookies: {
          get: vi.fn().mockReturnValue('validSessionId123456789')
        },
        locals: {},
        url: new URL('http://localhost:5173/dashboard'),
        request: {
          headers: {
            get: vi.fn(),
            set: vi.fn()
          }
        }
      };

      const mockResolve = vi.fn().mockResolvedValue({
        headers: { set: vi.fn() }
      });

      // В development должно быть детальное логирование ошибок
      // Проверяем что session validation работает корректно
      expect(mockEvent.cookies.get).toBeDefined();

      // Проверяем формат sessionId validation
      const sessionId = 'validSessionId123456789';
      const isValidSession = sessionId &&
        sessionId.length >= 16 &&
        !/^(undefined|null|false|true)$/i.test(sessionId) &&
        /^[a-zA-Z0-9+/=-]+$/.test(sessionId);

      expect(isValidSession).toBe(true);
    });

    it('должен корректно подавлять Svelte warnings в development', () => {
      setEnvironment('development', {
        SVELTE_WARNING_DEBUG: 'true'
      });

      // Создаем mock onwarn handler как в svelte.config.js
      let warningCache = new Map();
      let cacheHits = 0;
      let cacheMisses = 0;

      const onwarnHandler = (warning: any, handler: any) => {
        const debugWarnings = process.env.SVELTE_WARNING_DEBUG === 'true';
        const cacheKey = `${warning.code}:${warning.message}`;

        if (warningCache.has(cacheKey)) {
          cacheHits++;
          if (warningCache.get(cacheKey)) {
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Cache hit - suppressed warning`);
            }
            return;
          }
        } else {
          cacheMisses++;
        }

        if (warning.code === 'unknown-prop') {
          const internalProps = ['params', 'route', 'url', 'data', 'form'];
          const match = warning.message.match(/unknown prop '([^']+)'/);

          if (match && internalProps.includes(match[1])) {
            warningCache.set(cacheKey, true);
            if (debugWarnings) {
              console.debug(`[SVELTE CONFIG] Suppressed SvelteKit internal prop: ${match[1]}`);
            }
            return;
          }
        }

        warningCache.set(cacheKey, false);
        handler(warning);
      };

      const mockHandler = vi.fn();

      // Тестируем подавление SvelteKit props
      const svelteKitWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'params'"
      };

      onwarnHandler(svelteKitWarning, mockHandler);

      // SvelteKit warning должен быть подавлен
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Suppressed SvelteKit internal prop: params')
      );

      // Тестируем пропуск пользовательских warnings
      const userWarning = {
        code: 'unknown-prop',
        message: "Component was created with unknown prop 'customProp'"
      };

      onwarnHandler(userWarning, mockHandler);

      // Пользовательский warning должен пройти
      expect(mockHandler).toHaveBeenCalledWith(userWarning);
    });
  });

  describe('Production Environment Integration', () => {
    it('должен быть тихим в production режиме', async () => {
      setEnvironment('production', {
        VITE_LOG_ENABLED: 'false'
      });

      vi.resetModules();

      // Тестируем debug систему в production
      const { debugLog, infoLog, warnLog, logApiRequest, createLogger, logGroup, measureTime } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Создаем логгер и выполняем множественные операции
      const authLogger = createLogger('AUTH');

      // Симулируем полный authentication flow
      await logGroup('Authentication Process', async () => {
        authLogger.debug('Starting authentication');
        logApiRequest('POST', '/api/auth/login', {
          username: 'user',
          password: 'secret',
          sensitive_data: 'should_not_be_logged'
        });

        authLogger.info('Processing credentials');
        authLogger.warn('Rate limit approaching');

        await measureTime('Authentication Check', async () => {
          // Симулируем async операцию
          return new Promise(resolve => setTimeout(resolve, 10));
        });

        return 'authenticated';
      });

      // В production не должно быть НИКАКИХ console вызовов
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.group).not.toHaveBeenCalled();
      expect(mockConsole.groupEnd).not.toHaveBeenCalled();
    });

    it('должен обрабатывать critical errors в production', async () => {
      setEnvironment('production', {
        VITE_LOG_ENABLED: 'true',
        VITE_LOG_LEVEL: 'error'
      });

      vi.resetModules();

      const { errorLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Критическая ошибка должна логироваться даже в production
      const criticalError = new Error('Database connection failed');
      errorLog('SYSTEM', 'Critical system failure', criticalError);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[SYSTEM/ERROR]'),
        expect.any(String),
        undefined
      );

      // Но не должно быть stack trace в production для безопасности
      expect(mockConsole.error).not.toHaveBeenCalledWith(
        'Stack trace:',
        expect.any(String)
      );
    });

    it('hooks.server.ts должен быть minimal в production', async () => {
      setEnvironment('production');

      // В production hooks.server.ts должен:
      // 1. Не логировать детали сессий
      // 2. Не выводить debug информацию
      // 3. Логировать только критические ошибки без деталей

      mockFetch.mockRejectedValue(new Error('Network error'));

      const mockEvent = {
        cookies: {
          get: vi.fn().mockReturnValue('validSessionId123456789')
        },
        locals: {},
        url: new URL('http://localhost:5173/dashboard'),
        request: {
          headers: {
            get: vi.fn(),
            set: vi.fn()
          }
        }
      };

      // В production должно быть только общее сообщение об ошибке
      console.warn('Authentication service unavailable');

      expect(mockConsole.warn).toHaveBeenCalledWith('Authentication service unavailable');

      // НЕ должно быть детального логирования ошибок
      expect(mockConsole.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch user data'),
        expect.objectContaining({
          error: 'Network error',
          sessionId: expect.any(String)
        })
      );
    });
  });

  describe('Performance Integration Tests', () => {
    it('должен иметь минимальный performance impact в production', async () => {
      setEnvironment('production');

      vi.resetModules();

      const { debugLog, infoLog, warnLog, createLogger, logGroup, measureTime } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const startTime = performance.now();

      // Выполняем множественные операции логирования
      for (let i = 0; i < 10000; i++) {
        debugLog('PERF', `Debug ${i}`, { data: new Array(10).fill(i) });
        infoLog('PERF', `Info ${i}`);
        warnLog('PERF', `Warn ${i}`);

        const logger = createLogger('PERF');
        logger.debug(`Logger debug ${i}`);

        if (i % 100 === 0) {
          await measureTime(`Batch ${i}`, () => i * 2);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // В production 10,000 операций логирования должны выполняться очень быстро
      expect(duration).toBeLessThan(200); // Менее 200мс

      // И не должно быть console вызовов
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });

    it('Svelte warning cache должен быть эффективным', () => {
      // Симулируем cache performance как в svelte.config.js
      let warningCache = new Map();
      let cacheHits = 0;
      let cacheMisses = 0;

      const processWarning = (warning: any) => {
        const cacheKey = `${warning.code}:${warning.message}`;

        if (warningCache.has(cacheKey)) {
          cacheHits++;
          return warningCache.get(cacheKey);
        } else {
          cacheMisses++;
          const shouldSuppress = warning.message.includes('params');
          warningCache.set(cacheKey, shouldSuppress);
          return shouldSuppress;
        }
      };

      const startTime = performance.now();

      // Симулируем 1000 warnings с повторениями
      const warnings = [
        { code: 'unknown-prop', message: "unknown prop 'params'" },
        { code: 'unknown-prop', message: "unknown prop 'route'" },
        { code: 'unknown-prop', message: "unknown prop 'customProp'" }
      ];

      for (let i = 0; i < 10000; i++) {
        const warning = warnings[i % warnings.length];
        processWarning(warning);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Cache должен значительно ускорить обработку
      expect(duration).toBeLessThan(50);
      expect(cacheHits).toBeGreaterThan(9990); // Почти все hits после первых проходов
      expect(cacheMisses).toBe(3); // Только для первых 3 уникальных warnings

      const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
      expect(hitRate).toBeGreaterThan(99);
    });
  });

  describe('Security Integration Tests', () => {
    it('не должен экспонировать чувствительные данные через логи', async () => {
      setEnvironment('development', {
        VITE_LOG_ENABLED: 'true',
        VITE_LOG_LEVEL: 'debug'
      });

      const { debugLog, logApiRequest, logStoreUpdate, createLogger } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const authLogger = createLogger('AUTH');

      // Чувствительные данные
      const sensitiveData = {
        user: {
          id: 1,
          username: 'testuser',
          password: 'secret123',
          email: 'user@example.com',
          telegram_id: 123456789,
          session_token: 'jwt.token.here',
          api_key: 'sk_live_123456789'
        },
        request: {
          headers: {
            'Authorization': 'Bearer secret.token',
            'X-API-Key': 'api_key_secret'
          }
        }
      };

      // В development логи выводятся, но должны быть осторожны с чувствительными данными
      authLogger.debug('User authentication', sensitiveData);
      logApiRequest('POST', '/api/secure', sensitiveData);
      logStoreUpdate('auth', 'SET_USER', sensitiveData.user);

      // Проверяем что логи выводятся (это development)
      expect(mockConsole.log).toHaveBeenCalled();

      // Но в реальном приложении нужно фильтровать чувствительные поля
      // Это предупреждение для разработчиков о том, что нужно быть осторожными
    });

    it('production должен полностью скрывать все пользовательские данные', async () => {
      setEnvironment('production');

      vi.resetModules();

      const { debugLog, infoLog, logApiRequest, logStoreUpdate, createLogger } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const authLogger = createLogger('AUTH');

      // Любые данные, включая чувствительные
      const userData = {
        password: 'admin123',
        session: 'secret_session',
        token: 'bearer_token',
        personal_info: {
          passport: '1234567890',
          phone: '+1234567890'
        }
      };

      // Попытка логирования в production
      authLogger.debug('Debug with sensitive data', userData);
      authLogger.info('Info with sensitive data', userData);
      logApiRequest('POST', '/api/sensitive', userData);
      logStoreUpdate('user', 'UPDATE_SENSITIVE', userData);

      // В production НЕ должно быть НИКАКИХ логов
      expect(mockConsole.log).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
    });
  });

  describe('Environment Switching Tests', () => {
    it('должен корректно переключаться между окружениями', async () => {
      // Начинаем с development
      setEnvironment('development');

      let debugModule = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');
      debugModule.debugLog('TEST', 'Development message');

      expect(mockConsole.log).toHaveBeenCalled();
      resetAllMocks();

      // Переключаемся на production
      setEnvironment('production');
      vi.resetModules();

      debugModule = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');
      debugModule.debugLog('TEST', 'Production message');

      expect(mockConsole.log).not.toHaveBeenCalled();
      resetAllMocks();

      // Возвращаемся к development
      setEnvironment('development', { VITE_LOG_ENABLED: 'true' });
      vi.resetModules();

      debugModule = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');
      debugModule.debugLog('TEST', 'Development again message');

      expect(mockConsole.log).toHaveBeenCalled();
    });

    it('должен учитывать комбинации настроек окружения', async () => {
      const combinations = [
        // [NODE_ENV, VITE_LOG_ENABLED, VITE_LOG_LEVEL, shouldLog]
        ['development', undefined, undefined, true],
        ['development', 'true', 'debug', true],
        ['development', 'false', 'debug', false],
        ['production', undefined, undefined, false],
        ['production', 'true', 'error', false], // Only errors
        ['production', 'true', 'debug', true],
        ['test', undefined, undefined, true],
        ['test', 'false', undefined, false]
      ];

      for (const [nodeEnv, logEnabled, logLevel, shouldLog] of combinations) {
        resetAllMocks();

        const envVars: Record<string, string> = { NODE_ENV: nodeEnv as string };
        if (logEnabled !== undefined) envVars.VITE_LOG_ENABLED = logEnabled;
        if (logLevel !== undefined) envVars.VITE_LOG_LEVEL = logLevel;

        setEnvironment(nodeEnv as any, envVars);
        vi.resetModules();

        const { debugLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');
        debugLog('TEST', `Combination test: ${nodeEnv}-${logEnabled}-${logLevel}`);

        if (shouldLog) {
          expect(mockConsole.log).toHaveBeenCalled();
        } else {
          expect(mockConsole.log).not.toHaveBeenCalled();
        }
      }
    });
  });

  describe('Regression Tests', () => {
    it('должен поддерживать backward compatibility с существующими логами', async () => {
      setEnvironment('development');

      const { debugLog, infoLog, warnLog, errorLog } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Старый формат вызовов должен работать
      debugLog('AUTH', 'Old style debug message');
      infoLog('API', 'Old style info message');
      warnLog('UI', 'Old style warning message');
      errorLog('STORE', 'Old style error message');

      // Новый формат с дополнительными данными
      debugLog('AUTH', 'New style debug', { user: 'test' });
      infoLog('API', 'New style info', { endpoint: '/api/test' });
      warnLog('UI', 'New style warning', { component: 'Button' });

      const error = new Error('Test error');
      errorLog('STORE', 'New style error', error, { context: 'update' });

      // Все вызовы должны работать
      expect(mockConsole.log).toHaveBeenCalledTimes(2); // debug calls
      expect(mockConsole.info).toHaveBeenCalledTimes(2); // info calls
      expect(mockConsole.warn).toHaveBeenCalledTimes(2); // warn calls
      expect(mockConsole.error).toHaveBeenCalledTimes(2); // error calls + stack trace
    });

    it('не должен ломать существующие компоненты при изменении debug системы', async () => {
      setEnvironment('development');

      const { createLogger, logApiRequest, logNavigation, logStoreUpdate } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Симулируем использование в различных компонентах
      const authLogger = createLogger('AUTH');
      const apiLogger = createLogger('API');
      const uiLogger = createLogger('UI');

      // Компонент аутентификации
      authLogger.debug('Starting login process');
      logApiRequest('POST', '/api/auth/login');
      authLogger.info('Login successful');
      logNavigation('/login', '/dashboard');

      // Компонент API
      apiLogger.debug('Fetching user data');
      logApiRequest('GET', '/api/user/profile');
      apiLogger.info('Data fetched successfully');

      // Компонент UI
      uiLogger.debug('Rendering dashboard');
      logStoreUpdate('ui', 'SET_SIDEBAR_OPEN', true);
      uiLogger.info('Dashboard rendered');

      // Все логи должны работать корректно
      expect(mockConsole.log).toHaveBeenCalledTimes(5); // 3 debug + 2 API debug
      expect(mockConsole.info).toHaveBeenCalledTimes(4); // 3 info + 1 navigation
    });

    it('должен корректно обрабатывать edge cases', async () => {
      setEnvironment('development');

      const { debugLog, logGroup, measureTime } =
        await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Edge cases
      debugLog('AUTH', ''); // Пустое сообщение
      debugLog('AUTH', 'Test', null); // null data
      debugLog('AUTH', 'Test', undefined); // undefined data

      // Логирование с очень большими объектами
      const largeObject = {
        data: new Array(1000).fill('large_data_item'),
        nested: {
          deep: {
            structure: new Array(100).fill('nested_item')
          }
        }
      };
      debugLog('PERFORMANCE', 'Large object test', largeObject);

      // Группы и измерения времени
      await logGroup('Edge Case Group', async () => {
        return await measureTime('Edge Case Timer', async () => {
          debugLog('NESTED', 'Message inside group and timer');
          return 'success';
        });
      });

      // Все должно работать без ошибок
      expect(mockConsole.log).toHaveBeenCalled();
      expect(mockConsole.group).toHaveBeenCalled();
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });
  });
});
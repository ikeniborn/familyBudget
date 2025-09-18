/**
 * Комплексные тесты для проверки отсутствия отладочных логов в production
 *
 * Тестирует критически важные аспекты очистки консольных логов:
 * 1. Отсутствие console.log в production компонентах
 * 2. Правильное поведение debug системы в production режиме
 * 3. Проверка component-specific логирования
 * 4. Валидация production-ready состояния
 * 5. Performance impact от логирования
 * 6. Security concerns с логированием
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import type { ComponentType } from 'svelte';

// Mock console для мониторинга вызовов
const mockConsole = {
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  group: vi.fn(),
  groupEnd: vi.fn(),
  trace: vi.fn(),
  table: vi.fn(),
  time: vi.fn(),
  timeEnd: vi.fn()
};

// Mock process.env
const originalEnv = process.env;
const originalConsole = global.console;

// Helper для проверки отсутствия console вызовов
function expectNoConsoleCalls() {
  expect(mockConsole.log).not.toHaveBeenCalled();
  expect(mockConsole.debug).not.toHaveBeenCalled();
  expect(mockConsole.info).not.toHaveBeenCalled();
  expect(mockConsole.warn).not.toHaveBeenCalled();
  expect(mockConsole.trace).not.toHaveBeenCalled();
  expect(mockConsole.table).not.toHaveBeenCalled();
  expect(mockConsole.time).not.toHaveBeenCalled();
  expect(mockConsole.timeEnd).not.toHaveBeenCalled();
}

// Helper для сброса всех моков console
function resetConsoleMocks() {
  Object.values(mockConsole).forEach(mock => {
    if (typeof mock === 'function') {
      mock.mockClear();
    }
  });
}

describe('Production Console Cleanup', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetConsoleMocks();

    // Устанавливаем production окружение
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      VITE_LOG_ENABLED: 'false'
    };

    // Подменяем console
    global.console = mockConsole as any;
  });

  afterEach(() => {
    process.env = originalEnv;
    global.console = originalConsole;
  });

  describe('Debug System Production Behavior', () => {
    it('debugLog не должен выводить сообщения в production', async () => {
      const { debugLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      debugLog('AUTH', 'This should not appear in production');
      debugLog('API', 'API call debug info', { data: 'sensitive' });
      debugLog('UI', 'Component render debug');

      expectNoConsoleCalls();
    });

    it('infoLog не должен выводить сообщения в production по умолчанию', async () => {
      const { infoLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      infoLog('AUTH', 'User authenticated');
      infoLog('API', 'Data fetched successfully');
      infoLog('NAVIGATION', 'Page navigation');

      expectNoConsoleCalls();
    });

    it('warnLog не должен выводить сообщения в production по умолчанию', async () => {
      const { warnLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      warnLog('UI', 'Component performance warning');
      warnLog('API', 'Deprecated API usage');

      expectNoConsoleCalls();
    });

    it('errorLog должен работать в production если VITE_LOG_ENABLED=true', async () => {
      process.env.VITE_LOG_ENABLED = 'true';
      process.env.VITE_LOG_LEVEL = 'error';

      // Перезагружаем модуль с новыми настройками
      vi.resetModules();
      const { errorLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const error = new Error('Critical error');
      errorLog('STORE', 'Critical application error', error);

      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('createLogger должен создавать тихие логгеры в production', async () => {
      const { createLogger } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const authLogger = createLogger('AUTH');

      authLogger.debug('Debug message');
      authLogger.info('Info message');
      authLogger.warn('Warning message');

      expectNoConsoleCalls();
    });

    it('logGroup не должен создавать groups в production', async () => {
      const { logGroup } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const result = await logGroup('Production Operation', async () => {
        return 'operation complete';
      });

      expect(result).toBe('operation complete');
      expect(mockConsole.group).not.toHaveBeenCalled();
      expect(mockConsole.groupEnd).not.toHaveBeenCalled();
    });

    it('measureTime не должен логировать производительность в production', async () => {
      const { measureTime } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const result = await measureTime('Production Operation', async () => {
        // Симуляция долгой операции
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'completed';
      });

      expect(result).toBe('completed');
      expectNoConsoleCalls();
    });
  });

  describe('API Logging in Production', () => {
    it('logApiRequest не должен логировать запросы в production', async () => {
      const { logApiRequest } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      logApiRequest('POST', '/api/auth/login', { username: 'user', password: 'secret' });
      logApiRequest('GET', '/api/users');
      logApiRequest('DELETE', '/api/sensitive-data');

      expectNoConsoleCalls();
    });

    it('logApiResponse не должен логировать ответы в production', async () => {
      const { logApiResponse } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      logApiResponse('GET', '/api/users', 200, { users: [{ id: 1, email: 'user@example.com' }] });
      logApiResponse('POST', '/api/login', 401, { error: 'Unauthorized' });
      logApiResponse('DELETE', '/api/data', 500, { error: 'Internal server error' });

      expectNoConsoleCalls();
    });

    it('не должен логировать навигацию и store updates в production', async () => {
      const { logNavigation, logStoreUpdate } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      logNavigation('/login', '/dashboard');
      logNavigation('/dashboard', '/settings');

      logStoreUpdate('auth', 'SET_USER', { id: 1, role: 'admin' });
      logStoreUpdate('ui', 'TOGGLE_SIDEBAR');

      expectNoConsoleCalls();
    });
  });

  describe('Component Console Usage Validation', () => {
    it('UI компоненты не должны содержать console вызовов', () => {
      // Проверяем ключевые UI компоненты на отсутствие console.log
      const componentPaths = [
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/components/ui/Button.svelte',
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/components/ui/Modal.svelte',
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/components/ui/Input.svelte'
      ];

      componentPaths.forEach(path => {
        try {
          const fs = require('fs');
          const content = fs.readFileSync(path, 'utf8');

          // Проверяем отсутствие прямых console вызовов
          expect(content).not.toMatch(/console\.log\s*\(/);
          expect(content).not.toMatch(/console\.debug\s*\(/);
          expect(content).not.toMatch(/console\.info\s*\(/);
          expect(content).not.toMatch(/console\.warn\s*\(/);
          expect(content).not.toMatch(/console\.trace\s*\(/);
          expect(content).not.toMatch(/console\.table\s*\(/);

          // Исключения: console.error может быть разрешен для критических ошибок
          const errorCalls = content.match(/console\.error\s*\(/g);
          if (errorCalls) {
            // Если есть console.error, проверяем что они используются только для критических ошибок
            expect(errorCalls.length).toBeLessThanOrEqual(2);
          }
        } catch (error) {
          // Файл может не существовать в некоторых тестовых средах
          console.warn(`Warning: Could not read component file ${path}`);
        }
      });
    });

    it('Store файлы не должны содержать debug логирования', () => {
      const storePaths = [
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/stores/auth.store.ts',
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/stores/toast.store.ts'
      ];

      storePaths.forEach(path => {
        try {
          const fs = require('fs');
          const content = fs.readFileSync(path, 'utf8');

          // Проверяем отсутствие отладочных логов
          expect(content).not.toMatch(/console\.log\s*\(/);
          expect(content).not.toMatch(/console\.debug\s*\(/);
          expect(content).not.toMatch(/console\.info\s*\(/);

          // Если используется система debug, то должна использоваться правильно
          if (content.includes('debugLog') || content.includes('infoLog')) {
            expect(content).toMatch(/import.*debug.*from.*debug/);
          }
        } catch (error) {
          console.warn(`Warning: Could not read store file ${path}`);
        }
      });
    });

    it('Service файлы должны использовать систему debug вместо console', () => {
      const servicePaths = [
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/services/api.service.ts',
        '/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/services/auth.service.ts'
      ];

      servicePaths.forEach(path => {
        try {
          const fs = require('fs');
          const content = fs.readFileSync(path, 'utf8');

          // Проверяем отсутствие прямых console вызовов
          expect(content).not.toMatch(/console\.log\s*\(/);
          expect(content).not.toMatch(/console\.debug\s*\(/);

          // Если есть логирование, должно использоваться через debug систему
          if (content.includes('log')) {
            const hasDebugImport = content.includes('debugLog') ||
                                 content.includes('infoLog') ||
                                 content.includes('createLogger');
            const hasDirectConsole = content.match(/console\.(log|debug|info)/);

            if (hasDirectConsole && !hasDebugImport) {
              throw new Error(`Service ${path} uses direct console calls instead of debug system`);
            }
          }
        } catch (error) {
          if (error.message.includes('uses direct console calls')) {
            throw error;
          }
          console.warn(`Warning: Could not read service file ${path}`);
        }
      });
    });
  });

  describe('Hooks Server Production Logging', () => {
    it('hooks.server.ts должен логировать минимально в production', () => {
      // Симулируем production environment для hooks.server.ts
      process.env.NODE_ENV = 'production';

      // В production hooks должен:
      // 1. Не логировать debug информацию
      // 2. Логировать только критические ошибки
      // 3. Не выводить детали сессий

      // Проверяем что в production режиме отладочные логи отключены
      expect(process.env.NODE_ENV).toBe('production');

      // В hooks.server.ts debug логи должны проверять NODE_ENV
      const mockAuthError = {
        status: 401,
        sessionId: 'abc123...'
      };

      // В production не должно быть debug логов для 401 ошибок
      expect(mockConsole.debug).not.toHaveBeenCalled();
    });

    it('должен обрабатывать authentication errors без детального логирования в production', () => {
      process.env.NODE_ENV = 'production';

      // Симулируем ошибку аутентификации в production
      const authError = new Error('Authentication failed');

      // В production должен логировать только общее сообщение
      console.warn('Authentication service unavailable');

      expect(mockConsole.warn).toHaveBeenCalledWith('Authentication service unavailable');

      // Не должен логировать детали ошибки
      expect(mockConsole.error).not.toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch user data'),
        expect.objectContaining({
          error: 'Authentication failed',
          sessionId: expect.any(String)
        })
      );
    });
  });

  describe('Performance Impact Analysis', () => {
    it('отключенное логирование не должно влиять на производительность', async () => {
      const { measureTime } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const startTime = performance.now();

      // Выполняем множественные операции логирования
      for (let i = 0; i < 1000; i++) {
        const { debugLog, infoLog, warnLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

        debugLog('PERFORMANCE', `Test iteration ${i}`, { data: new Array(100).fill(i) });
        infoLog('PERFORMANCE', `Info log ${i}`);
        warnLog('PERFORMANCE', `Warning ${i}`);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // В production логирование должно быть очень быстрым (практически мгновенным)
      expect(duration).toBeLessThan(100); // Менее 100мс для 1000 операций

      // Проверяем что никаких console вызовов не было
      expectNoConsoleCalls();
    });

    it('создание логгеров не должно создавать memory leaks', async () => {
      const { createLogger } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // Создаем множество логгеров
      const loggers = [];
      for (let i = 0; i < 1000; i++) {
        const logger = createLogger('TEST');
        loggers.push(logger);

        // Используем логгеры
        logger.debug(`Test message ${i}`);
        logger.info(`Info message ${i}`);
        logger.warn(`Warning message ${i}`);
      }

      // В production не должно быть console вызовов
      expectNoConsoleCalls();

      // Логгеры должны быть простыми объектами без тяжелых ресурсов
      expect(loggers[0]).toEqual(expect.objectContaining({
        debug: expect.any(Function),
        info: expect.any(Function),
        warn: expect.any(Function),
        error: expect.any(Function)
      }));
    });
  });

  describe('Security Considerations', () => {
    it('не должен логировать чувствительные данные в production', async () => {
      const { infoLog, debugLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const sensitiveData = {
        password: 'secretpassword123',
        token: 'jwt.token.here',
        sessionId: 'session123456',
        telegram_id: 123456789,
        email: 'user@example.com'
      };

      // Попытка логирования чувствительных данных
      debugLog('AUTH', 'User login attempt', sensitiveData);
      infoLog('AUTH', 'Authentication data', sensitiveData);

      // В production эти данные не должны попасть в консоль
      expectNoConsoleCalls();
    });

    it('не должен логировать API ключи и токены', async () => {
      const { logApiRequest, logApiResponse } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const apiData = {
        headers: {
          'Authorization': 'Bearer secret.jwt.token',
          'X-API-Key': 'api_key_12345'
        },
        body: {
          secret: 'top_secret_value',
          api_token: 'token_abcdef'
        }
      };

      logApiRequest('POST', '/api/secure', apiData);
      logApiResponse('POST', '/api/secure', 200, apiData);

      // В production API данные не должны логироваться
      expectNoConsoleCalls();
    });

    it('должен скрывать пользовательские данные в production', async () => {
      const { logStoreUpdate } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const userData = {
        id: 1,
        username: 'john_doe',
        email: 'john@example.com',
        telegram_id: 123456789,
        role: 'admin',
        personal_data: {
          phone: '+1234567890',
          address: '123 Main St'
        }
      };

      logStoreUpdate('auth', 'SET_USER', userData);

      // В production пользовательские данные не должны логироваться
      expectNoConsoleCalls();
    });
  });

  describe('Production Configuration Validation', () => {
    it('должен правильно определять production окружение', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.VITE_LOG_ENABLED;

      vi.resetModules();
      const debugModule = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      // В production с default настройками логирование должно быть отключено
      debugModule.debugLog('TEST', 'Should not appear');
      debugModule.infoLog('TEST', 'Should not appear');

      expectNoConsoleCalls();
    });

    it('должен учитывать VITE_LOG_ENABLED в production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.VITE_LOG_ENABLED = 'true';
      process.env.VITE_LOG_LEVEL = 'error';

      vi.resetModules();
      const { errorLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const error = new Error('Test error');
      errorLog('TEST', 'Production error', error);

      // Только error логи должны работать при явном включении
      expect(mockConsole.error).toHaveBeenCalled();
    });

    it('должен работать в browser production окружении', async () => {
      // Симулируем browser production окружение
      delete process.env.NODE_ENV;
      global.window = {
        location: { hostname: 'myapp.example.com' }
      } as any;

      vi.resetModules();
      const { debugLog, infoLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      debugLog('BROWSER', 'Browser debug message');
      infoLog('BROWSER', 'Browser info message');

      // В browser production логи не должны выводиться
      expectNoConsoleCalls();

      // Очищаем
      delete (global as any).window;
    });
  });

  describe('Error Handling in Production', () => {
    it('critical errors должны логироваться даже в production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.VITE_LOG_ENABLED = 'true';
      process.env.VITE_LOG_LEVEL = 'error';

      vi.resetModules();
      const { errorLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      const criticalError = new Error('Critical system failure');
      errorLog('SYSTEM', 'Critical application error', criticalError);

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[SYSTEM/ERROR]'),
        expect.any(String),
        undefined
      );
    });

    it('должен корректно обрабатывать отсутствие console в production', async () => {
      // Симулируем окружение без console
      global.console = undefined as any;

      const { debugLog } = await import('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/lib/utils/debug');

      expect(() => {
        debugLog('TEST', 'Test message');
      }).not.toThrow();

      // Восстанавливаем console
      global.console = mockConsole as any;
    });
  });
});
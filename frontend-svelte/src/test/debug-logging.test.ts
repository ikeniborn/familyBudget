/**
 * Комплексные тесты для централизованной системы логирования debug.ts
 *
 * Тестирует все функции системы логирования:
 * 1. Базовые функции логирования (debug, info, warn, error)
 * 2. Конфигурация и фильтрация по окружению
 * 3. Категоризация логов
 * 4. Специализированные логгеры
 * 5. Производительность и кэширование
 * 6. API и навигационное логирование
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  debugLog,
  infoLog,
  warnLog,
  errorLog,
  createLogger,
  logApiRequest,
  logApiResponse,
  logNavigation,
  logStoreUpdate,
  logGroup,
  measureTime,
  type LogCategory,
  type LogLevel
} from '$lib/utils/debug';

// Mock console
const mockConsole = {
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  group: vi.fn(),
  groupEnd: vi.fn()
};

// Mock performance
const mockPerformance = {
  now: vi.fn()
};

// Mock process.env и window
const originalProcess = global.process;
const originalWindow = global.window;
const originalConsole = global.console;
const originalPerformance = global.performance;

describe('Debug Logging System', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    // Mock console
    global.console = mockConsole as any;

    // Mock performance
    global.performance = mockPerformance as any;

    // Mock process.env
    global.process = {
      env: {
        NODE_ENV: 'development',
        VITE_LOG_ENABLED: 'true',
        VITE_LOG_LEVEL: 'debug',
        VITE_LOG_CATEGORIES: 'AUTH,API,UI,NAVIGATION,STORE,GENERAL',
        VITE_LOG_TIMESTAMP: 'true',
        VITE_LOG_STACK_TRACE: 'true'
      }
    } as any;

    // Mock Date для стабильных временных меток
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-09-19T10:30:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    global.process = originalProcess;
    global.window = originalWindow;
    global.console = originalConsole;
    global.performance = originalPerformance;
  });

  describe('Basic Logging Functions', () => {
    it('debugLog должен выводить debug сообщения', () => {
      debugLog('AUTH', 'Test debug message', { user: 'test' });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('🐛 🔐 [AUTH/DEBUG]'),
        expect.stringContaining('color:'),
        { user: 'test' }
      );
    });

    it('infoLog должен выводить info сообщения', () => {
      infoLog('API', 'Test info message');

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('ℹ️ 🌐 [API/INFO]'),
        expect.stringContaining('color:')
      );
    });

    it('warnLog должен выводить warning сообщения', () => {
      warnLog('UI', 'Test warning message', { component: 'Button' });

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ 🎨 [UI/WARN]'),
        expect.stringContaining('color:'),
        { component: 'Button' }
      );
    });

    it('errorLog должен выводить error сообщения', () => {
      const error = new Error('Test error');
      errorLog('STORE', 'Test error message', error, { action: 'update' });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ 💾 [STORE/ERROR]'),
        expect.stringContaining('color:'),
        { action: 'update' }
      );

      // Проверяем вывод stack trace
      expect(mockConsole.error).toHaveBeenCalledWith(
        'Stack trace:',
        error.stack
      );
    });

    it('должен включать временную метку в сообщения', () => {
      infoLog('GENERAL', 'Test message');

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[2025-09-19 10:30:00.000]'),
        expect.any(String)
      );
    });

    it('должен использовать правильные эмоджи для категорий', () => {
      const categories: { [key in LogCategory]: string } = {
        AUTH: '🔐',
        API: '🌐',
        UI: '🎨',
        NAVIGATION: '🧭',
        STORE: '💾',
        GENERAL: '📝'
      };

      Object.entries(categories).forEach(([category, emoji]) => {
        mockConsole.info.mockClear();
        infoLog(category as LogCategory, 'Test message');

        expect(mockConsole.info).toHaveBeenCalledWith(
          expect.stringContaining(emoji),
          expect.any(String)
        );
      });
    });
  });

  describe('Environment Configuration', () => {
    it('должен отключать логирование в production по умолчанию', () => {
      global.process.env.NODE_ENV = 'production';
      delete global.process.env.VITE_LOG_ENABLED;

      debugLog('AUTH', 'Should not appear');

      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('должен включать логирование в production если VITE_LOG_ENABLED=true', () => {
      global.process.env.NODE_ENV = 'production';
      global.process.env.VITE_LOG_ENABLED = 'true';

      infoLog('API', 'Should appear in production');

      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('должен фильтровать по уровню логирования', () => {
      global.process.env.VITE_LOG_LEVEL = 'warn';

      debugLog('AUTH', 'Debug message');
      infoLog('AUTH', 'Info message');
      warnLog('AUTH', 'Warning message');
      errorLog('AUTH', 'Error message');

      expect(mockConsole.log).not.toHaveBeenCalled(); // debug
      expect(mockConsole.info).not.toHaveBeenCalled(); // info
      expect(mockConsole.warn).toHaveBeenCalled(); // warn
      expect(mockConsole.error).toHaveBeenCalled(); // error
    });

    it('должен фильтровать по категориям', () => {
      global.process.env.VITE_LOG_CATEGORIES = 'AUTH,API';

      infoLog('AUTH', 'Auth message');
      infoLog('API', 'API message');
      infoLog('UI', 'UI message');
      infoLog('STORE', 'Store message');

      expect(mockConsole.info).toHaveBeenCalledTimes(2);
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH/INFO]'),
        expect.any(String)
      );
      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[API/INFO]'),
        expect.any(String)
      );
    });

    it('должен отключать временные метки если VITE_LOG_TIMESTAMP=false', () => {
      global.process.env.VITE_LOG_TIMESTAMP = 'false';

      infoLog('GENERAL', 'Test message');

      const call = mockConsole.info.mock.calls[0];
      expect(call[0]).not.toContain('[2025-09-19');
    });

    it('должен отключать stack trace если VITE_LOG_STACK_TRACE=false', () => {
      global.process.env.VITE_LOG_STACK_TRACE = 'false';

      const error = new Error('Test error');
      errorLog('STORE', 'Error message', error);

      expect(mockConsole.error).toHaveBeenCalledTimes(1);
      expect(mockConsole.error).not.toHaveBeenCalledWith(
        'Stack trace:',
        expect.any(String)
      );
    });
  });

  describe('Browser Environment Detection', () => {
    it('должен определять development окружение в браузере', () => {
      delete global.process;
      global.window = {
        location: { hostname: 'localhost' }
      } as any;

      infoLog('GENERAL', 'Browser dev message');

      expect(mockConsole.info).toHaveBeenCalled();
    });

    it('должен определять production окружение в браузере', () => {
      delete global.process;
      global.window = {
        location: { hostname: 'example.com' }
      } as any;

      debugLog('GENERAL', 'Browser prod message');

      expect(mockConsole.log).not.toHaveBeenCalled();
    });

    it('должен работать без window и process (fallback)', () => {
      delete global.process;
      delete global.window;

      // В fallback режиме считается production
      debugLog('GENERAL', 'Fallback message');

      expect(mockConsole.log).not.toHaveBeenCalled();
    });
  });

  describe('createLogger Function', () => {
    it('должен создавать специализированный логгер для категории', () => {
      const authLogger = createLogger('AUTH');

      authLogger.debug('Debug message', { test: true });
      authLogger.info('Info message');
      authLogger.warn('Warning message', { component: 'login' });
      authLogger.error('Error message', new Error('Test'), { context: 'auth' });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH/DEBUG]'),
        expect.any(String),
        { test: true }
      );

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH/INFO]'),
        expect.any(String)
      );

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH/WARN]'),
        expect.any(String),
        { component: 'login' }
      );

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[AUTH/ERROR]'),
        expect.any(String),
        { context: 'auth' }
      );
    });
  });

  describe('API Logging Functions', () => {
    it('logApiRequest должен логировать API запросы', () => {
      logApiRequest('POST', '/api/auth/login', { username: 'test' });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[API/DEBUG]'),
        expect.stringContaining('POST /api/auth/login'),
        { username: 'test' }
      );
    });

    it('logApiResponse должен логировать успешные ответы как info', () => {
      logApiResponse('GET', '/api/users', 200, { users: [] });

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[API/INFO]'),
        expect.stringContaining('GET /api/users - 200'),
        { users: [] }
      );
    });

    it('logApiResponse должен логировать ошибки клиента как error', () => {
      logApiResponse('POST', '/api/login', 401, { error: 'Unauthorized' });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[API/ERROR]'),
        expect.stringContaining('POST /api/login - 401'),
        undefined,
        { error: 'Unauthorized' }
      );
    });

    it('logApiResponse должен логировать редиректы как warn', () => {
      logApiResponse('GET', '/api/redirect', 302, { location: '/new-url' });

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('[API/WARN]'),
        expect.stringContaining('GET /api/redirect - 302'),
        { location: '/new-url' }
      );
    });
  });

  describe('Navigation Logging', () => {
    it('logNavigation должен логировать переходы между страницами', () => {
      logNavigation('/login', '/dashboard');

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('[NAVIGATION/INFO]'),
        expect.stringContaining('Navigation: /login → /dashboard')
      );
    });
  });

  describe('Store Logging', () => {
    it('logStoreUpdate должен логировать изменения в store', () => {
      logStoreUpdate('auth', 'SET_USER', { id: 1, name: 'John' });

      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[STORE/DEBUG]'),
        expect.stringContaining('auth: SET_USER'),
        { id: 1, name: 'John' }
      );
    });
  });

  describe('Log Grouping', () => {
    it('logGroup должен группировать связанные логи', async () => {
      const result = await logGroup('User Authentication', async () => {
        debugLog('AUTH', 'Starting authentication');
        infoLog('AUTH', 'Authentication completed');
        return 'success';
      });

      expect(mockConsole.group).toHaveBeenCalledWith('🔍 User Authentication');
      expect(mockConsole.groupEnd).toHaveBeenCalled();
      expect(result).toBe('success');
    });

    it('logGroup должен корректно обрабатывать ошибки', async () => {
      const error = new Error('Auth failed');

      await expect(
        logGroup('Failed Authentication', async () => {
          throw error;
        })
      ).rejects.toThrow('Auth failed');

      expect(mockConsole.group).toHaveBeenCalled();
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });

    it('logGroup должен работать с синхронными функциями', async () => {
      const result = await logGroup('Sync Operation', () => {
        return 42;
      });

      expect(result).toBe(42);
      expect(mockConsole.group).toHaveBeenCalled();
      expect(mockConsole.groupEnd).toHaveBeenCalled();
    });

    it('logGroup должен работать без console.group support', async () => {
      delete mockConsole.group;
      delete mockConsole.groupEnd;

      const result = await logGroup('No Group Support', () => 'test');

      expect(result).toBe('test');
    });
  });

  describe('Performance Measurement', () => {
    beforeEach(() => {
      mockPerformance.now
        .mockReturnValueOnce(1000) // Start time
        .mockReturnValueOnce(1250); // End time
    });

    it('measureTime должен измерять время выполнения успешных операций', async () => {
      const result = await measureTime('API Request', async () => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('[GENERAL/DEBUG]'),
        expect.stringContaining('⏱️ API Request completed in 250ms')
      );
    });

    it('measureTime должен измерять время выполнения неудачных операций', async () => {
      const error = new Error('Operation failed');

      await expect(
        measureTime('Failed Operation', async () => {
          throw error;
        })
      ).rejects.toThrow('Operation failed');

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[GENERAL/ERROR]'),
        expect.stringContaining('⏱️ Failed Operation failed after 250ms'),
        error,
        undefined
      );
    });

    it('measureTime должен работать с синхронными функциями', async () => {
      const result = await measureTime('Sync Calculation', () => {
        return 42;
      });

      expect(result).toBe(42);
      expect(mockConsole.log).toHaveBeenCalledWith(
        expect.stringContaining('⏱️ Sync Calculation completed in 250ms'),
        expect.any(String)
      );
    });
  });

  describe('Color and Styling', () => {
    it('должен использовать правильные цвета для уровней логирования', () => {
      debugLog('GENERAL', 'Debug message');
      infoLog('GENERAL', 'Info message');
      warnLog('GENERAL', 'Warning message');
      errorLog('GENERAL', 'Error message');

      const debugCall = mockConsole.log.mock.calls[0];
      const infoCall = mockConsole.info.mock.calls[0];
      const warnCall = mockConsole.warn.mock.calls[0];
      const errorCall = mockConsole.error.mock.calls[0];

      expect(debugCall[1]).toContain('color: #9E9E9E'); // debug color
      expect(infoCall[1]).toContain('color: #2196F3'); // info color
      expect(warnCall[1]).toContain('color: #FF9800'); // warn color
      expect(errorCall[1]).toContain('color: #F44336'); // error color
    });

    it('должен применять жирный шрифт к сообщениям', () => {
      infoLog('GENERAL', 'Test message');

      const call = mockConsole.info.mock.calls[0];
      expect(call[1]).toContain('font-weight: bold');
    });
  });

  describe('Message Formatting', () => {
    it('должен правильно форматировать сообщения с данными', () => {
      const testData = { id: 1, name: 'Test' };
      infoLog('API', 'User data fetched', testData);

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('🌐 [API/INFO] User data fetched'),
        expect.any(String),
        testData
      );
    });

    it('должен правильно форматировать сообщения без данных', () => {
      infoLog('NAVIGATION', 'Page loaded');

      expect(mockConsole.info).toHaveBeenCalledWith(
        expect.stringContaining('🧭 [NAVIGATION/INFO] Page loaded'),
        expect.any(String)
      );
    });

    it('должен включать все компоненты в форматированное сообщение', () => {
      infoLog('AUTH', 'Login successful');

      const call = mockConsole.info.mock.calls[0];
      const message = call[0];

      expect(message).toContain('[2025-09-19 10:30:00.000]'); // timestamp
      expect(message).toContain('ℹ️'); // level emoji
      expect(message).toContain('🔐'); // category emoji
      expect(message).toContain('[AUTH/INFO]'); // category/level
      expect(message).toContain('Login successful'); // message
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('должен обрабатывать отсутствие console', () => {
      global.console = undefined as any;

      expect(() => {
        infoLog('GENERAL', 'Test message');
      }).not.toThrow();
    });

    it('должен обрабатывать отсутствие performance', () => {
      global.performance = undefined as any;

      expect(() => {
        measureTime('Test operation', () => 'result');
      }).toThrow(); // performance.now is required
    });

    it('должен обрабатывать неправильные переменные окружения', () => {
      global.process.env.VITE_LOG_LEVEL = 'invalid_level';
      global.process.env.VITE_LOG_CATEGORIES = '';

      // Должен использовать значения по умолчанию
      infoLog('GENERAL', 'Test message');

      expect(mockConsole.info).toHaveBeenCalled();
    });
  });

  describe('Log Level Priority', () => {
    it('должен правильно определять приоритеты уровней', () => {
      const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

      levels.forEach((level, index) => {
        global.process.env.VITE_LOG_LEVEL = level;

        mockConsole.log.mockClear();
        mockConsole.info.mockClear();
        mockConsole.warn.mockClear();
        mockConsole.error.mockClear();

        debugLog('GENERAL', 'Debug message');
        infoLog('GENERAL', 'Info message');
        warnLog('GENERAL', 'Warning message');
        errorLog('GENERAL', 'Error message');

        // Проверяем, что выводятся только сообщения с приоритетом >= текущего уровня
        if (index <= 0) expect(mockConsole.log).toHaveBeenCalled(); // debug
        else expect(mockConsole.log).not.toHaveBeenCalled();

        if (index <= 1) expect(mockConsole.info).toHaveBeenCalled(); // info
        else expect(mockConsole.info).not.toHaveBeenCalled();

        if (index <= 2) expect(mockConsole.warn).toHaveBeenCalled(); // warn
        else expect(mockConsole.warn).not.toHaveBeenCalled();

        expect(mockConsole.error).toHaveBeenCalled(); // error всегда выводится
      });
    });
  });
});
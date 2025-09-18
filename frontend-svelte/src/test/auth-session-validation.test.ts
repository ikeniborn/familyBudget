/**
 * Комплексные тесты для валидации sessionId в hooks.server.ts
 *
 * Тестирует критически важные изменения в системе аутентификации:
 * 1. Валидация sessionId перед API запросами
 * 2. Обработка различных форматов cookies
 * 3. Правильное логирование ошибок 401
 * 4. Безопасность и производительность валидации
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Handle } from '@sveltejs/kit';

// Mock fetch для тестирования API запросов
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock console методов
const originalConsole = { ...console };
const mockConsole = {
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  log: vi.fn()
};

// Mock process.env
const originalEnv = process.env;

describe('Hooks Server - Session Validation', () => {
  let handle: Handle;
  let mockEvent: any;
  let mockResolve: any;

  beforeEach(() => {
    vi.resetAllMocks();

    // Подменяем console
    Object.assign(console, mockConsole);

    // Сбрасываем environment
    process.env = { ...originalEnv };

    // Импортируем handle после подмены моков
    handle = require('/home/ikeniborn/Documents/Project/familyBudget/frontend-svelte/src/hooks.server.ts').handle;

    // Настраиваем базовые моки
    mockEvent = {
      cookies: {
        get: vi.fn()
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

    mockResolve = vi.fn().mockResolvedValue({
      headers: {
        set: vi.fn()
      }
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        user: {
          id: 1,
          username: 'testuser',
          role: 'user'
        }
      })
    });
  });

  afterEach(() => {
    // Восстанавливаем console
    Object.assign(console, originalConsole);
    process.env = originalEnv;
  });

  describe('Session ID Validation', () => {
    it('должен валидировать корректный sessionId', async () => {
      const validSessionId = 'abcd1234567890efghij';
      mockEvent.cookies.get.mockReturnValue(validSessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockEvent.locals.sessionId).toBe(validSessionId);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/auth/me'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': `connect.sid=${validSessionId}`
          })
        })
      );
    });

    it('должен отклонять sessionId с недостаточной длиной', async () => {
      const shortSessionId = 'short123';
      mockEvent.cookies.get.mockReturnValue(shortSessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(false);
      expect(mockEvent.locals.sessionId).toBe(shortSessionId);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('должен отклонять sessionId с недопустимыми символами', async () => {
      const invalidSessionId = 'invalid@session#id$';
      mockEvent.cookies.get.mockReturnValue(invalidSessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('должен отклонять строковые примитивы как sessionId', async () => {
      const primitiveValues = ['undefined', 'null', 'false', 'true', 'NULL', 'FALSE'];

      for (const primitive of primitiveValues) {
        mockEvent.cookies.get.mockReturnValue(primitive);

        await handle({ event: mockEvent, resolve: mockResolve });

        expect(mockEvent.locals.authenticated).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
      }
    });

    it('должен принимать base64-подобные sessionId', async () => {
      const base64SessionId = 'YWJjZGVmZ2hpams1678901234567890+/=';
      mockEvent.cookies.get.mockReturnValue(base64SessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(true);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('должен обрабатывать отсутствующий sessionId', async () => {
      mockEvent.cookies.get.mockReturnValue(undefined);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.authenticated).toBe(false);
      expect(mockEvent.locals.sessionId).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Cookie Format Handling', () => {
    it('должен обрабатывать connect.sid cookie', async () => {
      const sessionId = 'abcd1234567890efghij';
      mockEvent.cookies.get.mockImplementation((name: string) => {
        return name === 'connect.sid' ? sessionId : undefined;
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': `connect.sid=${sessionId}`
          })
        })
      );
    });

    it('должен обрабатывать familybudget.sid cookie', async () => {
      const sessionId = 'abcd1234567890efghij';
      mockEvent.cookies.get.mockImplementation((name: string) => {
        return name === 'familybudget.sid' ? sessionId : undefined;
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': `familybudget.sid=${sessionId}`
          })
        })
      );
    });

    it('должен приоритизировать connect.sid над familybudget.sid', async () => {
      const connectSid = 'connect1234567890abcdef';
      const familySid = 'family1234567890abcdef';

      mockEvent.cookies.get.mockImplementation((name: string) => {
        if (name === 'connect.sid') return connectSid;
        if (name === 'familybudget.sid') return familySid;
        return undefined;
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': `connect.sid=${connectSid}`
          })
        })
      );
    });

    it('должен очищать префиксы и суффиксы из sessionId', async () => {
      const rawSessionId = 's:abcd1234567890efghij.signature';
      const cleanSessionId = 'abcd1234567890efghij';

      mockEvent.cookies.get.mockReturnValue(rawSessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.sessionId).toBe(cleanSessionId);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Cookie': `connect.sid=${rawSessionId}`
          })
        })
      );
    });
  });

  describe('API Response Handling', () => {
    it('должен обрабатывать успешный ответ с success: true', async () => {
      const sessionId = 'abcd1234567890efghij';
      const userData = {
        success: true,
        user: {
          id: 1,
          username: 'testuser',
          role: 'admin'
        }
      };

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData)
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual(userData.user);
    });

    it('должен обрабатывать успешный ответ без success флага', async () => {
      const sessionId = 'abcd1234567890efghij';
      const userData = {
        user: {
          id: 2,
          username: 'simpleuser',
          role: 'user'
        }
      };

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData)
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual(userData.user);
    });

    it('должен обрабатывать прямой формат данных пользователя', async () => {
      const sessionId = 'abcd1234567890efghij';
      const userData = {
        id: 3,
        user_id: 3,
        username: 'directuser',
        user_name: 'directuser',
        role: 'user',
        telegram_id: 123456789
      };

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(userData)
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.locals.user).toEqual({
        id: 3,
        username: 'directuser',
        first_name: 'directuser',
        role: 'user',
        telegram_id: '123456789'
      });
    });

    it('должен корректно обрабатывать 401 ошибку без предупреждений', async () => {
      const sessionId = 'abcd1234567890efghij';
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      // Проверяем, что 401 ошибка не вызывает warning
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Session invalid or expired'),
        expect.objectContaining({
          status: 401,
          sessionId: expect.stringContaining('abcd1234...')
        })
      );
    });

    it('должен корректно обрабатывать 403 ошибку без предупреждений', async () => {
      const sessionId = 'abcd1234567890efghij';
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Session invalid or expired'),
        expect.objectContaining({
          status: 403
        })
      );
    });

    it('должен логировать неожиданные HTTP ошибки как warnings', async () => {
      const sessionId = 'abcd1234567890efghij';
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unexpected authentication error'),
        expect.objectContaining({
          status: 500,
          sessionId: expect.stringContaining('abcd1234...')
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('должен обрабатывать сетевые ошибки в development', async () => {
      const sessionId = 'abcd1234567890efghij';
      const networkError = new Error('Network error');
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockRejectedValue(networkError);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch user data'),
        expect.objectContaining({
          error: 'Network error',
          sessionId: expect.stringContaining('abcd1234...'),
          stack: expect.any(String)
        })
      );
    });

    it('должен обрабатывать ошибки в production без детального логирования', async () => {
      const sessionId = 'abcd1234567890efghij';
      const networkError = new Error('Network error');
      process.env.NODE_ENV = 'production';

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockRejectedValue(networkError);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.warn).toHaveBeenCalledWith('Authentication service unavailable');
      expect(mockConsole.error).not.toHaveBeenCalled();
    });

    it('должен обрабатывать неизвестные типы ошибок', async () => {
      const sessionId = 'abcd1234567890efghij';
      const unknownError = 'Unknown error string';
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(sessionId);
      mockFetch.mockRejectedValue(unknownError);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch user data'),
        expect.objectContaining({
          error: 'Unknown error'
        })
      );
    });
  });

  describe('Development Debugging', () => {
    it('должен логировать невалидные сессии в development режиме', async () => {
      const invalidSessionId = 'short';
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(invalidSessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping auth request for invalid session'),
        expect.objectContaining({
          sessionId: expect.stringContaining('short...'),
          length: 5,
          reason: 'Session format validation failed'
        })
      );
    });

    it('не должен логировать невалидные сессии в production', async () => {
      const invalidSessionId = 'short';
      process.env.NODE_ENV = 'production';

      mockEvent.cookies.get.mockReturnValue(invalidSessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.debug).not.toHaveBeenCalled();
    });
  });

  describe('Backend URL Configuration', () => {
    it('должен использовать BACKEND_URL если установлен', async () => {
      const sessionId = 'abcd1234567890efghij';
      const customBackendUrl = 'http://custom-backend:8080';
      process.env.BACKEND_URL = customBackendUrl;

      mockEvent.cookies.get.mockReturnValue(sessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        `${customBackendUrl}/api/auth/me`,
        expect.any(Object)
      );
    });

    it('должен использовать default backend URL если BACKEND_URL не установлен', async () => {
      const sessionId = 'abcd1234567890efghij';
      delete process.env.BACKEND_URL;

      mockEvent.cookies.get.mockReturnValue(sessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://budget-backend:4000/api/auth/me',
        expect.any(Object)
      );
    });
  });

  describe('Performance and Security', () => {
    it('должен обрезать sessionId в логах для безопасности', async () => {
      const longSessionId = 'verylongsessionidwithmanycharacters1234567890';
      process.env.NODE_ENV = 'development';

      mockEvent.cookies.get.mockReturnValue(longSessionId);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401
      });

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockConsole.debug).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          sessionId: 'verylong...'
        })
      );
    });

    it('должен пропускать API запрос для невалидных сессий (производительность)', async () => {
      const invalidSessions = [
        '',
        'short',
        'undefined',
        'null',
        'invalid@symbols#',
        'a'.repeat(5) // Слишком короткий
      ];

      for (const session of invalidSessions) {
        mockEvent.cookies.get.mockReturnValue(session);

        await handle({ event: mockEvent, resolve: mockResolve });

        expect(mockFetch).not.toHaveBeenCalled();
        mockFetch.mockClear();
      }
    });

    it('должен корректно устанавливать User-Agent для backend запросов', async () => {
      const sessionId = 'abcd1234567890efghij';
      mockEvent.cookies.get.mockReturnValue(sessionId);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'SvelteKit-SSR',
            'Accept': 'application/json'
          })
        })
      );
    });
  });

  describe('API Path Handling', () => {
    it('должен устанавливать cookie header для API запросов', async () => {
      mockEvent.url = new URL('http://localhost:5173/api/test');

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.request.headers.set).toHaveBeenCalledWith('cookie', '');
    });

    it('не должен устанавливать cookie header для не-API запросов', async () => {
      mockEvent.url = new URL('http://localhost:5173/dashboard');

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockEvent.request.headers.set).not.toHaveBeenCalled();
    });
  });

  describe('CORS Headers', () => {
    it('должен устанавливать CORS headers для localhost:5173', async () => {
      mockEvent.url = new URL('http://localhost:5173/test');
      const mockResponse = {
        headers: {
          set: vi.fn()
        }
      };

      mockResolve.mockResolvedValue(mockResponse);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      expect(mockResponse.headers.set).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    });

    it('не должен устанавливать CORS headers для других origins', async () => {
      mockEvent.url = new URL('http://example.com/test');
      const mockResponse = {
        headers: {
          set: vi.fn()
        }
      };

      mockResolve.mockResolvedValue(mockResponse);

      await handle({ event: mockEvent, resolve: mockResolve });

      expect(mockResponse.headers.set).not.toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });
  });
});
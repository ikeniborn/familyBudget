import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Извлекаем session cookie для проверки аутентификации на сервере
  // Проверяем различные форматы cookies для максимальной совместимости
  const connectSid = event.cookies.get('connect.sid');
  const familyBudgetSid = event.cookies.get('familybudget.sid');

  // Поддерживаем как прямой session ID, так и форматы с префиксами
  let sessionId = connectSid || familyBudgetSid;

  // Извлекаем session ID из различных форматов
  if (sessionId) {
    // Удаляем возможные префиксы и обертки
    sessionId = sessionId.replace(/^s:/, '').replace(/\..*$/, '');
  }

  // Валидация session ID перед API запросом
  const isValidSession = sessionId &&
    sessionId.length >= 16 && // Минимальная длина для валидного session ID
    !/^(undefined|null|false|true)$/i.test(sessionId) && // Исключаем строковые представления примитивов
    /^[a-zA-Z0-9+/=-]+$/.test(sessionId); // Проверяем формат base64/alphanumeric

  // Добавляем информацию о состоянии аутентификации в locals
  event.locals.authenticated = !!isValidSession;
  event.locals.sessionId = sessionId;

  // Fetch user data for server-side route protection - только для валидных сессий
  if (isValidSession) {
    try {
      // Use correct backend URL for Docker environment
      const backendUrl = process.env.BACKEND_URL || 'http://budget-backend:4000';

      // Формируем правильный cookie header для backend
      const cookieHeader = connectSid
        ? `connect.sid=${connectSid}`
        : familyBudgetSid
        ? `familybudget.sid=${familyBudgetSid}`
        : `connect.sid=s:${sessionId}`;

      const response = await fetch(`${backendUrl}/api/auth/me`, {
        headers: {
          'Cookie': cookieHeader,
          'Accept': 'application/json',
          'User-Agent': 'SvelteKit-SSR'
        }
      });

      if (response.ok) {
        const userData = await response.json();
        // Унифицированная обработка различных форматов ответа
        if (userData.success && userData.user) {
          event.locals.user = userData.user;
        } else if (userData.user) {
          event.locals.user = userData.user;
        } else if (userData.id || userData.user_id) {
          // Поддержка прямого формата данных пользователя
          event.locals.user = {
            id: userData.id || userData.user_id,
            username: userData.username || userData.user_name,
            first_name: userData.first_name || userData.user_name,
            role: userData.role || userData.user_role || 'user',
            telegram_id: userData.telegram_id?.toString()
          };
        }

        // Диагностическое логирование (только в development)
        if (process.env.NODE_ENV === 'development') {
          console.log('[Auth Debug] User loaded:', {
            userId: event.locals.user?.id,
            role: event.locals.user?.role,
            sessionId: sessionId?.substring(0, 8) + '...'
          });
        }
      } else {
        // Логируем только неожиданные ошибки (не 401/403 для валидных сессий)
        if (response.status !== 401 && response.status !== 403) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Auth Debug] Unexpected authentication error:', {
              status: response.status,
              sessionId: sessionId?.substring(0, 8) + '...',
              url: `${backendUrl}/api/auth/me`
            });
          }
        } else if (process.env.NODE_ENV === 'development') {
          // Для 401/403 логируем только в debug режиме без warning уровня
          console.debug('[Auth Debug] Session invalid or expired:', {
            status: response.status,
            sessionId: sessionId?.substring(0, 8) + '...'
          });
        }
      }
    } catch (error) {
      // Детальное логирование ошибок в development режиме
      if (process.env.NODE_ENV === 'development') {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack?.split('\n').slice(0, 3).join('\n') : undefined;
        console.error('[Auth Error] Failed to fetch user data:', {
          error: errorMessage,
          sessionId: sessionId?.substring(0, 8) + '...',
          stack: errorStack
        });
      } else {
        console.warn('Authentication service unavailable');
      }
    }
  } else if (sessionId && process.env.NODE_ENV === 'development') {
    // Логируем случаи невалидных сессий только в debug режиме
    console.debug('[Auth Debug] Skipping auth request for invalid session:', {
      sessionId: sessionId?.substring(0, 8) + '...',
      length: sessionId?.length,
      reason: 'Session format validation failed'
    });
  }
  
  // Передаем cookies для API запросов
  if (event.url.pathname.startsWith('/api/')) {
    event.request.headers.set('cookie', event.request.headers.get('cookie') || '');
  }
  
  const response = await resolve(event, {
    filterSerializedResponseHeaders: (name) => {
      // Сохраняем важные заголовки
      return name === 'content-type' || name === 'set-cookie';
    }
  });
  
  // Add CORS headers for development
  if (event.url.origin === 'http://localhost:5173') {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
};
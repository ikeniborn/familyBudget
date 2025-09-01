import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Извлекаем session cookie для проверки аутентификации на сервере
  // Проверяем оба возможных имени cookie для совместимости
  const connectSid = event.cookies.get('connect.sid');
  const familyBudgetSid = event.cookies.get('familybudget.sid');
  const sessionId = connectSid || familyBudgetSid;
  
  // Добавляем информацию о состоянии аутентификации в locals
  event.locals.authenticated = !!sessionId;
  event.locals.sessionId = sessionId;
  
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
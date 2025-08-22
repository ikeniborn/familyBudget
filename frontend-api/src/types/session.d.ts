import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
      user_id: number;
      user_telegram_id?: number;  // Опциональный, так как может быть логин/пароль авторизация
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  }
}

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      user?: any; // Будет TokenPayload из JWT или объект сессии
      authMethod?: 'jwt' | 'session';
    }
  }
}
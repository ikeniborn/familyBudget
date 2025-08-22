import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../services/jwt.service';

export interface JWTMiddlewareOptions {
  /**
   * Требовать обязательную авторизацию
   * По умолчанию: true
   */
  required?: boolean;
  
  /**
   * Поддержка сессий для обратной совместимости
   * По умолчанию: true
   */
  fallbackToSession?: boolean;
}

/**
 * Middleware для проверки JWT токенов
 */
export const jwtAuth = (options: JWTMiddlewareOptions = {}) => {
  const { required = true, fallbackToSession = true } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    // Сначала пытаемся извлечь JWT токен
    const authHeader = req.headers.authorization;
    let token: string | null = null;

    // Проверяем заголовок Authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Убираем "Bearer "
    }

    // Если токен найден, проверяем его
    if (token) {
      const payload = JWTService.verifyAccessToken(token);
      
      if (payload) {
        // Токен валидный, добавляем информацию в request
        req.user = payload;
        req.userId = payload.userId;
        req.authMethod = 'jwt';
        return next();
      } else {
        // JWT токен невалидный
        if (required && !fallbackToSession) {
          res.status(401).json({ 
            error: 'Недействительный токен авторизации',
            code: 'INVALID_TOKEN'
          });
          return;
        }
      }
    }

    // Если JWT не сработал, пытаемся использовать сессию (fallback)
    if (fallbackToSession && req.session?.user) {
      req.userId = req.session.user.user_id;
      req.authMethod = 'session';
      
      // Создаем объект user для совместимости
      req.user = {
        userId: req.session.user.user_id,
        telegramId: req.session.user.user_telegram_id?.toString(),
        username: req.session.user.username,
        authMethod: 'telegram' // сессии обычно от Telegram
      };
      
      return next();
    }

    // Если требуется авторизация, но ни JWT, ни сессия не найдены
    if (required) {
      res.status(401).json({ 
        error: 'Требуется авторизация',
        code: 'AUTHENTICATION_REQUIRED'
      });
      return;
    }

    // Если авторизация не обязательна, продолжаем
    next();
  };
};

/**
 * Middleware только для JWT (без fallback на сессии)
 */
export const jwtAuthRequired = jwtAuth({ 
  required: true, 
  fallbackToSession: false 
});

/**
 * Middleware для опциональной JWT авторизации
 */
export const jwtAuthOptional = jwtAuth({ 
  required: false, 
  fallbackToSession: true 
});

/**
 * Middleware с поддержкой как JWT, так и сессий
 */
export const dualAuth = jwtAuth({ 
  required: true, 
  fallbackToSession: true 
});

/**
 * Утилита для извлечения токена из запроса
 */
export const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
};

/**
 * Утилита для проверки, авторизован ли пользователь
 */
export const isAuthenticated = (req: Request): boolean => {
  return !!(req.userId && (req.user || req.session?.user));
};

/**
 * Утилита для проверки метода авторизации
 */
export const getAuthMethod = (req: Request): 'jwt' | 'session' | null => {
  if (req.authMethod) {
    return req.authMethod;
  }
  
  if (req.user && !req.session?.user) {
    return 'jwt';
  }
  
  if (req.session?.user && !req.user) {
    return 'session';
  }
  
  return null;
};

/**
 * Middleware для логирования информации об авторизации (для отладки)
 */
export const authLogger = (req: Request, _res: Response, next: NextFunction): void => {
  if (process.env.NODE_ENV === 'development') {
    const token = extractToken(req);
    const authMethod = getAuthMethod(req);
    const userId = req.userId;
    
    console.log('[AUTH DEBUG]', {
      path: req.path,
      method: req.method,
      hasToken: !!token,
      authMethod,
      userId,
      hasSession: !!req.session?.user
    });
  }
  
  next();
};
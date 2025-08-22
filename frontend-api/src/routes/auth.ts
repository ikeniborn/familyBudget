import { Router } from 'express';
import { verifyTelegramAuth } from '../utils/telegramAuth';
import { AuthService } from '../services/auth.service';
import { dualAuth } from '../middleware/jwt.middleware';

declare module 'express-session' {
  interface SessionData {
    user?: {
      user_id: number;
      user_telegram_id?: number;
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
      user?: any;
      authMethod?: 'jwt' | 'session';
    }
  }
}

const router = Router();

// Telegram auth callback
router.post('/telegram', async (req, res, next): Promise<void> => {
  try {
    const authData = req.body;
    const { id, first_name, last_name, username } = authData;

    // Verify telegram auth data
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      res.status(500).json({ error: 'Bot token not configured' });
      return;
    }

    const isValid = verifyTelegramAuth(authData, botToken);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid authentication data' });
      return;
    }

    // Check if user exists in database using new service
    const existingUser = await AuthService.findUserByTelegramId(id.toString());
    if (!existingUser) {
      res.status(403).json({ error: 'User not found in database' });
      return;
    }

    // Create/update user and generate tokens
    const result = await AuthService.createOrUpdateTelegramUser({
      id: id.toString(),
      first_name,
      last_name,
      username
    });

    // Create session for backward compatibility
    if (req.session) {
      req.session.user = {
        user_id: result.user.id,
        user_telegram_id: parseInt(id),
        first_name,
        last_name,
        username,
      };
    }

    res.json({ 
      success: true, 
      user: result.user,
      tokens: result.tokens
    });
  } catch (error) {
    next(error);
  }
});

// Регистрация нового пользователя
router.post('/register', async (req, res, next): Promise<void> => {
  try {
    const { userName, userEmail, username, password } = req.body;

    // Валидация входных данных
    if (!userName || !username || !password) {
      res.status(400).json({ 
        error: 'Обязательные поля: userName, username, password' 
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ 
        error: 'Пароль должен содержать минимум 6 символов' 
      });
      return;
    }

    // Создаем пользователя
    const result = await AuthService.createUser({
      userName,
      userEmail,
      username,
      password
    });

    res.status(201).json({
      success: true,
      user: result.user,
      tokens: result.tokens
    });
  } catch (error: any) {
    if (error.message === 'Пользователь с таким логином уже существует') {
      res.status(409).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// Вход по логину и паролю
router.post('/login', async (req, res, next): Promise<void> => {
  try {
    const { username, password } = req.body;

    // Валидация входных данных
    if (!username || !password) {
      res.status(400).json({ 
        error: 'Необходимо указать логин и пароль' 
      });
      return;
    }

    // Аутентификация пользователя
    const result = await AuthService.loginUser({ username, password });

    // Создаем сессию для обратной совместимости
    if (req.session) {
      req.session.user = {
        user_id: result.user.id,
        user_telegram_id: result.user.telegramId ? parseInt(result.user.telegramId) : undefined,
        username: result.user.username,
      };
    }

    res.json({
      success: true,
      user: result.user,
      tokens: result.tokens
    });
  } catch (error: any) {
    if (error.message === 'Пользователь не найден' || 
        error.message === 'Неверный пароль' ||
        error.message === 'У пользователя не настроен пароль') {
      res.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// Обновление токенов
router.post('/refresh', async (req, res, next): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ 
        error: 'Refresh token не предоставлен' 
      });
      return;
    }

    // Обновляем токены
    const tokens = await AuthService.refreshTokens(refreshToken);

    res.json({
      success: true,
      tokens
    });
  } catch (error: any) {
    if (error.message === 'Недействительный refresh токен' ||
        error.message === 'Пользователь не найден или refresh токен недействителен') {
      res.status(401).json({ error: error.message });
      return;
    }
    next(error);
  }
});

// Проверка доступности авторизации по паролю
router.get('/check-password-enabled', async (_req, res, next): Promise<void> => {
  try {
    const enabled = await AuthService.isPasswordAuthEnabled();
    res.json({ 
      passwordAuthEnabled: enabled 
    });
  } catch (error) {
    next(error);
  }
});

// Logout (с поддержкой JWT)
router.post('/logout', dualAuth, async (req, res, next): Promise<void> => {
  try {
    // Аннулируем refresh токен в базе данных
    if (req.userId) {
      await AuthService.logoutUser(req.userId);
    }

    // Уничтожаем сессию если она есть
    if (req.session) {
      req.session.destroy(() => {
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  } catch (error) {
    next(error);
  }
});

// Get current user (с поддержкой JWT)
router.get('/me', dualAuth, async (req, res, next): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Получаем актуальные данные пользователя из базы
    const user = await AuthService.findUserById(req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ 
      user,
      authMethod: req.authMethod || 'unknown'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
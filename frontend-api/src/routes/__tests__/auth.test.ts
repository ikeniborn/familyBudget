import request from 'supertest';
import express from 'express';
import session from 'express-session';
import { AuthService } from '../../services/auth.service';
import { JWTService } from '../../services/jwt.service';
import authPasswordRouter from '../auth-password';

// Моки
jest.mock('../../services/auth.service');
jest.mock('../../services/jwt.service');

describe('Auth Routes Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Создаем приложение Express для тестирования
    app = express();
    app.use(express.json());
    
    // Настраиваем сессии для тестирования
    app.use(session({
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false } // для тестов без HTTPS
    }));
    
    // Подключаем роуты
    app.use('/auth', authPasswordRouter);
    
    // Настраиваем переменные окружения для тестов
    process.env.ENABLE_PASSWORD_AUTH = 'true';
    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'admin123';
  });

  describe('POST /auth/login', () => {
    it('должен успешно логинить администратора', async () => {
      const loginData = {
        username: 'admin',
        password: 'admin123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        user: {
          id: 1,
          username: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          isAdmin: true
        }
      });
    });

    it('должен отклонить неверные данные администратора', async () => {
      const loginData = {
        username: 'admin',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid username or password'
      });
    });

    it('должен отклонить запрос без username', async () => {
      const loginData = {
        password: 'admin123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Username and password are required'
      });
    });

    it('должен отклонить запрос без password', async () => {
      const loginData = {
        username: 'admin'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Username and password are required'
      });
    });

    it('должен отклонить запрос, если password auth отключен', async () => {
      process.env.ENABLE_PASSWORD_AUTH = 'false';

      const loginData = {
        username: 'admin',
        password: 'admin123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        error: 'Password authentication is disabled'
      });
    });

    it('должен отклонить несуществующего пользователя', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'password123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid username or password'
      });
    });
  });

  describe('GET /auth/password-auth-enabled', () => {
    it('должен возвращать enabled: true, когда password auth включен', async () => {
      process.env.ENABLE_PASSWORD_AUTH = 'true';

      const response = await request(app)
        .get('/auth/password-auth-enabled');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        enabled: true
      });
    });

    it('должен возвращать enabled: false, когда password auth отключен', async () => {
      process.env.ENABLE_PASSWORD_AUTH = 'false';

      const response = await request(app)
        .get('/auth/password-auth-enabled');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        enabled: false
      });
    });

    it('должен возвращать enabled: false по умолчанию', async () => {
      delete process.env.ENABLE_PASSWORD_AUTH;

      const response = await request(app)
        .get('/auth/password-auth-enabled');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        enabled: false
      });
    });
  });

  describe('POST /auth/logout', () => {
    it('должен успешно выходить из системы', async () => {
      // Сначала логинимся
      await request(app)
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      // Затем выходим
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true
      });
    });

    it('должен обрабатывать ошибки при выходе', async () => {
      // Мокаем ошибку при уничтожении сессии
      const originalDestroy = require('express-session').Store.prototype.destroy;
      require('express-session').Store.prototype.destroy = jest.fn((_sid: string, callback: Function) => {
        callback(new Error('Session destroy error'));
      });

      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Could not logout'
      });

      // Восстанавливаем оригинальную функцию
      require('express-session').Store.prototype.destroy = originalDestroy;
    });
  });

  describe('GET /auth/me', () => {
    it('должен возвращать данные текущего пользователя', async () => {
      const agent = request.agent(app);

      // Логинимся сначала
      await agent
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      // Затем получаем данные пользователя
      const response = await agent
        .get('/auth/me');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        user: {
          id: 1,
          username: 'admin',
          firstName: 'Admin',
          lastName: 'User',
          isAdmin: true
        }
      });
    });

    it('должен возвращать 401 для неаутентифицированного пользователя', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Not authenticated'
      });
    });
  });

  describe('Middleware и обработка ошибок', () => {
    it('должен обрабатывать ошибки в логине', async () => {
      // Мокаем ошибку в процессе логина
      const originalEnv = process.env.ADMIN_USERNAME;
      delete process.env.ADMIN_USERNAME;

      const loginData = {
        username: 'admin',
        password: 'admin123'
      };

      const response = await request(app)
        .post('/auth/login')
        .send(loginData);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid username or password'
      });

      // Восстанавливаем переменную окружения
      process.env.ADMIN_USERNAME = originalEnv;
    });

    it('должен обрабатывать внутренние ошибки сервера', async () => {
      // Создаем новое приложение с ошибкой в middleware
      const errorApp = express();
      errorApp.use(express.json());
      
      // Добавляем middleware, который всегда выбрасывает ошибку
      errorApp.use('/auth', (_req: any, _res: any, _next: any) => {
        throw new Error('Test internal error');
      });
      
      errorApp.use('/auth', authPasswordRouter);

      const response = await request(errorApp)
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(response.status).toBe(500);
    });
  });

  describe('Сессии и состояние', () => {
    it('должен сохранять состояние сессии между запросами', async () => {
      const agent = request.agent(app);

      // Логинимся
      const loginResponse = await agent
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(loginResponse.status).toBe(200);

      // Проверяем, что сессия сохранилась
      const meResponse = await agent
        .get('/auth/me');

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.user.username).toBe('admin');

      // Выходим
      const logoutResponse = await agent
        .post('/auth/logout');

      expect(logoutResponse.status).toBe(200);

      // Проверяем, что сессия очистилась
      const meAfterLogoutResponse = await agent
        .get('/auth/me');

      expect(meAfterLogoutResponse.status).toBe(401);
    });

    it('должен создавать отдельные сессии для разных пользователей', async () => {
      const agent1 = request.agent(app);
      const agent2 = request.agent(app);

      // Логинимся с первого агента
      await agent1
        .post('/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      // Проверяем, что первый агент аутентифицирован
      const me1Response = await agent1
        .get('/auth/me');
      expect(me1Response.status).toBe(200);

      // Проверяем, что второй агент не аутентифицирован
      const me2Response = await agent2
        .get('/auth/me');
      expect(me2Response.status).toBe(401);
    });
  });

  describe('Безопасность', () => {
    it('должен отклонять пустые JSON запросы', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: 'Username and password are required'
      });
    });

    it('должен отклонять запросы с некорректным Content-Type', async () => {
      const response = await request(app)
        .post('/auth/login')
        .set('Content-Type', 'text/plain')
        .send('username=admin&password=admin123');

      expect(response.status).toBe(400);
    });

    it('должен обрабатывать длинные пароли', async () => {
      const longPassword = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'admin',
          password: longPassword
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid username or password'
      });
    });

    it('должен обрабатывать специальные символы в данных входа', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          username: 'admin\'; DROP TABLE users; --',
          password: 'admin123'
        });

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        error: 'Invalid username or password'
      });
    });
  });
});
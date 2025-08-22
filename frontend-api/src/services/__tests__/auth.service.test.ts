import { AuthService, CreateUserData, LoginCredentials } from '../auth.service';
import { JWTService } from '../jwt.service';
import bcrypt from 'bcryptjs';

// Моки
jest.mock('../jwt.service');
jest.mock('bcryptjs');

// Мокаем PrismaClient через модуль базы данных
jest.mock('../../database/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    }
  }
}));

const mockJWTService = {
  generateTokenPair: jest.fn(),
  verifyRefreshToken: jest.fn(),
} as any;

const mockBcrypt = {
  hash: jest.fn(),
  compare: jest.fn(),
} as any;

// Получаем мокнутый prisma
const { prisma } = require('../../database/prisma');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Переназначаем методы JWTService
    (JWTService as any).generateTokenPair = mockJWTService.generateTokenPair;
    (JWTService as any).verifyRefreshToken = mockJWTService.verifyRefreshToken;
    
    // Переназначаем методы bcrypt
    (bcrypt as any).hash = mockBcrypt.hash;
    (bcrypt as any).compare = mockBcrypt.compare;
  });

  describe('hashPassword', () => {
    it('должен хешировать пароль с помощью bcrypt', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      mockBcrypt.hash.mockResolvedValue(hashedPassword);

      const result = await AuthService.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('должен использовать saltRounds равный 12', async () => {
      const password = 'testPassword123';
      mockBcrypt.hash.mockResolvedValue('hashedPassword');

      await AuthService.hashPassword(password);

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('comparePassword', () => {
    it('должен возвращать true для корректного пароля', async () => {
      const password = 'testPassword123';
      const hashedPassword = 'hashedPassword123';
      
      mockBcrypt.compare.mockResolvedValue(true);

      const result = await AuthService.comparePassword(password, hashedPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('должен возвращать false для неверного пароля', async () => {
      const password = 'wrongPassword';
      const hashedPassword = 'hashedPassword123';
      
      mockBcrypt.compare.mockResolvedValue(false);

      const result = await AuthService.comparePassword(password, hashedPassword);

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(false);
    });
  });

  describe('createUser', () => {
    const userData: CreateUserData = {
      userName: 'Test User',
      userEmail: 'test@example.com',
      username: 'testuser',
      password: 'testPassword123'
    };

    it('должен создать пользователя успешно', async () => {
      const hashedPassword = 'hashedPassword123';
      const tokens = {
        accessToken: 'accessToken123',
        refreshToken: 'refreshToken123'
      };
      
      const createdUser = {
        id: 1,
        userName: userData.userName,
        userEmail: userData.userEmail,
        username: userData.username,
        passwordHash: hashedPassword,
        authMethod: 'password',
        isActive: true,
        telegramId: null,
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      prisma.user.findUnique.mockResolvedValue(null);
      mockBcrypt.hash.mockResolvedValue(hashedPassword);
      prisma.user.create.mockResolvedValue(createdUser);
      mockJWTService.generateTokenPair.mockReturnValue(tokens);
      prisma.user.update.mockResolvedValue({ ...createdUser, refreshToken: tokens.refreshToken });

      const result = await AuthService.createUser(userData);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: userData.username }
      });
      expect(mockBcrypt.hash).toHaveBeenCalledWith(userData.password, 12);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          userName: userData.userName,
          userEmail: userData.userEmail,
          username: userData.username,
          passwordHash: hashedPassword,
          authMethod: 'password',
          isActive: true
        }
      });
      expect(mockJWTService.generateTokenPair).toHaveBeenCalledWith({
        userId: createdUser.id,
        username: createdUser.username,
        authMethod: 'password'
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: createdUser.id },
        data: { refreshToken: tokens.refreshToken }
      });

      expect(result).toEqual({
        user: {
          id: createdUser.id,
          userName: createdUser.userName,
          userEmail: createdUser.userEmail,
          username: createdUser.username,
          telegramId: undefined,
          authMethod: createdUser.authMethod,
          isActive: createdUser.isActive,
          createdAt: createdUser.createdAt,
          updatedAt: createdUser.updatedAt
        },
        tokens
      });
    });

    it('должен выбросить ошибку, если пользователь уже существует', async () => {
      const existingUser = {
        id: 1,
        username: userData.username
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);

      await expect(AuthService.createUser(userData)).rejects.toThrow(
        'Пользователь с таким логином уже существует'
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username: userData.username }
      });
      expect(mockBcrypt.hash).not.toHaveBeenCalled();
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('loginUser', () => {
    const credentials: LoginCredentials = {
      username: 'testuser',
      password: 'testPassword123'
    };

    const userFromDb = {
      id: 1,
      userName: 'Test User',
      userEmail: 'test@example.com',
      username: credentials.username,
      passwordHash: 'hashedPassword123',
      authMethod: 'password',
      isActive: true,
      telegramId: null,
      refreshToken: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    it('должен аутентифицировать пользователя успешно', async () => {
      const tokens = {
        accessToken: 'accessToken123',
        refreshToken: 'refreshToken123'
      };

      mockPrisma.user.findUnique.mockResolvedValue(userFromDb);
      mockBcrypt.compare.mockResolvedValue(true);
      mockJWTService.generateTokenPair.mockReturnValue(tokens);
      mockPrisma.user.update.mockResolvedValue({ ...userFromDb, refreshToken: tokens.refreshToken });

      const result = await AuthService.loginUser(credentials);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { 
          username: credentials.username,
          isActive: true
        }
      });
      expect(mockBcrypt.compare).toHaveBeenCalledWith(credentials.password, userFromDb.passwordHash);
      expect(mockJWTService.generateTokenPair).toHaveBeenCalledWith({
        userId: userFromDb.id,
        username: userFromDb.username,
        telegramId: undefined,
        authMethod: 'password'
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userFromDb.id },
        data: { refreshToken: tokens.refreshToken }
      });

      expect(result.user.id).toBe(userFromDb.id);
      expect(result.tokens).toEqual(tokens);
    });

    it('должен выбросить ошибку для несуществующего пользователя', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.loginUser(credentials)).rejects.toThrow(
        'Пользователь не найден'
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { 
          username: credentials.username,
          isActive: true
        }
      });
      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку, если у пользователя нет пароля', async () => {
      const userWithoutPassword = { ...userFromDb, passwordHash: null };
      mockPrisma.user.findUnique.mockResolvedValue(userWithoutPassword);

      await expect(AuthService.loginUser(credentials)).rejects.toThrow(
        'У пользователя не настроен пароль'
      );

      expect(mockBcrypt.compare).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку для неверного пароля', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(userFromDb);
      mockBcrypt.compare.mockResolvedValue(false);

      await expect(AuthService.loginUser(credentials)).rejects.toThrow(
        'Неверный пароль'
      );

      expect(mockBcrypt.compare).toHaveBeenCalledWith(credentials.password, userFromDb.passwordHash);
      expect(mockJWTService.generateTokenPair).not.toHaveBeenCalled();
    });
  });

  describe('refreshTokens', () => {
    const refreshToken = 'refreshToken123';
    const payload = { userId: 1 };
    const userFromDb = {
      id: 1,
      userName: 'Test User',
      username: 'testuser',
      authMethod: 'password',
      isActive: true,
      refreshToken: refreshToken,
      telegramId: null
    };

    it('должен обновить токены успешно', async () => {
      const newTokens = {
        accessToken: 'newAccessToken123',
        refreshToken: 'newRefreshToken123'
      };

      mockJWTService.verifyRefreshToken.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(userFromDb);
      mockJWTService.generateTokenPair.mockReturnValue(newTokens);
      mockPrisma.user.update.mockResolvedValue({ ...userFromDb, refreshToken: newTokens.refreshToken });

      const result = await AuthService.refreshTokens(refreshToken);

      expect(mockJWTService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { 
          id: payload.userId,
          refreshToken: refreshToken,
          isActive: true
        }
      });
      expect(mockJWTService.generateTokenPair).toHaveBeenCalledWith({
        userId: userFromDb.id,
        username: userFromDb.username,
        telegramId: undefined,
        authMethod: 'password'
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userFromDb.id },
        data: { refreshToken: newTokens.refreshToken }
      });

      expect(result).toEqual(newTokens);
    });

    it('должен выбросить ошибку для недействительного refresh токена', async () => {
      mockJWTService.verifyRefreshToken.mockReturnValue(null);

      await expect(AuthService.refreshTokens(refreshToken)).rejects.toThrow(
        'Недействительный refresh токен'
      );

      expect(mockJWTService.verifyRefreshToken).toHaveBeenCalledWith(refreshToken);
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('должен выбросить ошибку, если пользователь не найден или токен не совпадает', async () => {
      mockJWTService.verifyRefreshToken.mockReturnValue(payload);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(AuthService.refreshTokens(refreshToken)).rejects.toThrow(
        'Пользователь не найден или refresh токен недействителен'
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { 
          id: payload.userId,
          refreshToken: refreshToken,
          isActive: true
        }
      });
    });
  });

  describe('findUserById', () => {
    it('должен найти пользователя по ID', async () => {
      const userId = 1;
      const user = {
        id: userId,
        userName: 'Test User',
        userEmail: 'test@example.com',
        username: 'testuser',
        telegramId: null,
        authMethod: 'password',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(user);

      const result = await AuthService.findUserById(userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { 
          id: userId,
          isActive: true
        },
        select: {
          id: true,
          userName: true,
          userEmail: true,
          username: true,
          telegramId: true,
          authMethod: true,
          isActive: true,
          createdAt: true,
          updatedAt: true
        }
      });

      expect(result).toBe(user);
    });

    it('должен вернуть null для несуществующего пользователя', async () => {
      const userId = 999;
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.findUserById(userId);

      expect(result).toBeNull();
    });
  });

  describe('logoutUser', () => {
    it('должен очистить refresh токен пользователя', async () => {
      const userId = 1;
      mockPrisma.user.update.mockResolvedValue({});

      await AuthService.logoutUser(userId);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { refreshToken: null }
      });
    });
  });

  describe('isPasswordAuthEnabled', () => {
    it('должен возвращать true', async () => {
      const result = await AuthService.isPasswordAuthEnabled();
      expect(result).toBe(true);
    });
  });

  describe('createOrUpdateTelegramUser', () => {
    const telegramData = {
      id: '123456',
      first_name: 'John',
      last_name: 'Doe',
      username: 'johndoe'
    };

    it('должен создать нового пользователя Telegram', async () => {
      const tokens = {
        accessToken: 'accessToken123',
        refreshToken: 'refreshToken123'
      };
      
      const createdUser = {
        id: 1,
        userName: 'John Doe',
        userEmail: null,
        username: 'johndoe',
        telegramId: '123456',
        authMethod: 'telegram',
        isActive: true,
        refreshToken: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(createdUser);
      mockJWTService.generateTokenPair.mockReturnValue(tokens);
      mockPrisma.user.update.mockResolvedValue({ ...createdUser, refreshToken: tokens.refreshToken });

      const result = await AuthService.createOrUpdateTelegramUser(telegramData);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: telegramData.id }
      });
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          userName: 'John Doe',
          username: 'johndoe',
          telegramId: '123456',
          authMethod: 'telegram',
          isActive: true
        }
      });
      expect(mockJWTService.generateTokenPair).toHaveBeenCalledWith({
        userId: createdUser.id,
        username: createdUser.username,
        telegramId: createdUser.telegramId,
        authMethod: 'telegram'
      });

      expect(result.user.id).toBe(createdUser.id);
      expect(result.tokens).toEqual(tokens);
    });

    it('должен обновить существующего пользователя Telegram', async () => {
      const existingUser = {
        id: 1,
        userName: 'Old Name',
        username: 'oldusername',
        telegramId: '123456',
        authMethod: 'telegram',
        isActive: true
      };

      const updatedUser = {
        ...existingUser,
        userName: 'John Doe',
        username: 'johndoe',
        updatedAt: new Date()
      };

      const tokens = {
        accessToken: 'accessToken123',
        refreshToken: 'refreshToken123'
      };

      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValueOnce(updatedUser);
      mockJWTService.generateTokenPair.mockReturnValue(tokens);
      mockPrisma.user.update.mockResolvedValueOnce({ ...updatedUser, refreshToken: tokens.refreshToken });

      const result = await AuthService.createOrUpdateTelegramUser(telegramData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { telegramId: telegramData.id },
        data: {
          userName: 'John Doe',
          username: 'johndoe',
          isActive: true,
          updatedAt: expect.any(Date)
        }
      });

      expect(result.user.userName).toBe('John Doe');
      expect(result.tokens).toEqual(tokens);
    });
  });
});
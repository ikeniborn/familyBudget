import * as bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma';
import { JWTService, TokenPayload, TokenPair } from './jwt.service';

const prisma = new PrismaClient();

export interface CreateUserData {
  userName: string;
  userEmail?: string;
  username: string;
  password: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface UserWithTokens {
  user: {
    id: number;
    userName: string;
    userEmail?: string;
    username?: string;
    telegramId?: string;
    authMethod: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
  tokens: TokenPair;
}

export class AuthService {
  
  /**
   * Хеширование пароля
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Проверка пароля
   */
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  /**
   * Создание нового пользователя
   */
  static async createUser(userData: CreateUserData): Promise<UserWithTokens> {
    // Проверяем, что пользователь с таким username не существует
    const existingUser = await prisma.user.findUnique({
      where: { username: userData.username }
    });

    if (existingUser) {
      throw new Error('Пользователь с таким логином уже существует');
    }

    // Хешируем пароль
    const passwordHash = await this.hashPassword(userData.password);

    // Создаем пользователя
    const user = await prisma.user.create({
      data: {
        userName: userData.userName,
        userEmail: userData.userEmail,
        username: userData.username,
        passwordHash,
        authMethod: 'password',
        isActive: true
      }
    });

    // Генерируем токены
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username || undefined,
      authMethod: 'password'
    };
    
    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Сохраняем refresh токен в базе
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    return {
      user: {
        id: user.id,
        userName: user.userName,
        userEmail: user.userEmail || undefined,
        username: user.username || undefined,
        telegramId: user.telegramId || undefined,
        authMethod: user.authMethod,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      tokens
    };
  }

  /**
   * Аутентификация пользователя по логину и паролю
   */
  static async loginUser(credentials: LoginCredentials): Promise<UserWithTokens> {
    // Находим пользователя по username
    const user = await prisma.user.findUnique({
      where: { 
        username: credentials.username,
        isActive: true
      }
    });

    if (!user) {
      throw new Error('Пользователь не найден');
    }

    if (!user.passwordHash) {
      throw new Error('У пользователя не настроен пароль');
    }

    // Проверяем пароль
    const isPasswordValid = await this.comparePassword(credentials.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Неверный пароль');
    }

    // Генерируем новые токены
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username || undefined,
      telegramId: user.telegramId || undefined,
      authMethod: user.authMethod as 'telegram' | 'password'
    };
    
    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Сохраняем новый refresh токен в базе
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    return {
      user: {
        id: user.id,
        userName: user.userName,
        userEmail: user.userEmail || undefined,
        username: user.username || undefined,
        telegramId: user.telegramId || undefined,
        authMethod: user.authMethod,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      tokens
    };
  }

  /**
   * Обновление токенов по refresh токену
   */
  static async refreshTokens(refreshToken: string): Promise<TokenPair> {
    // Проверяем refresh токен
    const payload = JWTService.verifyRefreshToken(refreshToken);
    if (!payload) {
      throw new Error('Недействительный refresh токен');
    }

    // Находим пользователя и проверяем, что refresh токен совпадает
    const user = await prisma.user.findUnique({
      where: { 
        id: payload.userId,
        refreshToken: refreshToken,
        isActive: true
      }
    });

    if (!user) {
      throw new Error('Пользователь не найден или refresh токен недействителен');
    }

    // Генерируем новые токены
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username || undefined,
      telegramId: user.telegramId || undefined,
      authMethod: user.authMethod as 'telegram' | 'password'
    };
    
    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Обновляем refresh токен в базе
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    return tokens;
  }

  /**
   * Поиск пользователя по ID
   */
  static async findUserById(userId: number): Promise<any> {
    const user = await prisma.user.findUnique({
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

    return user;
  }

  /**
   * Поиск пользователя по username
   */
  static async findUserByUsername(username: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { 
        username: username,
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

    return user;
  }

  /**
   * Поиск пользователя по Telegram ID
   */
  static async findUserByTelegramId(telegramId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { 
        telegramId: telegramId,
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

    return user;
  }

  /**
   * Создание/обновление пользователя из Telegram
   */
  static async createOrUpdateTelegramUser(telegramData: {
    id: string;
    first_name: string;
    last_name?: string;
    username?: string;
  }): Promise<UserWithTokens> {
    const { id: telegramId, first_name, last_name, username: tgUsername } = telegramData;
    const userName = `${first_name}${last_name ? ' ' + last_name : ''}`;

    // Ищем существующего пользователя
    let user = await prisma.user.findUnique({
      where: { telegramId }
    });

    if (user) {
      // Обновляем данные существующего пользователя
      user = await prisma.user.update({
        where: { telegramId },
        data: {
          userName,
          username: tgUsername,
          isActive: true,
          updatedAt: new Date()
        }
      });
    } else {
      // Создаем нового пользователя
      user = await prisma.user.create({
        data: {
          userName,
          username: tgUsername,
          telegramId,
          authMethod: 'telegram',
          isActive: true
        }
      });
    }

    // Генерируем токены
    const tokenPayload: TokenPayload = {
      userId: user.id,
      username: user.username || undefined,
      telegramId: user.telegramId || undefined,
      authMethod: 'telegram'
    };
    
    const tokens = JWTService.generateTokenPair(tokenPayload);

    // Сохраняем refresh токен в базе
    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: tokens.refreshToken }
    });

    return {
      user: {
        id: user.id,
        userName: user.userName,
        userEmail: user.userEmail || undefined,
        username: user.username || undefined,
        telegramId: user.telegramId || undefined,
        authMethod: user.authMethod,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      tokens
    };
  }

  /**
   * Выход из системы (аннулирование refresh токена)
   */
  static async logoutUser(userId: number): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null }
    });
  }

  /**
   * Проверка доступности авторизации по паролю
   */
  static async isPasswordAuthEnabled(): Promise<boolean> {
    // Можно добавить логику проверки настроек системы
    // Пока возвращаем true, так как функция реализована
    return true;
  }
}
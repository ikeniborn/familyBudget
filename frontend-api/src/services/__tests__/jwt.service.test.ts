import { JWTService, TokenPayload } from '../jwt.service';
import jwt from 'jsonwebtoken';

// Моки
jest.mock('jsonwebtoken');

const mockJwt = {
  sign: jest.fn(),
  verify: jest.fn(),
  decode: jest.fn()
} as any;

describe('JWTService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Переназначаем методы jwt
    (jwt as any).sign = mockJwt.sign;
    (jwt as any).verify = mockJwt.verify;
    (jwt as any).decode = mockJwt.decode;
    
    // Сбрасываем переменные окружения для каждого теста
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test_secret',
      JWT_REFRESH_SECRET: 'test_refresh_secret',
      JWT_ACCESS_EXPIRES: '15m',
      JWT_REFRESH_EXPIRES: '7d'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const mockPayload: TokenPayload = {
    userId: 1,
    username: 'testuser',
    telegramId: '123456',
    authMethod: 'password'
  };

  describe('generateTokenPair', () => {
    it('должен генерировать пару токенов (access + refresh)', () => {
      const accessToken = 'generatedAccessToken';
      const refreshToken = 'generatedRefreshToken';

      mockJwt.sign
        .mockReturnValueOnce(accessToken)  // для access токена
        .mockReturnValueOnce(refreshToken); // для refresh токена

      const result = JWTService.generateTokenPair(mockPayload);

      expect(mockJwt.sign).toHaveBeenCalledTimes(2);
      
      // Проверяем вызов для access токена
      expect(mockJwt.sign).toHaveBeenNthCalledWith(1, 
        mockPayload,
        'test_secret',
        {
          expiresIn: '15m',
          issuer: 'family-budget-api'
        }
      );

      // Проверяем вызов для refresh токена
      expect(mockJwt.sign).toHaveBeenNthCalledWith(2, 
        { userId: mockPayload.userId },
        'test_refresh_secret',
        {
          expiresIn: '7d',
          issuer: 'family-budget-api'
        }
      );

      expect(result).toEqual({
        accessToken,
        refreshToken
      });
    });

    it('должен использовать переменные окружения по умолчанию', () => {
      // Удаляем переменные окружения
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;
      delete process.env.JWT_ACCESS_EXPIRES;
      delete process.env.JWT_REFRESH_EXPIRES;

      const accessToken = 'accessToken';
      const refreshToken = 'refreshToken';

      mockJwt.sign
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      JWTService.generateTokenPair(mockPayload);

      // Проверяем использование значений по умолчанию
      expect(mockJwt.sign).toHaveBeenNthCalledWith(1, 
        mockPayload,
        'default_secret',
        {
          expiresIn: '15m',
          issuer: 'family-budget-api'
        }
      );

      expect(mockJwt.sign).toHaveBeenNthCalledWith(2, 
        { userId: mockPayload.userId },
        'default_refresh_secret',
        {
          expiresIn: '7d',
          issuer: 'family-budget-api'
        }
      );
    });
  });

  describe('generateAccessToken', () => {
    it('должен генерировать только access токен', () => {
      const accessToken = 'generatedAccessToken';
      mockJwt.sign.mockReturnValue(accessToken);

      const result = JWTService.generateAccessToken(mockPayload);

      expect(mockJwt.sign).toHaveBeenCalledTimes(1);
      expect(mockJwt.sign).toHaveBeenCalledWith(
        mockPayload,
        'test_secret',
        {
          expiresIn: '15m',
          issuer: 'family-budget-api'
        }
      );

      expect(result).toBe(accessToken);
    });
  });

  describe('verifyAccessToken', () => {
    const token = 'testAccessToken';

    it('должен верифицировать действительный access токен', () => {
      mockJwt.verify.mockReturnValue(mockPayload as any);

      const result = JWTService.verifyAccessToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test_secret');
      expect(result).toEqual(mockPayload);
    });

    it('должен возвращать null для недействительного токена', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = JWTService.verifyAccessToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test_secret');
      expect(result).toBeNull();
    });

    it('должен возвращать null при любой ошибке верификации', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid signature');
      });

      const result = JWTService.verifyAccessToken(token);

      expect(result).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    const token = 'testRefreshToken';
    const refreshPayload = { userId: 1 };

    it('должен верифицировать действительный refresh токен', () => {
      mockJwt.verify.mockReturnValue(refreshPayload as any);

      const result = JWTService.verifyRefreshToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test_refresh_secret');
      expect(result).toEqual(refreshPayload);
    });

    it('должен возвращать null для недействительного refresh токена', () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = JWTService.verifyRefreshToken(token);

      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test_refresh_secret');
      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    const token = 'testToken';

    it('должен декодировать токен без верификации', () => {
      const decodedData = { userId: 1, username: 'test' };
      mockJwt.decode.mockReturnValue(decodedData);

      const result = JWTService.decodeToken(token);

      expect(mockJwt.decode).toHaveBeenCalledWith(token);
      expect(result).toEqual(decodedData);
    });

    it('должен возвращать null при ошибке декодирования', () => {
      mockJwt.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = JWTService.decodeToken(token);

      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    const token = 'testToken';

    it('должен возвращать false для действительного токена', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // +1 час
      const decodedToken = { exp: futureTime };
      mockJwt.decode.mockReturnValue(decodedToken);

      const result = JWTService.isTokenExpired(token);

      expect(mockJwt.decode).toHaveBeenCalledWith(token);
      expect(result).toBe(false);
    });

    it('должен возвращать true для истекшего токена', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // -1 час
      const decodedToken = { exp: pastTime };
      mockJwt.decode.mockReturnValue(decodedToken);

      const result = JWTService.isTokenExpired(token);

      expect(result).toBe(true);
    });

    it('должен возвращать true для токена без поля exp', () => {
      const decodedToken = { userId: 1 };
      mockJwt.decode.mockReturnValue(decodedToken);

      const result = JWTService.isTokenExpired(token);

      expect(result).toBe(true);
    });

    it('должен возвращать true при ошибке декодирования', () => {
      mockJwt.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = JWTService.isTokenExpired(token);

      expect(result).toBe(true);
    });

    it('должен возвращать true для null токена', () => {
      mockJwt.decode.mockReturnValue(null);

      const result = JWTService.isTokenExpired(token);

      expect(result).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    const token = 'testToken';

    it('должен возвращать дату истечения для действительного токена', () => {
      const expTime = Math.floor(Date.now() / 1000) + 3600; // +1 час
      const decodedToken = { exp: expTime };
      mockJwt.decode.mockReturnValue(decodedToken);

      const result = JWTService.getTokenExpiration(token);

      expect(mockJwt.decode).toHaveBeenCalledWith(token);
      expect(result).toEqual(new Date(expTime * 1000));
    });

    it('должен возвращать null для токена без поля exp', () => {
      const decodedToken = { userId: 1 };
      mockJwt.decode.mockReturnValue(decodedToken);

      const result = JWTService.getTokenExpiration(token);

      expect(result).toBeNull();
    });

    it('должен возвращать null при ошибке декодирования', () => {
      mockJwt.decode.mockImplementation(() => {
        throw new Error('Decode error');
      });

      const result = JWTService.getTokenExpiration(token);

      expect(result).toBeNull();
    });

    it('должен возвращать null для null токена', () => {
      mockJwt.decode.mockReturnValue(null);

      const result = JWTService.getTokenExpiration(token);

      expect(result).toBeNull();
    });
  });

  describe('Конфигурация секретов', () => {
    it('должен использовать переменные окружения для секретов', () => {
      process.env.JWT_SECRET = 'custom_secret';
      process.env.JWT_REFRESH_SECRET = 'custom_refresh_secret';

      mockJwt.sign.mockReturnValue('token');

      JWTService.generateTokenPair(mockPayload);

      expect(mockJwt.sign).toHaveBeenNthCalledWith(1, 
        mockPayload,
        'custom_secret',
        expect.any(Object)
      );

      expect(mockJwt.sign).toHaveBeenNthCalledWith(2, 
        { userId: mockPayload.userId },
        'custom_refresh_secret',
        expect.any(Object)
      );
    });

    it('должен использовать кастомные времена истечения токенов', () => {
      process.env.JWT_ACCESS_EXPIRES = '30m';
      process.env.JWT_REFRESH_EXPIRES = '14d';

      mockJwt.sign.mockReturnValue('token');

      JWTService.generateTokenPair(mockPayload);

      expect(mockJwt.sign).toHaveBeenNthCalledWith(1, 
        mockPayload,
        expect.any(String),
        expect.objectContaining({
          expiresIn: '30m'
        })
      );

      expect(mockJwt.sign).toHaveBeenNthCalledWith(2, 
        { userId: mockPayload.userId },
        expect.any(String),
        expect.objectContaining({
          expiresIn: '14d'
        })
      );
    });
  });
});
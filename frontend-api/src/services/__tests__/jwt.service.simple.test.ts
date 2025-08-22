import { JWTService, TokenPayload } from '../jwt.service';

// Простые интеграционные тесты JWT
describe('JWTService - Simple Tests', () => {
  const mockPayload: TokenPayload = {
    userId: 1,
    username: 'testuser',
    authMethod: 'password'
  };

  beforeAll(() => {
    // Устанавливаем переменные окружения для тестов
    process.env.JWT_SECRET = 'test-secret-key';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
    process.env.JWT_ACCESS_EXPIRES = '15m';
    process.env.JWT_REFRESH_EXPIRES = '7d';
  });

  describe('generateTokenPair', () => {
    it('должен генерировать пару токенов', () => {
      const tokens = JWTService.generateTokenPair(mockPayload);
      
      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });
  });

  describe('generateAccessToken', () => {
    it('должен генерировать access токен', () => {
      const token = JWTService.generateAccessToken(mockPayload);
      
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(10);
    });
  });

  describe('verifyAccessToken', () => {
    it('должен верифицировать действительный токен', () => {
      const token = JWTService.generateAccessToken(mockPayload);
      const decoded = JWTService.verifyAccessToken(token);
      
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(mockPayload.userId);
      expect(decoded?.username).toBe(mockPayload.username);
      expect(decoded?.authMethod).toBe(mockPayload.authMethod);
    });

    it('должен возвращать null для недействительного токена', () => {
      const result = JWTService.verifyAccessToken('invalid.token.here');
      expect(result).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('должен верифицировать refresh токен', () => {
      const tokens = JWTService.generateTokenPair(mockPayload);
      const decoded = JWTService.verifyRefreshToken(tokens.refreshToken);
      
      expect(decoded).toBeTruthy();
      expect(decoded?.userId).toBe(mockPayload.userId);
    });

    it('должен возвращать null для недействительного refresh токена', () => {
      const result = JWTService.verifyRefreshToken('invalid.refresh.token');
      expect(result).toBeNull();
    });
  });

  describe('decodeToken', () => {
    it('должен декодировать токен без верификации', () => {
      const token = JWTService.generateAccessToken(mockPayload);
      const decoded = JWTService.decodeToken(token);
      
      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.username).toBe(mockPayload.username);
    });

    it('должен возвращать null для некорректного токена', () => {
      const result = JWTService.decodeToken('not.a.token');
      expect(result).toBeNull();
    });
  });

  describe('isTokenExpired', () => {
    it('должен возвращать false для свежего токена', () => {
      const token = JWTService.generateAccessToken(mockPayload);
      const isExpired = JWTService.isTokenExpired(token);
      
      expect(isExpired).toBe(false);
    });

    it('должен возвращать true для некорректного токена', () => {
      const isExpired = JWTService.isTokenExpired('invalid.token');
      expect(isExpired).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('должен возвращать дату истечения', () => {
      const token = JWTService.generateAccessToken(mockPayload);
      const expiration = JWTService.getTokenExpiration(token);
      
      expect(expiration).toBeInstanceOf(Date);
      expect(expiration!.getTime()).toBeGreaterThan(Date.now());
    });

    it('должен возвращать null для некорректного токена', () => {
      const expiration = JWTService.getTokenExpiration('invalid.token');
      expect(expiration).toBeNull();
    });
  });
});
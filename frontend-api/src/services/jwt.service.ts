import * as jwt from 'jsonwebtoken';

export interface TokenPayload {
  userId: number;
  telegramId?: string;
  username?: string;
  authMethod: 'telegram' | 'password';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'default_secret';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'default_refresh_secret';
  private static readonly ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '15m';
  private static readonly REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';

  /**
   * Генерация пары токенов (access + refresh)
   */
  static generateTokenPair(payload: TokenPayload): TokenPair {
    const accessToken = jwt.sign(
      payload,
      this.ACCESS_TOKEN_SECRET,
      { 
        expiresIn: this.ACCESS_TOKEN_EXPIRES as string | number,
        issuer: 'family-budget-api'
      } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: payload.userId },
      this.REFRESH_TOKEN_SECRET,
      { 
        expiresIn: this.REFRESH_TOKEN_EXPIRES as string | number,
        issuer: 'family-budget-api'
      } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Генерация только access токена
   */
  static generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      payload,
      this.ACCESS_TOKEN_SECRET,
      { 
        expiresIn: this.ACCESS_TOKEN_EXPIRES as string | number,
        issuer: 'family-budget-api'
      } as jwt.SignOptions
    );
  }

  /**
   * Верификация access токена
   */
  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as TokenPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Верификация refresh токена
   */
  static verifyRefreshToken(token: string): { userId: number } | null {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as { userId: number };
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Декодирование токена без верификации (для отладки)
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Проверка истек ли токен
   */
  static isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;
      
      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Получение времени истечения токена
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return null;
      
      return new Date(decoded.exp * 1000);
    } catch (error) {
      return null;
    }
  }
}
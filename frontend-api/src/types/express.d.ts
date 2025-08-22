import { TokenPayload } from '../services/jwt.service';

declare namespace Express {
  interface Request {
    userId?: number;
    user?: TokenPayload;
    authMethod?: 'jwt' | 'session';
  }
}
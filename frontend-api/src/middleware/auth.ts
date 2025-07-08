import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
  interface SessionData {
    user?: {
      user_id: number;
      user_telegram_id: number;
      first_name?: string;
      last_name?: string;
      username?: string;
    };
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.session?.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
};
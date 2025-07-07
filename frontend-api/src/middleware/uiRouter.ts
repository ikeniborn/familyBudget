import { Request, Response, NextFunction } from 'express';

export function uiRouterMiddleware(req: Request, res: Response, next: NextFunction) {
  // If accessing root path, redirect to React frontend
  if (req.path === '/' || req.path === '') {
    return res.redirect(process.env.FRONTEND_URL || 'https://app.example.com');
  }
  
  next();
}
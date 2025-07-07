import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error(`Error ${statusCode}: ${message}`, err.stack);

  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  });
};
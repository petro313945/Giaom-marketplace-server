import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode
    });
    return;
  }

  // Default error
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    statusCode: 500
  });
};

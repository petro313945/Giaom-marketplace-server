import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import mongoose from 'mongoose';

// Enhanced error handler with better logging and consistent format
export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  const errorDetails = {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    ip: req.ip,
    user: (req as any).user?.email || 'anonymous'
  };

  // Handle Mongoose validation errors
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map(e => e.message);
    console.error('Validation Error:', errorDetails);
    res.status(400).json({
      error: 'Validation failed',
      details: errors,
      statusCode: 400
    });
    return;
  }

  // Handle Mongoose cast errors (invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    console.error('Cast Error:', errorDetails);
    res.status(400).json({
      error: `Invalid ${err.path}: ${err.value}`,
      statusCode: 400
    });
    return;
  }

  // Handle duplicate key errors
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    console.error('Duplicate Key Error:', errorDetails);
    res.status(409).json({
      error: `${field} already exists`,
      statusCode: 409
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    console.error('JWT Error:', errorDetails);
    res.status(401).json({
      error: 'Invalid token',
      statusCode: 401
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    console.error('Token Expired:', errorDetails);
    res.status(401).json({
      error: 'Token expired',
      statusCode: 401
    });
    return;
  }

  // Handle custom AppError
  if (err instanceof AppError) {
    console.error('App Error:', errorDetails);
    res.status(err.statusCode).json({
      error: err.message,
      statusCode: err.statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
    return;
  }

  // Default error - log full details
  console.error('Unhandled Error:', errorDetails);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    statusCode: 500,
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: errorDetails 
    })
  });
};

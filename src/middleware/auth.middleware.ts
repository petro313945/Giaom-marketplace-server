import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt';
import User, { IUser } from '../models/User';
import { createError } from '../utils/errors';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: IUser;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('No token provided', 401);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, JWT_CONFIG.secret) as { userId: string };

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      throw createError('User not found', 404);
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    if (error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    res.status(error.statusCode || 500).json({ error: error.message || 'Authentication failed' });
  }
};

// Optional authentication - sets req.user if token is provided, but doesn't require it
export const optionalAuthenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided - continue as guest
      req.user = undefined;
      next();
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_CONFIG.secret) as { userId: string };

      // Get user from database
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user) {
        // Attach user to request
        req.user = user;
      }
    } catch (tokenError) {
      // Invalid or expired token - continue as guest
      req.user = undefined;
    }

    next();
  } catch (error: any) {
    // On any error, continue as guest
    req.user = undefined;
    next();
  }
};
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { createError } from '../utils/errors';

type UserRole = 'customer' | 'seller' | 'admin';

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRole = req.user.role as UserRole;
    
    // Admin has access to everything
    if (userRole === 'admin') {
      next();
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

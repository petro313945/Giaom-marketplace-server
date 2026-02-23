import { Router } from 'express';
import { register, login, getCurrentUser, refreshToken } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateRegister, validateLogin } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/me', authenticate, getCurrentUser);

export default router;

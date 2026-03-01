import { Router } from 'express';
import {
  getCurrentUserProfile,
  updateCurrentUserProfile,
  getAllUsers,
  getUserById,
  changeUserRole,
  createUser,
  updateUser,
  deleteUser
} from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Current user routes
router.get('/profile', getCurrentUserProfile);
router.put('/profile', updateCurrentUserProfile);

// Admin only routes
router.post('/', requireRole('admin'), createUser);
router.get('/', requireRole('admin'), getAllUsers);
router.get('/:id', requireRole('admin'), getUserById);
router.put('/:id', requireRole('admin'), updateUser);
router.put('/:id/role', requireRole('admin'), changeUserRole);
router.delete('/:id', requireRole('admin'), deleteUser);

export default router;

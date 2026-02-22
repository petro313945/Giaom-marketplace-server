import { Router } from 'express';
import {
  applyToBecomeSeller,
  getCurrentSellerProfile,
  updateSellerProfile,
  getPendingSellers,
  getAllSellers,
  approveSeller,
  rejectSeller
} from '../controllers/seller.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Current user seller routes
router.post('/apply', applyToBecomeSeller);
router.get('/profile', getCurrentSellerProfile);
router.put('/profile', updateSellerProfile);

// Admin only routes
router.get('/pending', requireRole('admin'), getPendingSellers);
router.get('/', requireRole('admin'), getAllSellers);
router.put('/:id/approve', requireRole('admin'), approveSeller);
router.put('/:id/reject', requireRole('admin'), rejectSeller);

export default router;

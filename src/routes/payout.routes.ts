import { Router } from 'express';
import {
  getEarningsSummary,
  getPayoutHistory,
  requestPayout,
  getPayoutById,
  getAllPayouts,
  updatePayoutStatus,
  getPayoutStats
} from '../controllers/payout.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Seller routes
router.get('/earnings', requireRole('seller'), getEarningsSummary);
router.get('/history', requireRole('seller'), getPayoutHistory);
router.post('/request', requireRole('seller'), requestPayout);
router.get('/:id', getPayoutById); // Both seller and admin can access

// Admin routes
router.get('/admin/all', requireRole('admin'), getAllPayouts);
router.get('/admin/stats', requireRole('admin'), getPayoutStats);
router.put('/admin/:id/status', requireRole('admin'), updatePayoutStatus);

export default router;

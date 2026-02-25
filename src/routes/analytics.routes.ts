import { Router } from 'express';
import { getSellerAnalytics } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Seller analytics (sellers can only see their own analytics)
router.get('/seller', requireRole('seller'), getSellerAnalytics);

export default router;

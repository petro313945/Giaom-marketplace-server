import { Router } from 'express';
import {
  getHomeSettings,
  getHomeSettingsAdmin,
  updateHomeSettings
} from '../controllers/homeSettings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Public route - get featured items for home page
router.get('/', getHomeSettings);

// Admin routes
router.get('/admin', authenticate, requireRole('admin'), getHomeSettingsAdmin);
router.put('/admin', authenticate, requireRole('admin'), updateHomeSettings);

export default router;

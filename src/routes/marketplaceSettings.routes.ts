import { Router } from 'express';
import {
  getMarketplaceSettings,
  getMarketplaceSettingsAdmin,
  updateMarketplaceSettings
} from '../controllers/marketplaceSettings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Public route - get commission rate (sellers can see this)
router.get('/', getMarketplaceSettings);

// Admin routes
router.get('/admin', authenticate, requireRole('admin'), getMarketplaceSettingsAdmin);
router.put('/admin', authenticate, requireRole('admin'), updateMarketplaceSettings);

export default router;

import { Router } from 'express';
import {
  submitReport,
  getAllReports,
  getReport,
  getPendingReportsCount,
  resolveReport,
  dismissReport,
  updateReportStatus
} from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateId } from '../middleware/validation.middleware';

const router = Router();

// Protected routes (require authentication)
router.use(authenticate);

// User routes
router.post('/', submitReport);

// Admin routes
router.get('/admin/count', requireRole('admin'), getPendingReportsCount);
router.get('/admin', requireRole('admin'), getAllReports);
router.get('/admin/:id', requireRole('admin'), validateId, getReport);
router.put('/admin/:id/resolve', requireRole('admin'), validateId, resolveReport);
router.put('/admin/:id/dismiss', requireRole('admin'), validateId, dismissReport);
router.put('/admin/:id/status', requireRole('admin'), validateId, updateReportStatus);

export default router;

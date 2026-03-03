import { Router } from 'express';
import {
  createBackup,
  listBackups,
  downloadBackup,
  deleteBackup
} from '../controllers/backup.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('admin'));

// Create a new backup
router.post('/', createBackup);

// List all backups
router.get('/', listBackups);

// Download a backup file
router.get('/download/:filename', downloadBackup);

// Delete a backup file
router.delete('/:filename', deleteBackup);

export default router;

import { Router } from 'express';
import {
  getAllCategories,
  getProductsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoriesAdmin
} from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Public routes
router.get('/', getAllCategories);
router.get('/:slug/products', getProductsByCategory);

// Admin routes
router.get('/admin/all', authenticate, requireRole('admin'), getAllCategoriesAdmin);
router.post('/', authenticate, requireRole('admin'), createCategory);
router.put('/:id', authenticate, requireRole('admin'), updateCategory);
router.delete('/:id', authenticate, requireRole('admin'), deleteCategory);

export default router;

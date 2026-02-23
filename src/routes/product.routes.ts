import { Router } from 'express';
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getSellerProducts,
  getPendingProducts,
  approveProduct,
  rejectProduct,
  getAllProductsAdmin
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateCreateProduct, validateUpdateProduct, validateId, validateProductQuery } from '../middleware/validation.middleware';

const router = Router();

// Public routes
router.get('/', validateProductQuery, getAllProducts);
router.get('/:id', validateId, getProductById);

// Protected routes (require authentication)
router.use(authenticate);

// Admin only routes (must be before /:id routes to avoid route conflicts)
router.get('/admin/all', requireRole('admin'), getAllProductsAdmin);
router.get('/pending/all', requireRole('admin'), getPendingProducts);
router.put('/:id/approve', requireRole('admin'), approveProduct);
router.put('/:id/reject', requireRole('admin'), rejectProduct);

// Seller routes
router.post('/', requireRole('seller', 'admin'), validateCreateProduct, createProduct);
router.get('/seller/my-products', requireRole('seller', 'admin'), getSellerProducts);
router.put('/:id', validateId, validateUpdateProduct, updateProduct); // Seller can update own, admin can update any
router.delete('/:id', validateId, deleteProduct); // Seller can delete own, admin can delete any

export default router;

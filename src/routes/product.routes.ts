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
  rejectProduct
} from '../controllers/product.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Protected routes (require authentication)
router.use(authenticate);

// Seller routes
router.post('/', requireRole('seller', 'admin'), createProduct);
router.get('/seller/my-products', requireRole('seller', 'admin'), getSellerProducts);
router.put('/:id', updateProduct); // Seller can update own, admin can update any
router.delete('/:id', deleteProduct); // Seller can delete own, admin can delete any

// Admin only routes
router.get('/pending/all', requireRole('admin'), getPendingProducts);
router.put('/:id/approve', requireRole('admin'), approveProduct);
router.put('/:id/reject', requireRole('admin'), rejectProduct);

export default router;

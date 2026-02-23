import { Router } from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus,
  getAllOrders
} from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateCreateOrder, validateId } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer routes
router.post('/', validateCreateOrder, createOrder);
router.get('/', getUserOrders);
router.get('/:id', validateId, getOrderById);

// Seller routes
router.get('/seller/my-orders', requireRole('seller', 'admin'), getSellerOrders);
router.put('/:id/status', validateId, updateOrderStatus); // Seller can update their product orders, admin can update any

// Admin routes
router.get('/admin/all', requireRole('admin'), getAllOrders);

export default router;

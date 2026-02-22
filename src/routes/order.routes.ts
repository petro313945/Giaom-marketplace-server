import { Router } from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus
} from '../controllers/order.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Customer routes
router.post('/', createOrder);
router.get('/', getUserOrders);
router.get('/:id', getOrderById);

// Seller routes
router.get('/seller/my-orders', requireRole('seller', 'admin'), getSellerOrders);
router.put('/:id/status', updateOrderStatus); // Seller can update their product orders, admin can update any

export default router;

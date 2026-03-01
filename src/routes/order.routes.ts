import { Router } from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus,
  updateTrackingNumber,
  getAllOrders
} from '../controllers/order.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateCreateOrder, validateId } from '../middleware/validation.middleware';

const router = Router();

// Create order route allows optional authentication (for guest checkout)
router.post('/', optionalAuthenticate, validateCreateOrder, createOrder);

// Get order by ID allows optional authentication (for guest order viewing)
router.get('/:id', optionalAuthenticate, validateId, getOrderById);

// All other routes require authentication
router.use(authenticate);
router.get('/', getUserOrders);

// Seller routes
router.get('/seller/my-orders', requireRole('seller', 'admin'), getSellerOrders);
router.put('/:id/status', validateId, updateOrderStatus); // Seller can update their product orders, admin can update any
router.put('/:id/tracking', validateId, updateTrackingNumber); // Seller can update tracking for their product orders, admin can update any

// Admin routes
router.get('/admin/all', requireRole('admin'), getAllOrders);

export default router;

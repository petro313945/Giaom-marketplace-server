import { Router } from 'express';
import {
  createOrder,
  getUserOrders,
  getOrderById,
  getSellerOrders,
  updateOrderStatus,
  updateTrackingNumber,
  getAllOrders,
  requestRefund,
  getRefundRequests,
  getRefundRequestById,
  updateRefundRequestStatus,
  processRefund
} from '../controllers/order.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateCreateOrder, validateId } from '../middleware/validation.middleware';

const router = Router();

// IMPORTANT: Route order matters! Express matches routes in the order they're defined.
// Specific routes (like /refunds, /admin/all) MUST come BEFORE parameterized routes (like /:id)
// Otherwise /refunds will be matched by /:id and fail validation

// Create order route allows optional authentication (for guest checkout)
router.post('/', optionalAuthenticate, validateCreateOrder, createOrder);

// Specific routes that require authentication - define BEFORE /:id to avoid route conflicts
// These must have authenticate middleware applied individually
router.get('/refunds', authenticate, getRefundRequests); // Get refund requests (customer sees their own, admin sees all)
router.get('/seller/my-orders', authenticate, requireRole('seller', 'admin'), getSellerOrders);
router.get('/admin/all', authenticate, requireRole('admin'), getAllOrders);
router.get('/', authenticate, getUserOrders);

// Get order by ID - allows optional authentication (for guest order viewing)
// This comes after specific routes so /refunds matches before /:id
router.get('/:id', optionalAuthenticate, validateId, getOrderById);

// Apply authenticate middleware to all remaining routes
router.use(authenticate);

// Specific routes with parameters - must come before generic /:id routes
router.get('/refunds/:id', validateId, getRefundRequestById); // Get specific refund request
router.put('/refunds/:id/status', validateId, requireRole('admin'), updateRefundRequestStatus); // Admin updates refund status
router.post('/refunds/:id/process', validateId, requireRole('admin'), processRefund); // Admin processes refund

// Parameterized routes (must come LAST to avoid matching specific routes)
router.put('/:id/status', validateId, updateOrderStatus); // Seller can update their product orders, admin can update any
router.put('/:id/tracking', validateId, updateTrackingNumber); // Seller can update tracking for their product orders, admin can update any
router.post('/:id/refund', validateId, requestRefund); // Customer can request refund for their order

export default router;

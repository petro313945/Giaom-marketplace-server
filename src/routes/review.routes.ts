import { Router } from 'express';
import {
  submitReview,
  getProductReviews,
  getReviewStats,
  getUserReview,
  updateReview,
  deleteReview,
  getPendingReviews,
  approveReview,
  rejectReview,
  getSellerReviews,
  getAllReviewsAdmin
} from '../controllers/review.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';
import { validateId, validateProductId, validateReviewSubmission } from '../middleware/validation.middleware';

const router = Router();

// Public routes - more specific routes first
router.get('/product/:productId/stats', validateProductId, getReviewStats);
router.get('/product/:productId', validateProductId, getProductReviews);

// Protected routes (require authentication)
router.use(authenticate);

// Seller routes
router.get('/seller', getSellerReviews);

// User routes - more specific routes first
router.get('/product/:productId/my-review', validateProductId, getUserReview);
router.post('/product/:productId', validateProductId, validateReviewSubmission, submitReview);
router.put('/:id', validateId, validateReviewSubmission, updateReview);
router.delete('/:id', validateId, deleteReview);

// Admin routes - more specific routes first
router.get('/admin/all', requireRole('admin'), getAllReviewsAdmin);
router.get('/admin/pending', requireRole('admin'), getPendingReviews);
router.put('/:id/approve', requireRole('admin'), validateId, approveReview);
router.put('/:id/reject', requireRole('admin'), validateId, rejectReview);

export default router;

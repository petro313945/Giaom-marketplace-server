import { Router } from 'express';
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  checkWishlistStatus
} from '../controllers/wishlist.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validateProductId } from '../middleware/validation.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Wishlist routes
router.get('/', getWishlist);
router.post('/', addToWishlist);
router.delete('/:productId', validateProductId, removeFromWishlist);
router.get('/check/:productId', validateProductId, checkWishlistStatus);

export default router;

import { Router } from 'express';
import {
  createPaymentIntent,
  confirmPayment
} from '../controllers/payment.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// Use optional authentication - allows both authenticated and guest users
router.use(optionalAuthenticate);

// Create payment intent
router.post('/create-intent', createPaymentIntent);

// Confirm payment
router.post('/confirm', confirmPayment);

export default router;

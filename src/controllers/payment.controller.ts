import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { getStripe } from '../config/stripe';

// Create payment intent
export const createPaymentIntent = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get user's cart
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    // Validate products and calculate total
    let totalAmount = 0;

    for (const cartItem of cart.items) {
      const product = await Product.findById(cartItem.productId);
      
      if (!product) {
        res.status(400).json({ error: `Product ${cartItem.productId} not found` });
        return;
      }

      if (product.status !== 'approved') {
        res.status(400).json({ error: `Product ${product.title} is not available` });
        return;
      }

      // Get item price - use variant price if variant is provided
      let itemPrice: number;
      
      if (cartItem.variant && (cartItem.variant.size || cartItem.variant.color)) {
        // Find matching variant
        const matchingVariant = product.variants?.find((v: any) => {
          const sizeMatch = !cartItem.variant?.size || v.size === cartItem.variant.size;
          const colorMatch = !cartItem.variant?.color || v.color === cartItem.variant.color;
          return sizeMatch && colorMatch;
        });

        if (!matchingVariant) {
          res.status(400).json({ error: `Selected variant not found for ${product.title}` });
          return;
        }

        itemPrice = matchingVariant.price !== undefined ? matchingVariant.price : product.price;
      } else {
        itemPrice = product.price;
      }

      const itemTotal = itemPrice * cartItem.quantity;
      totalAmount += itemTotal;
    }

    // Add tax (8%)
    const tax = totalAmount * 0.08;
    const finalAmount = Math.round((totalAmount + tax) * 100); // Convert to cents

    // Create payment intent
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: 'usd',
      metadata: {
        userId: req.user._id.toString(),
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment intent' });
  }
};

// Confirm payment (verify payment intent status)
export const confirmPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      res.status(400).json({ error: 'Payment intent ID is required' });
      return;
    }

    // Retrieve payment intent from Stripe
    const stripe = getStripe();
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify the payment intent belongs to the user
    if (paymentIntent.metadata.userId !== req.user._id.toString()) {
      res.status(403).json({ error: 'Payment intent does not belong to this user' });
      return;
    }

    // Check payment status
    if (paymentIntent.status === 'succeeded') {
      res.status(200).json({
        success: true,
        paymentStatus: 'succeeded',
        paymentIntentId: paymentIntent.id,
        paymentMethod: paymentIntent.payment_method ? 'card' : 'unknown',
      });
    } else if (paymentIntent.status === 'requires_payment_method') {
      res.status(400).json({
        success: false,
        paymentStatus: 'requires_payment_method',
        error: 'Payment method is required',
      });
    } else if (paymentIntent.status === 'requires_confirmation') {
      res.status(400).json({
        success: false,
        paymentStatus: 'requires_confirmation',
        error: 'Payment requires confirmation',
      });
    } else {
      res.status(400).json({
        success: false,
        paymentStatus: paymentIntent.status,
        error: `Payment status: ${paymentIntent.status}`,
      });
    }
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ error: error.message || 'Failed to confirm payment' });
  }
};

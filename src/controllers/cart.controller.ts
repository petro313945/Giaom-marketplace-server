import { Response } from 'express';
import Cart, { ICartItem } from '../models/Cart';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth.middleware';

// Get user's cart
export const getCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');

    if (!cart) {
      // Create empty cart if doesn't exist
      cart = await Cart.create({
        userId: req.user._id,
        items: []
      });
    }

    res.json({
      cart: {
        id: cart._id,
        userId: cart.userId,
        items: cart.items.map(item => ({
          id: item._id,
          productId: item.productId,
          quantity: item.quantity
        })),
        createdAt: cart.createdAt,
        updatedAt: cart.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get cart' });
  }
};

// Add item to cart
export const addToCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { productId, quantity = 1 } = req.body;

    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    if (quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }

    // Check if product exists and is approved
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.status !== 'approved') {
      res.status(400).json({ error: 'Product is not available for purchase' });
      return;
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = await Cart.create({
        userId: req.user._id,
        items: []
      });
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item
      cart.items.push({
        productId: product._id,
        quantity
      } as ICartItem);
    }

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      message: 'Item added to cart successfully',
      cart: {
        id: cart._id,
        items: cart.items.map(item => ({
          id: item._id,
          productId: item.productId,
          quantity: item.quantity
        }))
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to add item to cart' });
  }
};

// Update cart item quantity
export const updateCartItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { itemId } = req.params;
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      res.status(400).json({ error: 'Quantity must be at least 1' });
      return;
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    const itemIndex = cart.items.findIndex(
      item => item._id?.toString() === itemId
    );

    if (itemIndex === -1) {
      res.status(404).json({ error: 'Cart item not found' });
      return;
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();
    await cart.populate('items.productId');

    res.json({
      message: 'Cart item updated successfully',
      cart: {
        id: cart._id,
        items: cart.items.map(item => ({
          id: item._id,
          productId: item.productId,
          quantity: item.quantity
        }))
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid item ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update cart item' });
  }
};

// Remove item from cart
export const removeFromCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { itemId } = req.params;

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.items = cart.items.filter(
      item => item._id?.toString() !== itemId
    );

    await cart.save();
    await cart.populate('items.productId');

    res.json({
      message: 'Item removed from cart successfully',
      cart: {
        id: cart._id,
        items: cart.items.map(item => ({
          id: item._id,
          productId: item.productId,
          quantity: item.quantity
        }))
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid item ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to remove item from cart' });
  }
};

// Clear entire cart
export const clearCart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      res.status(404).json({ error: 'Cart not found' });
      return;
    }

    cart.items = [];
    await cart.save();

    res.json({
      message: 'Cart cleared successfully',
      cart: {
        id: cart._id,
        items: []
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to clear cart' });
  }
};

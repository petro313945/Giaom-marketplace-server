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
          quantity: item.quantity,
          variant: item.variant || undefined
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

    const { productId, quantity = 1, variant } = req.body;

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

    // Check if product has variants - if so, variant must be provided
    if (product.variants && product.variants.length > 0) {
      if (!variant || (!variant.size && !variant.color)) {
        res.status(400).json({ 
          error: 'This product has variants. Please select a variant (size/color) before adding to cart.' 
        });
        return;
      }
    }

    // Check stock availability - use variant stock if variant is provided, otherwise use product stock
    let availableStock: number;
    if (variant && (variant.size || variant.color)) {
      // Find matching variant
      const matchingVariant = product.variants?.find((v: any) => {
        const sizeMatch = !variant.size || v.size === variant.size;
        const colorMatch = !variant.color || v.color === variant.color;
        return sizeMatch && colorMatch;
      });

      if (!matchingVariant) {
        res.status(400).json({ error: 'Selected variant not found for this product' });
        return;
      }

      availableStock = matchingVariant.stock;
    } else {
      availableStock = product.stockQuantity;
    }

    // Validate stock availability
    if (availableStock === undefined || availableStock === null || availableStock < 0) {
      res.status(400).json({ 
        error: 'Product stock information is invalid. Please contact support.' 
      });
      return;
    }

    if (availableStock < quantity) {
      res.status(400).json({ 
        error: `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}` 
      });
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

    // Check if item already exists in cart (match by productId and variant)
    const existingItemIndex = cart.items.findIndex(item => {
      const productMatch = item.productId.toString() === productId;
      if (!variant || (!variant.size && !variant.color)) {
        // No variant specified - match only by productId and no variant
        return productMatch && !item.variant;
      }
      // Variant specified - match by productId and variant
      if (!productMatch) return false;
      if (!item.variant) return false;
      const sizeMatch = !variant.size || item.variant.size === variant.size;
      const colorMatch = !variant.color || item.variant.color === variant.color;
      return sizeMatch && colorMatch;
    });

    let newQuantity: number;
    if (existingItemIndex > -1) {
      // Update quantity
      newQuantity = cart.items[existingItemIndex].quantity + quantity;
      // Check if total quantity exceeds stock
      if (availableStock < newQuantity) {
        res.status(400).json({ 
          error: `Insufficient stock. Available: ${availableStock}, Total in cart: ${newQuantity}` 
        });
        return;
      }
      cart.items[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.items.push({
        productId: product._id,
        quantity,
        variant: variant && (variant.size || variant.color) ? {
          size: variant.size,
          color: variant.color
        } : undefined
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
          quantity: item.quantity,
          variant: item.variant || undefined
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

    // Check stock availability for the updated quantity
    const product = await Product.findById(cart.items[itemIndex].productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check variant stock if variant is present
    const cartItem = cart.items[itemIndex];
    let availableStock: number;
    if (cartItem.variant && (cartItem.variant.size || cartItem.variant.color)) {
      const matchingVariant = product.variants?.find((v: any) => {
        const sizeMatch = !cartItem.variant?.size || v.size === cartItem.variant.size;
        const colorMatch = !cartItem.variant?.color || v.color === cartItem.variant.color;
        return sizeMatch && colorMatch;
      });

      if (!matchingVariant) {
        res.status(400).json({ error: 'Selected variant not found for this product' });
        return;
      }

      availableStock = matchingVariant.stock;
    } else {
      availableStock = product.stockQuantity;
    }

    if (availableStock < quantity) {
      res.status(400).json({ 
        error: `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}` 
      });
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
          quantity: item.quantity,
          variant: item.variant || undefined
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
          quantity: item.quantity,
          variant: item.variant || undefined
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

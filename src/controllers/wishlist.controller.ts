import { Response } from 'express';
import Wishlist from '../models/Wishlist';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth.middleware';

// Get user's wishlist
export const getWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    let wishlist = await Wishlist.findOne({ userId: req.user._id }).populate('items.productId');

    if (!wishlist) {
      // Create empty wishlist if doesn't exist
      wishlist = await Wishlist.create({
        userId: req.user._id,
        items: []
      });
    }

    res.json({
      wishlist: {
        id: wishlist._id,
        userId: wishlist.userId,
        items: wishlist.items.map(item => ({
          id: item._id,
          productId: item.productId,
          addedAt: item.addedAt
        })),
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get wishlist' });
  }
};

// Add item to wishlist
export const addToWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { productId } = req.body;

    if (!productId) {
      res.status(400).json({ error: 'Product ID is required' });
      return;
    }

    // Check if product exists and is approved
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.status !== 'approved') {
      res.status(400).json({ error: 'Product is not available' });
      return;
    }

    // Get or create wishlist
    let wishlist = await Wishlist.findOne({ userId: req.user._id });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId: req.user._id,
        items: []
      });
    }

    // Check if item already exists in wishlist
    const existingItem = wishlist.items.find(
      (item: any) => item.productId.toString() === productId
    );

    if (existingItem) {
      res.status(400).json({ error: 'Product already in wishlist' });
      return;
    }

    // Add new item
    wishlist.items.push({
      productId: product._id,
      addedAt: new Date()
    } as any);

    await wishlist.save();
    await wishlist.populate('items.productId');

    res.json({
      message: 'Item added to wishlist successfully',
      wishlist: {
        id: wishlist._id,
        items: wishlist.items.map(item => ({
          id: item._id,
          productId: item.productId,
          addedAt: item.addedAt
        }))
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to add item to wishlist' });
  }
};

// Remove item from wishlist
export const removeFromWishlist = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ userId: req.user._id });
    if (!wishlist) {
      res.status(404).json({ error: 'Wishlist not found' });
      return;
    }

    // Remove item
    wishlist.items = wishlist.items.filter(
      (item: any) => item.productId.toString() !== productId
    );

    await wishlist.save();
    await wishlist.populate('items.productId');

    res.json({
      message: 'Item removed from wishlist successfully',
      wishlist: {
        id: wishlist._id,
        items: wishlist.items.map(item => ({
          id: item._id,
          productId: item.productId,
          addedAt: item.addedAt
        }))
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to remove item from wishlist' });
  }
};

// Check if product is in wishlist
export const checkWishlistStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ userId: req.user._id });
    if (!wishlist) {
      res.json({ inWishlist: false });
      return;
    }

    const inWishlist = wishlist.items.some(
      (item: any) => item.productId.toString() === productId
    );

    res.json({ inWishlist });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to check wishlist status' });
  }
};

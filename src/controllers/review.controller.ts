import { Response } from 'express';
import Review from '../models/Review';
import Product from '../models/Product';
import Order from '../models/Order';
import { AuthRequest } from '../middleware/auth.middleware';

// Submit a review (only if user has purchased the product)
export const submitReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { productId } = req.params;
    
    // Prevent matching routes like /product/my-review
    if (productId === 'my-review' || productId === 'stats' || productId === 'admin' || productId === 'pending') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Rating must be between 1 and 5' });
      return;
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if user has purchased this product
    const hasPurchased = await Order.findOne({
      userId: req.user._id,
      'items.productId': productId,
      status: { $in: ['processing', 'shipped', 'delivered'] }
    });

    if (!hasPurchased) {
      res.status(403).json({ 
        error: 'You can only review products you have purchased' 
      });
      return;
    }

    // Check if user has already reviewed this product
    const existingReview = await Review.findOne({
      productId,
      userId: req.user._id
    });

    if (existingReview) {
      res.status(400).json({ error: 'You have already reviewed this product' });
      return;
    }

    // Create review (default status: pending for moderation)
    const review = await Review.create({
      productId,
      userId: req.user._id,
      rating: Number(rating),
      comment: comment?.trim() || '',
      status: 'pending'
    });

    // Populate user info
    await review.populate('userId', 'email fullName');

    res.status(201).json({
      message: 'Review submitted successfully (pending moderation)',
      review: {
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt
      }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'You have already reviewed this product' });
      return;
    }
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to submit review' });
  }
};

// Get reviews for a product (only approved reviews for public, all for admin)
export const getProductReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    // Prevent matching routes like /product/my-review
    if (productId === 'my-review' || productId === 'stats' || productId === 'admin' || productId === 'pending') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Build query - show only approved reviews to public, all to admin
    const query: any = { productId };
    if (!req.user || req.user.role !== 'admin') {
      query.status = 'approved';
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(query)
    ]);

    res.json({
      reviews: reviews.map(review => ({
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get reviews' });
  }
};

// Get review statistics for a product
export const getReviewStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;

    // Prevent matching routes like /product/my-review
    if (productId === 'my-review' || productId === 'stats' || productId === 'admin' || productId === 'pending') {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Get only approved reviews for stats
    const reviews = await Review.find({ 
      productId, 
      status: 'approved' 
    });

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;

    // Calculate rating distribution
    const ratingDistribution = {
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length
    };

    res.json({
      productId,
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      ratingDistribution
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get review stats' });
  }
};

// Get user's review for a product (if exists)
export const getUserReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { productId } = req.params;

    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const review = await Review.findOne({
      productId,
      userId: req.user._id
    }).populate('userId', 'email fullName');

    if (!review) {
      // Return 200 with null review instead of 404
      res.json({
        review: null
      });
      return;
    }

    res.json({
      review: {
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get review' });
  }
};

// Update user's own review
export const updateReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    // Check if user owns this review or is admin
    const isOwner = req.user._id.toString() === review.userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'You can only update your own reviews' });
      return;
    }

    // Update fields
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        res.status(400).json({ error: 'Rating must be between 1 and 5' });
        return;
      }
      review.rating = Number(rating);
    }
    if (comment !== undefined) {
      review.comment = comment.trim();
    }

    // Reset status to pending if updated by owner (not admin)
    if (isOwner && !isAdmin && review.status === 'approved') {
      review.status = 'pending';
    }

    await review.save();
    await review.populate('userId', 'email fullName');

    res.json({
      message: 'Review updated successfully',
      review: {
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        updatedAt: review.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid review ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update review' });
  }
};

// Delete user's own review
export const deleteReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    // Check if user owns this review or is admin
    const isOwner = req.user._id.toString() === review.userId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'You can only delete your own reviews' });
      return;
    }

    await Review.findByIdAndDelete(reviewId);

    res.json({
      message: 'Review deleted successfully'
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid review ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to delete review' });
  }
};

// Admin: Get all pending reviews
export const getPendingReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      Review.find({ status: 'pending' })
        .populate('userId', 'email fullName')
        .populate('productId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ status: 'pending' })
    ]);

    res.json({
      reviews: reviews.map(review => ({
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get pending reviews' });
  }
};

// Admin: Get all reviews (optionally filter by status)
export const getAllReviewsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const status = (req.query.status as string) || 'all';
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('userId', 'email fullName')
        .populate('productId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(query)
    ]);

    res.json({
      reviews: reviews.map(review => ({
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get reviews' });
  }
};

// Admin: Approve review
export const approveReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id: reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    review.status = 'approved';
    await review.save();

    res.json({
      message: 'Review approved successfully',
      review: {
        id: review._id,
        status: review.status,
        updatedAt: review.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid review ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to approve review' });
  }
};

// Admin: Reject review
export const rejectReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id: reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }

    review.status = 'rejected';
    await review.save();

    res.json({
      message: 'Review rejected successfully',
      review: {
        id: review._id,
        status: review.status,
        updatedAt: review.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid review ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to reject review' });
  }
};

// Seller: Get all reviews for seller's products
export const getSellerReviews = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user is a seller
    if (req.user.role !== 'seller' && req.user.role !== 'admin') {
      res.status(403).json({ error: 'Seller access required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    // Get all product IDs for this seller
    const sellerProducts = await Product.find({ sellerId: req.user._id }).select('_id');
    const productIds = sellerProducts.map(p => p._id);

    if (productIds.length === 0) {
      res.json({
        reviews: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0
        }
      });
      return;
    }

    // Get reviews for seller's products
    const [reviews, total] = await Promise.all([
      Review.find({ productId: { $in: productIds } })
        .populate('userId', 'email fullName')
        .populate('productId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ productId: { $in: productIds } })
    ]);

    res.json({
      reviews: reviews.map(review => ({
        id: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        comment: review.comment,
        status: review.status,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get seller reviews' });
  }
};
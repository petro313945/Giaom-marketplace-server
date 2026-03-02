import { Response } from 'express';
import HomeSettings from '../models/HomeSettings';
import Category from '../models/Category';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth.middleware';

// Get home settings (public - returns featured items)
export const getHomeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let settings = await HomeSettings.findOne();
    if (!settings) {
      settings = await HomeSettings.create({});
    }

    // Populate featured categories
    const categories = await Category.find({
      _id: { $in: settings.featuredCategories },
      isActive: true
    }).limit(6).sort({ name: 1 });

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({
          category: category.slug,
          status: 'approved'
        });
        return {
          id: category._id,
          _id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          isActive: category.isActive,
          productCount: count
        };
      })
    );

    // Populate featured products
    const products = await Product.find({
      _id: { $in: settings.featuredProducts },
      status: 'approved'
    }).limit(12).populate('sellerId', 'email fullName').sort({ createdAt: -1 });

    res.json({
      featuredCategories: categoriesWithCount,
      featuredProducts: products.map(product => ({
        id: product._id,
        _id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        stockQuantity: product.stockQuantity,
        variants: product.variants || [],
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get home settings' });
  }
};

// Get home settings for admin (includes all data)
export const getHomeSettingsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    let settings = await HomeSettings.findOne();
    if (!settings) {
      settings = await HomeSettings.create({});
    }

    // Get all categories for selection
    const allCategories = await Category.find().sort({ name: 1 });
    
    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      allCategories.map(async (category) => {
        const count = await Product.countDocuments({
          category: category.slug,
          status: 'approved'
        });
        return {
          id: category._id,
          _id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          isActive: category.isActive,
          productCount: count
        };
      })
    );
    
    // Get all approved products for selection
    const allProducts = await Product.find({ status: 'approved' })
      .populate('sellerId', 'email fullName')
      .sort({ createdAt: -1 })
      .limit(100); // Limit to recent products for selection

    res.json({
      featuredCategoryIds: settings.featuredCategories.map(id => id.toString()),
      featuredProductIds: settings.featuredProducts.map(id => id.toString()),
      allCategories: categoriesWithCount,
      allProducts: allProducts.map(product => ({
        id: product._id,
        _id: product._id,
        title: product.title,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        status: product.status
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get home settings' });
  }
};

// Update home settings (admin only)
export const updateHomeSettings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { featuredCategoryIds, featuredProductIds } = req.body;

    // Validate input
    if (featuredCategoryIds && !Array.isArray(featuredCategoryIds)) {
      res.status(400).json({ error: 'featuredCategoryIds must be an array' });
      return;
    }

    if (featuredProductIds && !Array.isArray(featuredProductIds)) {
      res.status(400).json({ error: 'featuredProductIds must be an array' });
      return;
    }

    // Limit to 6 categories, 12 products
    const categoryIds = featuredCategoryIds ? featuredCategoryIds.slice(0, 6) : [];
    const productIds = featuredProductIds ? featuredProductIds.slice(0, 12) : [];

    // Validate that categories exist
    if (categoryIds.length > 0) {
      const categories = await Category.find({ _id: { $in: categoryIds } });
      if (categories.length !== categoryIds.length) {
        res.status(400).json({ error: 'One or more categories not found' });
        return;
      }
    }

    // Validate that products exist and are approved
    if (productIds.length > 0) {
      const products = await Product.find({ 
        _id: { $in: productIds },
        status: 'approved'
      });
      if (products.length !== productIds.length) {
        res.status(400).json({ error: 'One or more products not found or not approved' });
        return;
      }
    }

    // Get or create settings
    let settings = await HomeSettings.findOne();
    if (!settings) {
      settings = await HomeSettings.create({
        featuredCategories: categoryIds,
        featuredProducts: productIds
      });
    } else {
      settings.featuredCategories = categoryIds;
      settings.featuredProducts = productIds;
      await settings.save();
    }

    res.json({
      message: 'Home settings updated successfully',
      featuredCategoryIds: settings.featuredCategories.map(id => id.toString()),
      featuredProductIds: settings.featuredProducts.map(id => id.toString())
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update home settings' });
  }
};

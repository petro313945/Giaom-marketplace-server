import { Response } from 'express';
import Product from '../models/Product';
import Category from '../models/Category';
import { AuthRequest } from '../middleware/auth.middleware';

// Get all active categories
export const getAllCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({
          category: category.slug,
          status: 'approved'
        });
        return {
          id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          productCount: count,
          isActive: category.isActive
        };
      })
    );

    res.json({
      categories: categoriesWithCount,
      count: categoriesWithCount.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get categories' });
  }
};

// Get products by category
export const getProductsByCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;
    const {
      page = '1',
      limit = '20',
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Check if category exists and is active
    const category = await Category.findOne({ slug, isActive: true });
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Build query
    const query: any = {
      category: slug,
      status: 'approved'
    };

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const products = await Product.find(query)
      .populate('sellerId', 'email fullName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(query);

    res.json({
      category: {
        id: category._id,
        slug: category.slug,
        name: category.name,
        description: category.description
      },
      products: products.map(product => ({
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get products by category' });
  }
};

// Create category (admin only)
export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, slug, description } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    // Check if category with same name or slug exists
    const existingCategory = await Category.findOne({
      $or: [{ name }, { slug: slug.toLowerCase() }]
    });

    if (existingCategory) {
      res.status(400).json({ error: 'Category with this name or slug already exists' });
      return;
    }

    const category = await Category.create({
      name,
      slug: slug.toLowerCase(),
      description: description || '',
      isActive: true
    });

    res.status(201).json({
      message: 'Category created successfully',
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        createdAt: category.createdAt
      }
    });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'Category with this name or slug already exists' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to create category' });
  }
};

// Update category (admin only)
export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, slug, description, isActive } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Check if name or slug conflicts with another category
    if (name || slug) {
      const existingCategory = await Category.findOne({
        _id: { $ne: id },
        $or: [
          name ? { name } : {},
          slug ? { slug: slug.toLowerCase() } : {}
        ].filter(obj => Object.keys(obj).length > 0)
      });

      if (existingCategory) {
        res.status(400).json({ error: 'Category with this name or slug already exists' });
        return;
      }
    }

    // Update fields
    if (name) category.name = name;
    if (slug) category.slug = slug.toLowerCase();
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;

    await category.save();

    res.json({
      message: 'Category updated successfully',
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        isActive: category.isActive,
        updatedAt: category.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid category ID' });
      return;
    }
    if (error.code === 11000) {
      res.status(400).json({ error: 'Category with this name or slug already exists' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update category' });
  }
};

// Delete category (admin only)
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      res.status(404).json({ error: 'Category not found' });
      return;
    }

    // Check if category has products
    const productCount = await Product.countDocuments({ category: category.slug });
    if (productCount > 0) {
      res.status(400).json({
        error: `Cannot delete category. It has ${productCount} product(s). Deactivate it instead.`
      });
      return;
    }

    await Category.findByIdAndDelete(id);

    res.json({
      message: 'Category deleted successfully'
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid category ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to delete category' });
  }
};

// Get all categories including inactive (admin only)
export const getAllCategoriesAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const categories = await Category.find().sort({ name: 1 });

    // Get product count for each category
    const categoriesWithCount = await Promise.all(
      categories.map(async (category) => {
        const count = await Product.countDocuments({
          category: category.slug,
          status: 'approved'
        });
        return {
          id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description,
          productCount: count,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt
        };
      })
    );

    res.json({
      categories: categoriesWithCount,
      count: categoriesWithCount.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get categories' });
  }
};

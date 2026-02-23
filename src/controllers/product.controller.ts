import { Response } from 'express';
import Product from '../models/Product';
import SellerProfile from '../models/SellerProfile';
import { AuthRequest } from '../middleware/auth.middleware';

// Get all approved products (with filters)
export const getAllProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      category,
      search,
      minPrice,
      maxPrice,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query: any = { status: 'approved' };

    if (category) {
      query.category = category;
    }

    if (search) {
      // Use regex search for flexible text matching
      // The text index on title/description will still help with query performance
      query.$or = [
        { title: { $regex: search as string, $options: 'i' } },
        { description: { $regex: search as string, $options: 'i' } }
      ];
    }

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
    // Handle special sort cases
    if (sortBy === 'price') {
      sort.price = sortOrder === 'asc' ? 1 : -1;
    } else if (sortBy === 'title') {
      sort.title = sortOrder === 'asc' ? 1 : -1;
    } else {
      // Default to createdAt
      sort.createdAt = sortOrder === 'asc' ? 1 : -1;
    }

    // Execute query
    const products = await Product.find(query)
      .populate('sellerId', 'email fullName')
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Product.countDocuments(query);

    res.json({
      products: products.map(product => ({
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
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
    res.status(500).json({ error: error.message || 'Failed to get products' });
  }
};

// Get single product
export const getProductById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id).populate('sellerId', 'email fullName');

    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Only show approved products to non-owners/admins
    if (product.status !== 'approved') {
      if (!req.user) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      // Allow seller to see their own products, or admin to see all
      const isOwner = req.user._id.toString() === product.sellerId.toString();
      const isAdmin = req.user.role === 'admin';
      if (!isOwner && !isAdmin) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
    }

    res.json({
      product: {
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get product' });
  }
};

// Create product (seller only)
export const createProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user is an approved seller
    const sellerProfile = await SellerProfile.findOne({ userId: req.user._id });
    if (!sellerProfile || sellerProfile.status !== 'approved') {
      res.status(403).json({ error: 'You must be an approved seller to create products' });
      return;
    }

    const { title, description, price, category, imageUrl, imageUrls } = req.body;

    if (!title || !price || !category) {
      res.status(400).json({ error: 'Title, price, and category are required' });
      return;
    }

    if (price <= 0) {
      res.status(400).json({ error: 'Price must be greater than 0' });
      return;
    }

    // Handle multiple images: prefer imageUrls array, fallback to imageUrl
    let finalImageUrls: string[] = [];
    if (imageUrls && Array.isArray(imageUrls) && imageUrls.length > 0) {
      finalImageUrls = imageUrls.filter((url: string) => url && url.trim() !== '');
    } else if (imageUrl && imageUrl.trim() !== '') {
      finalImageUrls = [imageUrl];
    }

    const product = await Product.create({
      sellerId: req.user._id,
      title,
      description: description || '',
      price: Number(price),
      category,
      imageUrl: finalImageUrls.length > 0 ? finalImageUrls[0] : '', // Keep first image for backward compatibility
      imageUrls: finalImageUrls,
      status: 'pending'
    });

    res.status(201).json({
      message: 'Product created successfully (pending approval)',
      product: {
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls,
        status: product.status,
        createdAt: product.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create product' });
  }
};

// Update product (seller/owner only)
export const updateProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { title, description, price, category, imageUrl, imageUrls } = req.body;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if user is the owner or admin
    const isOwner = req.user._id.toString() === product.sellerId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'You can only update your own products' });
      return;
    }

    // Update fields
    if (title) product.title = title;
    if (description !== undefined) product.description = description;
    if (price !== undefined) {
      if (price <= 0) {
        res.status(400).json({ error: 'Price must be greater than 0' });
        return;
      }
      product.price = Number(price);
    }
    if (category) product.category = category;
    
    // Handle multiple images: prefer imageUrls array, fallback to imageUrl
    if (imageUrls !== undefined) {
      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        product.imageUrls = imageUrls.filter((url: string) => url && url.trim() !== '');
        product.imageUrl = product.imageUrls[0] || ''; // Keep first image for backward compatibility
      } else {
        product.imageUrls = [];
        product.imageUrl = '';
      }
    } else if (imageUrl !== undefined) {
      // If only imageUrl is provided, update both
      product.imageUrl = imageUrl;
      product.imageUrls = imageUrl ? [imageUrl] : [];
    }

    // If updated by seller (not admin), reset status to pending
    if (isOwner && !isAdmin && product.status === 'approved') {
      product.status = 'pending';
    }

    await product.save();

    res.json({
      message: 'Product updated successfully',
      product: {
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update product' });
  }
};

// Delete product (seller/owner only)
export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    // Check if user is the owner or admin
    const isOwner = req.user._id.toString() === product.sellerId.toString();
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'You can only delete your own products' });
      return;
    }

    await Product.findByIdAndDelete(id);

    res.json({
      message: 'Product deleted successfully'
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to delete product' });
  }
};

// Get seller's own products (with pagination)
export const getSellerProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      Product.find({ sellerId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments({ sellerId: req.user._id })
    ]);

    res.json({
      products: products.map(product => ({
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get seller products' });
  }
};

// Get pending products (admin only)
export const getPendingProducts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const products = await Product.find({ status: 'pending' })
      .populate('sellerId', 'email fullName')
      .sort({ createdAt: -1 });

    res.json({
      products: products.map(product => ({
        id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        status: product.status,
        createdAt: product.createdAt
      })),
      count: products.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get pending products' });
  }
};

// Get admin product stats (total and pending counts)
export const getAdminProductStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    const [total, pending] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ status: 'pending' })
    ]);
    res.json({ total, pending });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get product stats' });
  }
};

// Get all products (admin only - includes all statuses, with pagination)
export const getAllProductsAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    const status = req.query.status as string | undefined;
    const query = status ? { status } : {};

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('sellerId', 'email fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query)
    ]);

    res.json({
      products: products.map(product => ({
        id: product._id,
        _id: product._id,
        sellerId: product.sellerId,
        title: product.title,
        description: product.description,
        price: product.price,
        category: product.category,
        imageUrl: product.imageUrl,
        imageUrls: product.imageUrls && product.imageUrls.length > 0 ? product.imageUrls : (product.imageUrl ? [product.imageUrl] : []),
        status: product.status,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get all products' });
  }
};

// Approve product (admin only)
export const approveProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.status === 'approved') {
      res.status(400).json({ error: 'Product is already approved' });
      return;
    }

    product.status = 'approved';
    await product.save();

    res.json({
      message: 'Product approved successfully',
      product: {
        id: product._id,
        title: product.title,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to approve product' });
  }
};

// Reject product (admin only)
export const rejectProduct = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const product = await Product.findById(id);
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    if (product.status === 'rejected') {
      res.status(400).json({ error: 'Product is already rejected' });
      return;
    }

    product.status = 'rejected';
    await product.save();

    res.json({
      message: 'Product rejected successfully',
      product: {
        id: product._id,
        title: product.title,
        status: product.status,
        updatedAt: product.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid product ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to reject product' });
  }
};

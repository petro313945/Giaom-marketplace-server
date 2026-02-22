import { Response } from 'express';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth.middleware';

// Create order from cart
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { shippingAddress } = req.body;

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.address ||
        !shippingAddress.city || !shippingAddress.zipCode || !shippingAddress.country) {
      res.status(400).json({ error: 'Complete shipping address is required' });
      return;
    }

    // Get user's cart
    const cart = await Cart.findOne({ userId: req.user._id }).populate('items.productId');
    if (!cart || cart.items.length === 0) {
      res.status(400).json({ error: 'Cart is empty' });
      return;
    }

    // Validate products and calculate total
    const orderItems = [];
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

      const itemTotal = product.price * cartItem.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product._id,
        quantity: cartItem.quantity,
        price: product.price,
        title: product.title
      });
    }

    // Create order
    const order = await Order.create({
      userId: req.user._id,
      items: orderItems,
      totalAmount,
      shippingAddress,
      status: 'pending'
    });

    // Clear cart after order creation
    cart.items = [];
    await cart.save();

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order._id,
        userId: order.userId,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        status: order.status,
        createdAt: order.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
};

// Get user's orders
export const getUserOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const orders = await Order.find({ userId: req.user._id })
      .populate('items.productId')
      .sort({ createdAt: -1 });

    res.json({
      orders: orders.map(order => ({
        id: order._id,
        userId: order.userId,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      })),
      count: orders.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get orders' });
  }
};

// Get order details
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    const order = await Order.findById(id).populate('items.productId');
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check if user owns the order or is admin
    const isOwner = req.user._id.toString() === order.userId.toString();
    const isAdmin = req.user.role === 'admin';
    
    if (!isOwner && !isAdmin) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      order: {
        id: order._id,
        userId: order.userId,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get order' });
  }
};

// Get seller's orders (for their products)
export const getSellerOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Get all orders
    const allOrders = await Order.find()
      .populate('items.productId')
      .sort({ createdAt: -1 });

    // Filter orders that contain products from this seller
    const sellerOrders = allOrders.filter(order => {
      return order.items.some(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });
    });

    res.json({
      orders: sellerOrders.map(order => ({
        id: order._id,
        userId: order.userId,
        items: order.items.filter(item => {
          const product = item.productId as any;
          return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
        }),
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      })),
      count: sellerOrders.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get seller orders' });
  }
};

// Update order status
export const updateOrderStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'processing', 'shipped', 'delivered', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Valid status is required' });
      return;
    }

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = order.userId.toString() === req.user!._id.toString();
    let isSeller = false;

    if (!isAdmin && !isOwner) {
      // Check if user is seller and owns products in this order
      const products = await Product.find({ _id: { $in: order.items.map(item => item.productId) } });
      isSeller = products.some(product => product.sellerId.toString() === req.user!._id.toString());
    }

    // Allow customers to cancel their own orders (only pending or processing)
    if (status === 'cancelled' && isOwner && (order.status === 'pending' || order.status === 'processing')) {
      // Customer can cancel their own pending/processing orders
    } else if (!isAdmin && !isSeller && !isOwner) {
      res.status(403).json({ error: 'You do not have permission to update this order' });
      return;
    } else if (isOwner && status !== 'cancelled') {
      // Customers can only cancel orders, not update to other statuses
      res.status(403).json({ error: 'You can only cancel your orders' });
      return;
    }

    order.status = status;
    await order.save();

    res.json({
      message: 'Order status updated successfully',
      order: {
        id: order._id,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update order status' });
  }
};

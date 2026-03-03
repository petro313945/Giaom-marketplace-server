import { Response } from 'express';
import Order from '../models/Order';
import Cart from '../models/Cart';
import Product from '../models/Product';
import User from '../models/User';
import RefundRequest from '../models/RefundRequest';
import { AuthRequest } from '../middleware/auth.middleware';
import { getStripe } from '../config/stripe';
import { sendOrderConfirmationEmail, sendOrderStatusUpdateEmail, sendLowStockAlertEmail } from '../utils/emailService';
import { calculateBulkDiscountPrice } from '../utils/bulkDiscount';

// Create order from cart
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { shippingAddress, paymentIntentId, cartItems, email } = req.body;
    const isGuest = !req.user;

    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.address ||
        !shippingAddress.city || !shippingAddress.zipCode || !shippingAddress.country) {
      res.status(400).json({ error: 'Complete shipping address is required' });
      return;
    }

    if (!paymentIntentId) {
      res.status(400).json({ error: 'Payment intent ID is required' });
      return;
    }

    // For guest checkout, email is required
    if (isGuest && !email) {
      res.status(400).json({ error: 'Email is required for guest checkout' });
      return;
    }

    // Validate email format for guests
    if (isGuest && email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
    }

    let itemsToProcess: any[] = [];

    if (isGuest) {
      // Guest checkout - use cart items from request body
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        res.status(400).json({ error: 'Cart is empty' });
        return;
      }
      itemsToProcess = cartItems;
    } else {
      // Authenticated user - get cart from database
      const cart = await Cart.findOne({ userId: req.user!._id }).populate('items.productId');
      if (!cart || cart.items.length === 0) {
        res.status(400).json({ error: 'Cart is empty' });
        return;
      }
      itemsToProcess = cart.items;
    }

    // Validate products and calculate total
    const orderItems = [];
    let totalAmount = 0;

    for (const cartItem of itemsToProcess) {
      // For guest, productId might be a string or object with id
      const productId = isGuest 
        ? (typeof cartItem.productId === 'object' ? cartItem.productId.id : cartItem.productId)
        : cartItem.productId;
      const product = await Product.findById(cartItem.productId);
      
      if (!product) {
        res.status(400).json({ error: `Product ${cartItem.productId} not found` });
        return;
      }

      if (product.status !== 'approved') {
        res.status(400).json({ error: `Product ${product.title} is not available` });
        return;
      }

      // Check stock availability - use variant stock if variant is provided
      let availableStock: number;
      let basePrice: number;
      
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

        availableStock = matchingVariant.stock;
        basePrice = matchingVariant.price !== undefined ? matchingVariant.price : product.price;
      } else {
        availableStock = product.stockQuantity;
        basePrice = product.price;
      }

      if (availableStock < cartItem.quantity) {
        res.status(400).json({ 
          error: `Insufficient stock for ${product.title}. Available: ${availableStock}, Requested: ${cartItem.quantity}` 
        });
        return;
      }

      // Apply bulk discount if available
      const itemPrice = calculateBulkDiscountPrice(basePrice, cartItem.quantity, product.bulkDiscountTiers);
      const itemTotal = itemPrice * cartItem.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        productId: product._id,
        quantity: cartItem.quantity,
        price: itemPrice,
        title: product.title,
        variant: cartItem.variant && (cartItem.variant.size || cartItem.variant.color) ? {
          size: cartItem.variant.size,
          color: cartItem.variant.color
        } : undefined
      });
    }

    // Add tax (8%)
    const tax = totalAmount * 0.08;
    const finalAmount = totalAmount + tax;

    // Verify payment intent
    let paymentIntent;
    try {
      const stripe = getStripe();
      paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error: any) {
      res.status(400).json({ error: 'Invalid payment intent' });
      return;
    }

    // Verify payment intent belongs to user (if authenticated) or is a guest payment
    if (req.user) {
      if (paymentIntent.metadata.userId !== req.user._id.toString()) {
        res.status(403).json({ error: 'Payment intent does not belong to this user' });
        return;
      }
    } else {
      // For guests, verify it's a guest payment intent
      if (paymentIntent.metadata.isGuest !== 'true') {
        res.status(403).json({ error: 'Payment intent does not belong to this guest session' });
        return;
      }
    }

    // Verify payment status
    if (paymentIntent.status !== 'succeeded') {
      res.status(400).json({ 
        error: `Payment not completed. Status: ${paymentIntent.status}` 
      });
      return;
    }

    // Verify amount matches
    const expectedAmount = Math.round(finalAmount * 100); // Convert to cents
    if (paymentIntent.amount !== expectedAmount) {
      res.status(400).json({ 
        error: 'Payment amount does not match order total' 
      });
      return;
    }

    // Decrease stock for all products in the order and check for low stock alerts
    for (const item of orderItems) {
      const product = await Product.findById(item.productId).populate('sellerId');
      if (product) {
        if (item.variant && (item.variant.size || item.variant.color)) {
          // Update variant stock
          const variantIndex = product.variants?.findIndex((v: any) => {
            const sizeMatch = !item.variant?.size || v.size === item.variant.size;
            const colorMatch = !item.variant?.color || v.color === item.variant.color;
            return sizeMatch && colorMatch;
          });

          if (variantIndex !== undefined && variantIndex >= 0 && product.variants) {
            const previousVariantStock = product.variants[variantIndex].stock;
            product.variants[variantIndex].stock -= item.quantity;
            
            // Send low stock alert if variant stock falls below 10
            if (previousVariantStock >= 10 && product.variants[variantIndex].stock < 10 && product.variants[variantIndex].stock > 0) {
              try {
                const seller = product.sellerId as any;
                if (seller && seller.email) {
                  const variantLabel = [item.variant.size, item.variant.color].filter(Boolean).join(' / ') || 'variant';
                  sendLowStockAlertEmail(
                    seller.email,
                    seller.fullName || 'Seller',
                    `${product.title} (${variantLabel})`,
                    product.variants[variantIndex].stock
                  ).catch((error) => console.error('Failed to send low stock alert email:', error));
                }
              } catch (error) {
                console.error('Error preparing low stock alert email:', error);
              }
            }
          }
        } else {
          // Update product stock
          const previousStock = product.stockQuantity;
          product.stockQuantity -= item.quantity;
          
          // Send low stock alert if stock falls below 10 (and wasn't already below 10)
          if (previousStock >= 10 && product.stockQuantity < 10 && product.stockQuantity > 0) {
            try {
              const seller = product.sellerId as any;
              if (seller && seller.email) {
                sendLowStockAlertEmail(
                  seller.email,
                  seller.fullName || 'Seller',
                  product.title,
                  product.stockQuantity
                ).catch((error) => console.error('Failed to send low stock alert email:', error));
              }
            } catch (error) {
              console.error('Error preparing low stock alert email:', error);
            }
          }
        }
        await product.save();
      }
    }

    // Create order with payment information
    const orderData: any = {
      items: orderItems,
      totalAmount: finalAmount,
      shippingAddress,
      status: 'pending',
      paymentIntentId: paymentIntent.id,
      paymentStatus: 'succeeded',
      paymentMethod: paymentIntent.payment_method ? 'card' : 'unknown'
    };

    if (req.user) {
      orderData.userId = req.user._id;
    } else {
      orderData.guestEmail = email;
    }

    const order = await Order.create(orderData);

    // Clear cart after order creation (only for authenticated users)
    if (req.user) {
      const cart = await Cart.findOne({ userId: req.user._id });
      if (cart) {
        cart.items = [];
        await cart.save();
      }
    }

    // Send order confirmation email (async, don't wait for it)
    try {
      const recipientEmail = req.user ? (await User.findById(req.user._id))?.email : email;
      const recipientName = req.user 
        ? (await User.findById(req.user._id))?.fullName || 'Customer'
        : shippingAddress.fullName || 'Customer';
      
      if (recipientEmail) {
        sendOrderConfirmationEmail(recipientEmail, recipientName, order).catch(
          (error) => console.error('Failed to send order confirmation email:', error)
        );
      }
    } catch (error) {
      // Email failure shouldn't break the order creation
      console.error('Error preparing order confirmation email:', error);
    }

    res.status(201).json({
      message: 'Order created successfully',
      order: {
        id: order._id,
        userId: order.userId,
        items: order.items,
        totalAmount: order.totalAmount,
        shippingAddress: order.shippingAddress,
        status: order.status,
        paymentIntentId: order.paymentIntentId,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
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

    // Get refund requests for all orders
    const orderIds = orders.map(order => order._id);
    const refundRequests = await RefundRequest.find({ orderId: { $in: orderIds } });

    res.json({
      orders: orders.map(order => {
        const refundRequest = refundRequests.find(
          req => req.orderId.toString() === order._id.toString()
        );
        return {
          id: order._id,
          userId: order.userId,
          items: order.items,
          totalAmount: order.totalAmount,
          shippingAddress: order.shippingAddress,
          status: order.status,
          paymentStatus: order.paymentStatus,
          trackingNumber: order.trackingNumber,
          carrier: order.carrier,
          refundRequest: refundRequest ? {
            id: refundRequest._id,
            status: refundRequest.status,
            refundAmount: refundRequest.refundAmount,
            reason: refundRequest.reason,
            createdAt: refundRequest.createdAt,
            processedAt: refundRequest.processedAt
          } : null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        };
      }),
      count: orders.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get orders' });
  }
};

// Get order details
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).populate('items.productId');
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check if this is a guest order
    const isGuestOrder = !order.userId && order.guestEmail;

    // For guest orders, allow access without authentication (anyone with order ID can view)
    // For authenticated orders, check permissions
    if (!isGuestOrder && !req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    // Check if user owns the order, is admin, or is a seller with products in this order
    let isOwner = false;
    let isAdmin = false;
    
    if (req.user) {
      if (order.userId) {
        isOwner = req.user._id.toString() === order.userId.toString();
      }
      isAdmin = req.user.role === 'admin';
    }
    
    // Check if user is a seller and has products in this order
    let isSeller = false;
    let sellerProductIds: string[] = [];
    
    if (req.user && !isOwner && !isAdmin && req.user.role === 'seller') {
      // Get product IDs from order items (handle both ObjectId and populated object)
      const productIds = order.items.map(item => {
        const productId = item.productId as any;
        return typeof productId === 'object' && productId._id ? productId._id.toString() : productId.toString();
      });
      
      const products = await Product.find({ 
        _id: { $in: productIds } 
      });
      
      // Find products that belong to this seller
      sellerProductIds = products
        .filter(product => product.sellerId.toString() === req.user!._id.toString())
        .map(product => product._id.toString());
      
      isSeller = sellerProductIds.length > 0;
    }
    
    // Allow access if: guest order, owner, admin, or seller with products
    if (!isGuestOrder && !isOwner && !isAdmin && !isSeller) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // For sellers, filter items to only show their products
    let orderItems = order.items;
    let orderTotal = order.totalAmount;
    
    if (isSeller && !isAdmin && sellerProductIds.length > 0) {
      // Filter items to only include seller's products
      orderItems = order.items.filter(item => {
        const productId = item.productId as any;
        const productIdStr = typeof productId === 'object' && productId._id 
          ? productId._id.toString() 
          : productId.toString();
        return sellerProductIds.includes(productIdStr);
      });
      
      // Calculate total for seller's items only (subtotal + tax)
      const sellerSubtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const sellerTax = sellerSubtotal * 0.08; // 8% tax
      orderTotal = sellerSubtotal + sellerTax;
    }

    // Get refund request for this order
    const refundRequest = await RefundRequest.findOne({ orderId: order._id });

    res.json({
      order: {
        id: order._id,
        userId: order.userId,
        guestEmail: order.guestEmail,
        items: orderItems,
        totalAmount: orderTotal,
        shippingAddress: order.shippingAddress,
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        refundRequest: refundRequest ? {
          id: refundRequest._id,
          status: refundRequest.status,
          refundAmount: refundRequest.refundAmount,
          reason: refundRequest.reason,
          createdAt: refundRequest.createdAt,
          processedAt: refundRequest.processedAt
        } : null,
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
      .populate('userId', 'email fullName')
      .sort({ createdAt: -1 });

    // Filter orders that contain products from this seller
    const sellerOrders = allOrders.filter(order => {
      return order.items.some(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });
    });

    // Get refund requests for all seller orders
    const orderIds = sellerOrders.map(order => order._id);
    const refundRequests = await RefundRequest.find({ orderId: { $in: orderIds } });

    res.json({
      orders: sellerOrders.map(order => {
        const user = order.userId as any;
        const refundRequest = refundRequests.find(
          req => req.orderId.toString() === order._id.toString()
        );
        
        // Filter items to only include seller's products
        const sellerItems = order.items.filter(item => {
          const product = item.productId as any;
          return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
        });
        
        // Calculate seller's portion of the order amount
        // Sum of seller's items (subtotal)
        const sellerSubtotal = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Calculate proportional tax (8% of seller's subtotal)
        // Note: The original order.totalAmount includes tax, so we calculate seller's portion with tax
        const sellerTax = sellerSubtotal * 0.08;
        const sellerTotalAmount = sellerSubtotal + sellerTax;
        
        return {
          id: order._id,
          userId: order.userId,
          guestEmail: order.guestEmail,
          user: user ? {
            id: user._id || user.id,
            email: user.email,
            fullName: user.fullName
          } : null,
          items: sellerItems,
          totalAmount: sellerTotalAmount,
          shippingAddress: order.shippingAddress,
          status: order.status,
          paymentStatus: order.paymentStatus,
          trackingNumber: order.trackingNumber,
          carrier: order.carrier,
          refundRequest: refundRequest ? {
            id: refundRequest._id,
            status: refundRequest.status,
            refundAmount: refundRequest.refundAmount,
            reason: refundRequest.reason,
            createdAt: refundRequest.createdAt,
            processedAt: refundRequest.processedAt
          } : null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        };
      }),
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
    const isOwner = order.userId ? order.userId.toString() === req.user!._id.toString() : false;
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

    const previousStatus = order.status;
    order.status = status;
    await order.save();

    // If order is being cancelled, restore stock
    if (status === 'cancelled' && previousStatus !== 'cancelled') {
      for (const item of order.items) {
        const product = await Product.findById(item.productId);
        if (product) {
          if (item.variant && (item.variant.size || item.variant.color)) {
            // Restore variant stock
            const variantIndex = product.variants?.findIndex((v: any) => {
              const sizeMatch = !item.variant?.size || v.size === item.variant.size;
              const colorMatch = !item.variant?.color || v.color === item.variant.color;
              return sizeMatch && colorMatch;
            });

            if (variantIndex !== undefined && variantIndex >= 0 && product.variants) {
              product.variants[variantIndex].stock += item.quantity;
            }
          } else {
            // Restore product stock
            product.stockQuantity += item.quantity;
          }
          await product.save();
        }
      }
    }

    // Send order status update email (async, don't wait for it)
    try {
      const user = await User.findById(order.userId);
      if (user && previousStatus !== status) {
        // Populate order items for email
        const populatedOrder = await Order.findById(order._id).populate('items.productId');
        if (populatedOrder) {
          sendOrderStatusUpdateEmail(
            user.email,
            user.fullName || 'Customer',
            populatedOrder,
            previousStatus
          ).catch((error) => console.error('Failed to send order status update email:', error));
        }
      }
    } catch (error) {
      // Email failure shouldn't break the status update
      console.error('Error preparing order status update email:', error);
    }

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

// Update tracking number
export const updateTrackingNumber = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const { trackingNumber, carrier } = req.body;

    if (!trackingNumber || trackingNumber.trim() === '') {
      res.status(400).json({ error: 'Tracking number is required' });
      return;
    }

    const order = await Order.findById(id);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check permissions - only admin or seller with products in this order can update
    const isAdmin = req.user.role === 'admin';
    let isSeller = false;

    if (!isAdmin) {
      // Check if user is seller and owns products in this order
      const products = await Product.find({ _id: { $in: order.items.map(item => item.productId) } });
      isSeller = products.some(product => product.sellerId.toString() === req.user!._id.toString());
    }

    if (!isAdmin && !isSeller) {
      res.status(403).json({ error: 'You do not have permission to update tracking information for this order' });
      return;
    }

    // Update tracking information
    order.trackingNumber = trackingNumber.trim();
    order.carrier = carrier ? carrier.trim() : null;
    
    // If tracking number is being added and order is not yet shipped, update status to shipped
    if (order.status !== 'shipped' && order.status !== 'delivered' && order.status !== 'cancelled') {
      order.status = 'shipped';
    }
    
    await order.save();

    // Send order status update email if status changed (async, don't wait for it)
    try {
      const user = await User.findById(order.userId);
      if (user) {
        // Populate order items for email
        const populatedOrder = await Order.findById(order._id).populate('items.productId');
        if (populatedOrder) {
          sendOrderStatusUpdateEmail(
            user.email,
            user.fullName || 'Customer',
            populatedOrder,
            'processing' // Previous status before adding tracking
          ).catch((error) => console.error('Failed to send order status update email:', error));
        }
      }
    } catch (error) {
      // Email failure shouldn't break the tracking update
      console.error('Error preparing order status update email:', error);
    }

    res.json({
      message: 'Tracking number updated successfully',
      order: {
        id: order._id,
        trackingNumber: order.trackingNumber,
        carrier: order.carrier,
        status: order.status,
        updatedAt: order.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update tracking number' });
  }
};

// Get all orders (admin only)
export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const orders = await Order.find()
      .populate('userId', 'email fullName')
      .populate('items.productId')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + o.totalAmount, 0);
    
    const totalOrders = orders.length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const deliveredOrders = orders.filter(o => o.status === 'delivered').length;

    // Get refund requests for all orders
    const orderIds = orders.map(order => order._id);
    const refundRequests = await RefundRequest.find({ orderId: { $in: orderIds } });

    res.json({
      orders: orders.map(order => {
        const refundRequest = refundRequests.find(
          req => req.orderId.toString() === order._id.toString()
        );
        return {
          id: order._id,
          userId: order.userId,
          guestEmail: order.guestEmail,
          items: order.items,
          totalAmount: order.totalAmount,
          shippingAddress: order.shippingAddress,
          status: order.status,
          paymentStatus: order.paymentStatus,
          trackingNumber: order.trackingNumber,
          carrier: order.carrier,
          refundRequest: refundRequest ? {
            id: refundRequest._id,
            status: refundRequest.status,
            refundAmount: refundRequest.refundAmount,
            reason: refundRequest.reason,
            createdAt: refundRequest.createdAt,
            processedAt: refundRequest.processedAt
          } : null,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        };
      }),
      statistics: {
        totalOrders,
        totalRevenue,
        pendingOrders,
        deliveredOrders
      },
      count: orders.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get orders' });
  }
};

// Request refund (customer)
export const requestRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id: orderId } = req.params;
    const { reason, description } = req.body;

    if (!reason || !['defective', 'wrong_item', 'not_as_described', 'damaged', 'late_delivery', 'other'].includes(reason)) {
      res.status(400).json({ error: 'Valid reason is required' });
      return;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Check if user owns the order (for authenticated users)
    // For guest orders, we allow refund requests if the user provides the guest email
    const isOwner = order.userId ? order.userId.toString() === req.user._id.toString() : false;
    const isGuestOrder = !order.userId && order.guestEmail;
    
    // Allow refund if user owns the order OR if it's a guest order (we'll verify via email if needed)
    if (!isOwner && !isGuestOrder) {
      res.status(403).json({ error: 'You can only request refunds for your own orders' });
      return;
    }

    // Check if order is eligible for refund (delivered or shipped)
    if (order.status !== 'delivered' && order.status !== 'shipped') {
      res.status(400).json({ error: 'Refunds can only be requested for delivered or shipped orders' });
      return;
    }

    // Check if there's already an active refund request (pending, approved, or processed)
    // Only allow new requests if previous one was rejected
    const existingRequest = await RefundRequest.findOne({
      orderId: order._id,
      status: { $in: ['pending', 'approved', 'processed'] }
    });

    if (existingRequest) {
      res.status(400).json({ error: 'A refund request already exists for this order' });
      return;
    }

    // Create refund request
    const refundRequest = await RefundRequest.create({
      orderId: order._id,
      userId: order.userId ? req.user._id : undefined,
      guestEmail: order.guestEmail || undefined,
      reason,
      description: description || undefined,
      status: 'pending',
      refundAmount: order.totalAmount
    });

    res.status(201).json({
      message: 'Refund request submitted successfully',
      refundRequest: {
        id: refundRequest._id,
        orderId: refundRequest.orderId,
        reason: refundRequest.reason,
        description: refundRequest.description,
        status: refundRequest.status,
        refundAmount: refundRequest.refundAmount,
        createdAt: refundRequest.createdAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid order ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to request refund' });
  }
};

// Get refund requests (customer - their own, admin - all)
export const getRefundRequests = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const isAdmin = req.user.role === 'admin';
    let refundRequests;

    if (isAdmin) {
      // Admin can see all refund requests
      refundRequests = await RefundRequest.find()
        .populate('orderId')
        .populate('userId', 'email fullName')
        .sort({ createdAt: -1 });
    } else {
      // Customers can only see their own refund requests
      // Include both user-owned and guest email matches
      refundRequests = await RefundRequest.find({
        $or: [
          { userId: req.user._id },
          { guestEmail: req.user.email?.toLowerCase() }
        ]
      })
        .populate('orderId')
        .sort({ createdAt: -1 });
    }

    res.json({
      refundRequests: refundRequests.map(req => ({
        id: req._id,
        orderId: req.orderId,
        userId: req.userId,
        guestEmail: req.guestEmail,
        reason: req.reason,
        description: req.description,
        status: req.status,
        refundAmount: req.refundAmount,
        adminNotes: req.adminNotes,
        processedAt: req.processedAt,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get refund requests' });
  }
};

// Get refund request by ID
export const getRefundRequestById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;
    const refundRequest = await RefundRequest.findById(id)
      .populate('orderId')
      .populate('userId', 'email fullName');

    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    // Check permissions
    const isAdmin = req.user.role === 'admin';
    const isOwner = refundRequest.userId 
      ? refundRequest.userId.toString() === req.user._id.toString() 
      : false;
    // For guest orders, allow access if user email matches guest email
    const isGuestOwner = !refundRequest.userId && refundRequest.guestEmail && 
      req.user.email && req.user.email.toLowerCase() === refundRequest.guestEmail.toLowerCase();

    if (!isAdmin && !isOwner && !isGuestOwner) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    res.json({
      refundRequest: {
        id: refundRequest._id,
        orderId: refundRequest.orderId,
        userId: refundRequest.userId,
        guestEmail: refundRequest.guestEmail,
        reason: refundRequest.reason,
        description: refundRequest.description,
        status: refundRequest.status,
        refundAmount: refundRequest.refundAmount,
        adminNotes: refundRequest.adminNotes,
        processedAt: refundRequest.processedAt,
        createdAt: refundRequest.createdAt,
        updatedAt: refundRequest.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid refund request ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to get refund request' });
  }
};

// Update refund request status (admin only)
export const updateRefundRequestStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: 'Valid status is required' });
      return;
    }

    const refundRequest = await RefundRequest.findById(id).populate('orderId');
    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    if (refundRequest.status === 'processed') {
      res.status(400).json({ error: 'This refund request has already been processed' });
      return;
    }

    refundRequest.status = status;
    if (adminNotes !== undefined) {
      refundRequest.adminNotes = adminNotes;
    }
    await refundRequest.save();

    res.json({
      message: 'Refund request status updated successfully',
      refundRequest: {
        id: refundRequest._id,
        status: refundRequest.status,
        adminNotes: refundRequest.adminNotes,
        updatedAt: refundRequest.updatedAt
      }
    });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid refund request ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update refund request status' });
  }
};

// Process refund (admin only - actually process Stripe refund)
export const processRefund = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    if (req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const refundRequest = await RefundRequest.findById(id).populate('orderId');
    
    if (!refundRequest) {
      res.status(404).json({ error: 'Refund request not found' });
      return;
    }

    if (refundRequest.status !== 'approved') {
      res.status(400).json({ error: 'Refund request must be approved before processing' });
      return;
    }

    if (refundRequest.status === 'processed') {
      res.status(400).json({ error: 'Refund has already been processed' });
      return;
    }

    const order = refundRequest.orderId as any;
    if (!order || !order.paymentIntentId) {
      res.status(400).json({ error: 'Order payment information not found' });
      return;
    }

    // Process refund through Stripe
    const stripe = getStripe();
    const refundAmount = refundRequest.refundAmount || order.totalAmount;
    
    try {
      // Retrieve payment intent to get charge ID
      const paymentIntent = await stripe.paymentIntents.retrieve(order.paymentIntentId);
      
      if (!paymentIntent.latest_charge) {
        res.status(400).json({ error: 'Payment charge not found' });
        return;
      }

      // Create refund
      const refund = await stripe.refunds.create({
        charge: paymentIntent.latest_charge as string,
        amount: Math.round(refundAmount * 100), // Convert to cents
        reason: 'requested_by_customer'
      });

      // Update refund request status
      refundRequest.status = 'processed';
      refundRequest.processedAt = new Date();
      await refundRequest.save();

      // Update order payment status
      order.paymentStatus = 'refunded';
      await order.save();

      res.json({
        message: 'Refund processed successfully',
        refundRequest: {
          id: refundRequest._id,
          status: refundRequest.status,
          processedAt: refundRequest.processedAt
        },
        refund: {
          id: refund.id,
          amount: refund.amount / 100, // Convert back to dollars
          status: refund.status
        }
      });
    } catch (stripeError: any) {
      console.error('Stripe refund error:', stripeError);
      res.status(500).json({ 
        error: stripeError.message || 'Failed to process refund through payment provider' 
      });
    }
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid refund request ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to process refund' });
  }
};

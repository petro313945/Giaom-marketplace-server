import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth.middleware';
import Order from '../models/Order';
import Product from '../models/Product';
import Payout from '../models/Payout';
import MarketplaceSettings from '../models/MarketplaceSettings';
import Review from '../models/Review';

// Helper function to get commission rate from settings
const getCommissionRate = async (): Promise<number> => {
  try {
    let settings = await MarketplaceSettings.findOne();
    if (!settings) {
      settings = await MarketplaceSettings.create({ commissionRate: 0.10 }); // Default 10%
    }
    return settings.commissionRate;
  } catch (error) {
    console.error('Error getting commission rate, using default 10%:', error);
    return 0.10; // Fallback to 10%
  }
};

// Helper function to calculate seller earnings from orders
const calculateSellerEarnings = async (sellerId: string, orderIds?: string[]) => {
  // Get all delivered orders (only delivered orders are eligible for payout)
  const query: any = {
    status: 'delivered',
    paymentStatus: 'succeeded'
  };

  if (orderIds && orderIds.length > 0) {
    query._id = { $in: orderIds };
  }

  const allOrders = await Order.find(query)
    .populate('items.productId')
    .sort({ createdAt: -1 });

  // Filter orders that contain products from this seller
  const sellerOrders = allOrders.filter(order => {
    return order.items.some(item => {
      const product = item.productId as any;
      return product && product.sellerId && product.sellerId.toString() === sellerId;
    });
  });

  // Calculate total earnings
  let totalAmount = 0;
  const includedOrderIds: string[] = [];

  sellerOrders.forEach(order => {
    // Calculate seller's portion of the order
    const sellerItems = order.items.filter(item => {
      const product = item.productId as any;
      return product && product.sellerId && product.sellerId.toString() === sellerId;
    });

    const sellerRevenue = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (sellerRevenue > 0) {
      totalAmount += sellerRevenue;
      includedOrderIds.push(order._id.toString());
    }
  });

  const commissionRate = await getCommissionRate();
  const commission = totalAmount * commissionRate;
  const netAmount = totalAmount - commission;

  return {
    totalAmount,
    commission,
    netAmount,
    orderIds: includedOrderIds,
    orderCount: includedOrderIds.length
  };
};

// Get seller earnings summary
export const getEarningsSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const sellerId = req.user._id.toString();

    // Get all delivered orders for this seller
    const earnings = await calculateSellerEarnings(sellerId);

    // Get all payouts for this seller
    const allPayouts = await Payout.find({
      sellerId: req.user._id
    });

    // Calculate paid out amount (only from completed payouts)
    const completedPayouts = allPayouts.filter(p => p.status === 'completed');
    const totalPaidOut = completedPayouts.reduce((sum, payout) => sum + payout.netAmount, 0);

    // Calculate pending amount (from pending and processing payouts)
    const pendingPayouts = allPayouts.filter(p => ['pending', 'processing'].includes(p.status));
    const pendingAmount = pendingPayouts.reduce((sum, payout) => sum + payout.netAmount, 0);

    // Get order IDs that have been included in any payout (excluding failed/cancelled)
    const paidOutOrderIds = new Set<string>();
    allPayouts.forEach(payout => {
      // Only count orders from payouts that are not failed or cancelled
      if (!['failed', 'cancelled'].includes(payout.status)) {
        payout.orderIds.forEach(orderId => {
          // Handle both ObjectId and string formats
          const orderIdStr = orderId.toString ? orderId.toString() : String(orderId);
          paidOutOrderIds.add(orderIdStr);
        });
      }
    });

    // Calculate available for payout (only from orders not yet included in payouts)
    const allDeliveredOrders = await Order.find({
      status: 'delivered',
      paymentStatus: 'succeeded'
    })
      .populate('items.productId')
      .sort({ createdAt: -1 });

    const unpaidOrders = allDeliveredOrders.filter(order => {
      // Check if order has seller's products
      const hasSellerItems = order.items.some(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === sellerId;
      });

      // Check if order hasn't been paid out yet
      const orderIdStr = order._id.toString();
      const isPaidOut = paidOutOrderIds.has(orderIdStr);

      return hasSellerItems && !isPaidOut;
    });

    let availableAmount = 0;
    const availableOrderIds: string[] = [];

    unpaidOrders.forEach(order => {
      const sellerItems = order.items.filter(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === sellerId;
      });

      const sellerRevenue = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      
      if (sellerRevenue > 0) {
        availableAmount += sellerRevenue;
        availableOrderIds.push(order._id.toString());
      }
    });

    const commissionRate = await getCommissionRate();
    const availableCommission = availableAmount * commissionRate;
    const availableNetAmount = availableAmount - availableCommission;

    res.json({
      totalEarnings: {
        amount: Math.round(earnings.totalAmount * 100) / 100,
        commission: Math.round(earnings.commission * 100) / 100,
        netAmount: Math.round(earnings.netAmount * 100) / 100,
        orderCount: earnings.orderCount
      },
      paidOut: {
        amount: Math.round(totalPaidOut * 100) / 100, // Round to 2 decimal places
        payoutCount: completedPayouts.length
      },
      pending: {
        amount: Math.round(pendingAmount * 100) / 100, // Round to 2 decimal places
        payoutCount: pendingPayouts.length
      },
      available: {
        amount: Math.round(availableAmount * 100) / 100,
        commission: Math.round(availableCommission * 100) / 100,
        netAmount: Math.round(availableNetAmount * 100) / 100,
        orderCount: availableOrderIds.length,
        orderIds: availableOrderIds
      }
    });
  } catch (error: any) {
    console.error('Error getting earnings summary:', error);
    res.status(500).json({ error: error.message || 'Failed to get earnings summary' });
  }
};

// Get payout history
export const getPayoutHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    const payouts = await Payout.find({ sellerId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum)
      .populate({
        path: 'orderIds',
        select: 'totalAmount status createdAt items',
        populate: {
          path: 'items.productId',
          select: 'title imageUrl imageUrls sellerId'
        }
      });

    const total = await Payout.countDocuments({ sellerId: req.user._id });

    // Process each payout to include order details and calculate average rating
    const processedPayouts = await Promise.all(
      payouts.map(async (payout) => {
        const sellerId = req.user!._id.toString();
        
        // Process already populated orders
        const orderDetails = await Promise.all(
          payout.orderIds.map(async (order: any) => {
            // Handle both populated and non-populated orderIds
            const orderData = order._id ? order : await Order.findById(order).populate('items.productId');
            if (!orderData) return null;

            // Filter items that belong to this seller
            const sellerItems = orderData.items.filter((item: any) => {
              const product = item.productId as any;
              return product && product.sellerId && product.sellerId.toString() === sellerId;
            });

            if (sellerItems.length === 0) return null;

            const sellerRevenue = sellerItems.reduce((sum: number, item: any) => {
              return sum + (item.price * item.quantity);
            }, 0);

            // Get product IDs for rating calculation
            const productIds = sellerItems.map((item: any) => {
              const product = item.productId as any;
              return product._id ? product._id.toString() : product.toString();
            });

            // Calculate average rating for products in this order
            const reviews = await Review.find({
              productId: { $in: productIds },
              status: 'approved'
            });

            let averageRating = null;
            if (reviews.length > 0) {
              const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
              averageRating = totalRating / reviews.length;
            }

            return {
              id: orderData._id.toString(),
              orderNumber: orderData._id.toString().slice(-8),
              createdAt: orderData.createdAt,
              status: orderData.status,
              items: sellerItems.map((item: any) => {
                const product = item.productId as any;
                return {
                  productId: product._id ? product._id.toString() : product.toString(),
                  title: item.title || product?.title || 'Unknown Product',
                  imageUrl: product?.imageUrl || product?.imageUrls?.[0],
                  quantity: item.quantity,
                  price: item.price,
                  subtotal: item.price * item.quantity
                };
              }),
              sellerRevenue,
              averageRating
            };
          })
        );

        // Filter out null orders
        const validOrders = orderDetails.filter((order): order is NonNullable<typeof order> => order !== null);

        // Calculate overall average rating for all orders in this payout
        const allRatings = validOrders
          .map(order => order.averageRating)
          .filter((rating): rating is number => rating !== null);
        
        let overallAverageRating = null;
        if (allRatings.length > 0) {
          overallAverageRating = allRatings.reduce((sum, rating) => sum + rating, 0) / allRatings.length;
        }

        // Calculate commission rate (commission / amount)
        const commissionRate = payout.amount > 0 ? payout.commission / payout.amount : 0;

        return {
          id: payout._id,
          amount: payout.amount,
          commission: payout.commission,
          netAmount: payout.netAmount,
          commissionRate: commissionRate,
          status: payout.status,
          payoutMethod: payout.payoutMethod,
          requestedAt: payout.requestedAt,
          processedAt: payout.processedAt,
          failureReason: payout.failureReason,
          orderCount: payout.orderIds.length,
          orders: validOrders,
          averageRating: overallAverageRating,
          createdAt: payout.createdAt,
          updatedAt: payout.updatedAt
        };
      })
    );

    res.json({
      payouts: processedPayouts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Error getting payout history:', error);
    res.status(500).json({ error: error.message || 'Failed to get payout history' });
  }
};

// Request payout
export const requestPayout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { orderIds, payoutMethod, payoutDetails } = req.body;
    const sellerId = req.user._id.toString();

    // If orderIds are provided, use them; otherwise, use all available orders
    let availableEarnings;
    if (orderIds && orderIds.length > 0) {
      // Validate that all orders belong to this seller and are delivered
      const orders = await Order.find({ _id: { $in: orderIds } })
        .populate('items.productId');

      // Check if all orders are valid
      for (const order of orders) {
        if (order.status !== 'delivered' || order.paymentStatus !== 'succeeded') {
          res.status(400).json({ 
            error: `Order ${order._id} is not eligible for payout (must be delivered and paid)` 
          });
          return;
        }

        const hasSellerItems = order.items.some(item => {
          const product = item.productId as any;
          return product && product.sellerId && product.sellerId.toString() === sellerId;
        });

        if (!hasSellerItems) {
          res.status(403).json({ 
            error: `Order ${order._id} does not contain your products` 
          });
          return;
        }
      }

      // Check if any of these orders are already in a payout
      const existingPayouts = await Payout.find({
        sellerId: req.user._id,
        status: { $in: ['pending', 'processing', 'completed'] },
        orderIds: { $in: orderIds }
      });

      if (existingPayouts.length > 0) {
        res.status(400).json({ 
          error: 'Some of these orders are already included in a payout' 
        });
        return;
      }

      availableEarnings = await calculateSellerEarnings(sellerId, orderIds);
    } else {
      // Get all available orders
      const summary = await calculateSellerEarnings(sellerId);
      
      // Get order IDs that have been paid out
      const allPayouts = await Payout.find({
        sellerId: req.user._id,
        status: { $in: ['pending', 'processing', 'completed'] }
      });

      const paidOutOrderIds = new Set<string>();
      allPayouts.forEach(payout => {
        payout.orderIds.forEach(orderId => {
          paidOutOrderIds.add(orderId.toString());
        });
      });

      // Filter out already paid orders
      const availableOrderIds = summary.orderIds.filter(id => !paidOutOrderIds.has(id));
      
      if (availableOrderIds.length === 0) {
        res.status(400).json({ error: 'No orders available for payout' });
        return;
      }

      availableEarnings = await calculateSellerEarnings(sellerId, availableOrderIds);
    }

    if (availableEarnings.netAmount <= 0) {
      res.status(400).json({ error: 'No earnings available for payout' });
      return;
    }

    // Create payout request
    // Convert orderIds to ObjectIds if they're strings
    const orderObjectIds = availableEarnings.orderIds.map(id => 
      typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id
    );

    const payout = await Payout.create({
      sellerId: req.user._id,
      amount: availableEarnings.totalAmount,
      commission: availableEarnings.commission,
      netAmount: availableEarnings.netAmount,
      status: 'pending',
      payoutMethod: payoutMethod || 'bank_transfer',
      payoutDetails: payoutDetails || {},
      orderIds: orderObjectIds,
      requestedAt: new Date()
    });

    res.status(201).json({
      message: 'Payout request created successfully',
      payout: {
        id: payout._id,
        amount: payout.amount,
        commission: payout.commission,
        netAmount: payout.netAmount,
        status: payout.status,
        orderCount: payout.orderIds.length,
        requestedAt: payout.requestedAt
      }
    });
  } catch (error: any) {
    console.error('Error requesting payout:', error);
    res.status(500).json({ error: error.message || 'Failed to request payout' });
  }
};

// Get payout by ID (for seller to view details)
export const getPayoutById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { id } = req.params;

    // Sellers can only see their own payouts, admins can see all
    const query: any = { _id: id };
    if (req.user.role !== 'admin') {
      query.sellerId = req.user._id;
    }

    const payout = await Payout.findOne(query)
      .populate('sellerId', 'email fullName')
      .populate('orderIds', 'totalAmount status createdAt items');

    if (!payout) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    res.json({
      id: payout._id,
      sellerId: payout.sellerId,
      amount: payout.amount,
      commission: payout.commission,
      netAmount: payout.netAmount,
      status: payout.status,
      payoutMethod: payout.payoutMethod,
      payoutDetails: payout.payoutDetails,
      requestedAt: payout.requestedAt,
      processedAt: payout.processedAt,
      failureReason: payout.failureReason,
      orders: payout.orderIds,
      orderCount: payout.orderIds.length,
      createdAt: payout.createdAt,
      updatedAt: payout.updatedAt
    });
  } catch (error: any) {
    console.error('Error getting payout:', error);
    res.status(500).json({ error: error.message || 'Failed to get payout' });
  }
};

// Admin: Get all payouts
export const getAllPayouts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { page = 1, limit = 20, status, sellerId } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);

    // Build query
    const query: any = {};
    if (status && typeof status === 'string') {
      query.status = status;
    }
    if (sellerId && typeof sellerId === 'string') {
      query.sellerId = sellerId;
    }

    const payouts = await Payout.find(query)
      .populate('sellerId', 'email fullName')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .skip((pageNum - 1) * limitNum);

    const total = await Payout.countDocuments(query);

    res.json({
      payouts: payouts.map(payout => ({
        id: payout._id,
        sellerId: payout.sellerId,
        amount: payout.amount,
        commission: payout.commission,
        netAmount: payout.netAmount,
        status: payout.status,
        payoutMethod: payout.payoutMethod,
        requestedAt: payout.requestedAt,
        processedAt: payout.processedAt,
        failureReason: payout.failureReason,
        orderCount: payout.orderIds.length,
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt
      })),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Error getting all payouts:', error);
    res.status(500).json({ error: error.message || 'Failed to get payouts' });
  }
};

// Admin: Update payout status
export const updatePayoutStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { id } = req.params;
    const { status, failureReason } = req.body;

    if (!status || !['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
      res.status(400).json({ error: 'Valid status is required' });
      return;
    }

    const payout = await Payout.findById(id).populate('sellerId', 'email fullName');
    if (!payout) {
      res.status(404).json({ error: 'Payout not found' });
      return;
    }

    const previousStatus = payout.status;
    payout.status = status;

    // Set processedAt when status changes to completed or failed
    if (status === 'completed' || status === 'failed') {
      payout.processedAt = new Date();
    }

    // Set failure reason if provided
    if (failureReason && typeof failureReason === 'string') {
      payout.failureReason = failureReason.trim();
    } else if (status !== 'failed' && status !== 'cancelled') {
      // Clear failure reason if status is not failed/cancelled
      payout.failureReason = undefined;
    }

    await payout.save();

    res.json({
      message: `Payout status updated to ${status}`,
      payout: {
        id: payout._id,
        sellerId: payout.sellerId,
        amount: payout.amount,
        commission: payout.commission,
        netAmount: payout.netAmount,
        status: payout.status,
        previousStatus,
        processedAt: payout.processedAt,
        failureReason: payout.failureReason,
        updatedAt: payout.updatedAt
      }
    });
  } catch (error: any) {
    console.error('Error updating payout status:', error);
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid payout ID' });
      return;
    }
    res.status(500).json({ error: error.message || 'Failed to update payout status' });
  }
};

// Admin: Get payout statistics
export const getPayoutStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const { startDate, endDate } = req.query;

    // Build date query
    const dateQuery: any = {};
    if (startDate || endDate) {
      dateQuery.createdAt = {};
      if (startDate) {
        dateQuery.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        dateQuery.createdAt.$lte = new Date(endDate as string);
      }
    }

    const allPayouts = await Payout.find(dateQuery);

    const stats = {
      total: allPayouts.length,
      pending: allPayouts.filter(p => p.status === 'pending').length,
      processing: allPayouts.filter(p => p.status === 'processing').length,
      completed: allPayouts.filter(p => p.status === 'completed').length,
      failed: allPayouts.filter(p => p.status === 'failed').length,
      cancelled: allPayouts.filter(p => p.status === 'cancelled').length,
      totalAmount: allPayouts.reduce((sum, p) => sum + p.amount, 0),
      totalCommission: allPayouts.reduce((sum, p) => sum + p.commission, 0),
      totalPaidOut: allPayouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + p.netAmount, 0),
      pendingAmount: allPayouts
        .filter(p => ['pending', 'processing'].includes(p.status))
        .reduce((sum, p) => sum + p.netAmount, 0)
    };

    res.json(stats);
  } catch (error: any) {
    console.error('Error getting payout stats:', error);
    res.status(500).json({ error: error.message || 'Failed to get payout statistics' });
  }
};

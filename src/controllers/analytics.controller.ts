import { Response } from 'express';
import Order from '../models/Order';
import Product from '../models/Product';
import { AuthRequest } from '../middleware/auth.middleware';

// Get seller analytics
export const getSellerAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { startDate, endDate, period = '30' } = req.query;

    // Calculate date range
    const end = endDate ? new Date(endDate as string) : new Date();
    const start = startDate 
      ? new Date(startDate as string)
      : new Date(end.getTime() - parseInt(period as string) * 24 * 60 * 60 * 1000);

    // Get all orders
    const allOrders = await Order.find({
      createdAt: { $gte: start, $lte: end }
    })
      .populate('items.productId')
      .sort({ createdAt: -1 });

    // Filter orders that contain products from this seller
    const sellerOrders = allOrders.filter(order => {
      return order.items.some(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });
    });

    // Calculate revenue and sales by date
    const salesByDate: { [key: string]: { revenue: number; orders: number; items: number } } = {};
    
    sellerOrders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      
      if (!salesByDate[dateKey]) {
        salesByDate[dateKey] = { revenue: 0, orders: 0, items: 0 };
      }

      // Calculate seller's portion of the order
      const sellerItems = order.items.filter(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });

      const sellerRevenue = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const sellerItemsCount = sellerItems.reduce((sum, item) => sum + item.quantity, 0);

      salesByDate[dateKey].revenue += sellerRevenue;
      salesByDate[dateKey].items += sellerItemsCount;
    });

    // Count unique orders per day
    const ordersByDate: { [key: string]: Set<string> } = {};
    sellerOrders.forEach(order => {
      const dateKey = new Date(order.createdAt).toISOString().split('T')[0];
      if (!ordersByDate[dateKey]) {
        ordersByDate[dateKey] = new Set();
      }
      ordersByDate[dateKey].add(order._id.toString());
    });

    // Update orders count
    Object.keys(ordersByDate).forEach(dateKey => {
      if (salesByDate[dateKey]) {
        salesByDate[dateKey].orders = ordersByDate[dateKey].size;
      }
    });

    // Convert to array format for charts
    const salesData = Object.keys(salesByDate)
      .sort()
      .map(date => ({
        date,
        revenue: salesByDate[date].revenue,
        orders: salesByDate[date].orders,
        items: salesByDate[date].items
      }));

    // Calculate total statistics
    const totalRevenue = sellerOrders.reduce((sum, order) => {
      const sellerItems = order.items.filter(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });
      return sum + sellerItems.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0);
    }, 0);

    const totalOrders = new Set(sellerOrders.map(o => o._id.toString())).size;
    
    const totalItems = sellerOrders.reduce((sum, order) => {
      const sellerItems = order.items.filter(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });
      return sum + sellerItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Get top products
    const productSales: { [key: string]: { productId: string; title: string; revenue: number; quantity: number } } = {};
    
    sellerOrders.forEach(order => {
      order.items.forEach(item => {
        const product = item.productId as any;
        if (product && product.sellerId && product.sellerId.toString() === req.user!._id.toString()) {
          const productId = product._id.toString();
          
          if (!productSales[productId]) {
            productSales[productId] = {
              productId,
              title: product.title || item.title,
              revenue: 0,
              quantity: 0
            };
          }
          
          productSales[productId].revenue += item.price * item.quantity;
          productSales[productId].quantity += item.quantity;
        }
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Get orders by status
    const ordersByStatus = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    sellerOrders.forEach(order => {
      const hasSellerItems = order.items.some(item => {
        const product = item.productId as any;
        return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
      });
      
      if (hasSellerItems && ordersByStatus[order.status as keyof typeof ordersByStatus] !== undefined) {
        ordersByStatus[order.status as keyof typeof ordersByStatus]++;
      }
    });

    // Get recent orders (last 10)
    const recentOrders = sellerOrders
      .slice(0, 10)
      .map(order => {
        const sellerItems = order.items.filter(item => {
          const product = item.productId as any;
          return product && product.sellerId && product.sellerId.toString() === req.user!._id.toString();
        });
        const sellerRevenue = sellerItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        return {
          id: order._id.toString(),
          date: order.createdAt,
          status: order.status,
          revenue: sellerRevenue,
          itemsCount: sellerItems.reduce((sum, item) => sum + item.quantity, 0)
        };
      });

    res.json({
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      summary: {
        totalRevenue,
        totalOrders,
        totalItems,
        averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0
      },
      salesByDate: salesData,
      topProducts,
      ordersByStatus,
      recentOrders
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get analytics' });
  }
};

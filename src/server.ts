import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';

// Load environment variables FIRST, before any other imports that might use them
dotenv.config();

import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/error.middleware';
import { apiLimiter, authLimiter, uploadLimiter } from './middleware/rateLimit.middleware';
import { seedAdmin } from './utils/seedAdmin';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import sellerRoutes from './routes/seller.routes';
import productRoutes from './routes/product.routes';
import cartRoutes from './routes/cart.routes';
import orderRoutes from './routes/order.routes';
import categoryRoutes from './routes/category.routes';
import uploadRoutes from './routes/upload.routes';
import addressRoutes from './routes/address.routes';
import wishlistRoutes from './routes/wishlist.routes';
import reviewRoutes from './routes/review.routes';
import reportRoutes from './routes/report.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';
import payoutRoutes from './routes/payout.routes';
import homeSettingsRoutes from './routes/homeSettings.routes';
import marketplaceSettingsRoutes from './routes/marketplaceSettings.routes';
import backupRoutes from './routes/backup.routes';

const app: Express = express();
const PORT = Number(process.env.PORT) || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "http:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow images from external sources
}));

// CORS configuration
app.use(cors({
  origin: [
    CLIENT_URL,
    'http://localhost:3000',
    'http://31.97.51.42:3000',
    /^http:\/\/31\.97\.51\.42/ // Allow any port on this IP
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit URL-encoded payload size

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Giaom Marketplace API Server',
    status: 'running',
    version: '1.0.0'
  });
});

// Health check route
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// API Routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes); // Stricter rate limiting for auth
app.use('/api/users', userRoutes);
app.use('/api/sellers', sellerRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/upload', uploadLimiter, uploadRoutes); // Stricter rate limiting for uploads
app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/payouts', payoutRoutes);
app.use('/api/home-settings', homeSettingsRoutes);
app.use('/api/marketplace-settings', marketplaceSettingsRoutes);
app.use('/api/backup', backupRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();
    
    // Seed admin user on first run
    await seedAdmin();
    
    // Start server - listen on all interfaces (0.0.0.0) to allow network access
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`🚀 Server is also accessible on http://31.97.51.42:${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

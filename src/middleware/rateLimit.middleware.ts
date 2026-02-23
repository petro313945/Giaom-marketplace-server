import rateLimit from 'express-rate-limit';

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// General API rate limiter
// More lenient in development, stricter in production
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 1000 : 100, // Much higher limit in development (1000 vs 100)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    statusCode: 429
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/api/health';
  }
});

// Strict rate limiter for auth endpoints
// More lenient in development
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDevelopment ? 50 : 5, // Higher limit in development (50 vs 5)
  message: {
    error: 'Too many authentication attempts, please try again later.',
    statusCode: 429
  },
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Rate limiter for file uploads
// More lenient in development
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 100 : 20, // Higher limit in development (100 vs 20)
  message: {
    error: 'Too many file uploads, please try again later.',
    statusCode: 429
  },
});

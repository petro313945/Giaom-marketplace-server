import { body, param, query, ValidationChain } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Middleware to handle validation errors
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.type === 'field' ? err.path : undefined,
        message: err.msg
      })),
      statusCode: 400
    });
    return;
  }
  next();
};

// Auth validation
export const validateRegister = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
    .optional(),
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters')
    .optional(),
  handleValidationErrors
];

export const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  handleValidationErrors
];

// Product validation
export const validateCreateProduct = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Product description must be between 10 and 2000 characters')
    .optional(),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number greater than 0'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  body('imageUrl')
    .isURL()
    .withMessage('Image URL must be a valid URL')
    .optional(),
  handleValidationErrors
];

export const validateUpdateProduct = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Product title must be between 3 and 200 characters')
    .optional(),
  body('description')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Product description must be between 10 and 2000 characters')
    .optional(),
  body('price')
    .isFloat({ min: 0.01 })
    .withMessage('Price must be a positive number greater than 0')
    .optional(),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required')
    .optional(),
  body('imageUrl')
    .isURL()
    .withMessage('Image URL must be a valid URL')
    .optional(),
  handleValidationErrors
];

// Order validation
export const validateCreateOrder = [
  body('shippingAddress.fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('shippingAddress.address')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Address must be between 5 and 200 characters'),
  body('shippingAddress.city')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),
  body('shippingAddress.zipCode')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Zip code must be between 3 and 20 characters'),
  body('shippingAddress.country')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country must be between 2 and 100 characters'),
  body('shippingAddress.state')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('State must be between 2 and 100 characters')
    .optional(),
  body('shippingAddress.phone')
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Phone number must be valid')
    .optional(),
  handleValidationErrors
];

// Seller validation
export const validateSellerApplication = [
  body('businessName')
    .trim()
    .isLength({ min: 3, max: 100 })
    .withMessage('Business name must be between 3 and 100 characters'),
  body('businessDescription')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Business description must be between 10 and 1000 characters')
    .optional(),
  handleValidationErrors
];

// ID parameter validation
export const validateId = [
  param('id')
    .isMongoId()
    .withMessage('Invalid ID format'),
  handleValidationErrors
];

// Query parameter validation for products
export const validateProductQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('minPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Min price must be a positive number'),
  query('maxPrice')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Max price must be a positive number'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'price', 'title'])
    .withMessage('Sort by must be one of: createdAt, price, title'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc'),
  handleValidationErrors
];

import mongoose, { Document, Schema } from 'mongoose';

export interface IProductVariant {
  size?: string;
  color?: string;
  price?: number; // Optional: if not provided, use product base price
  stock: number;
  imageUrls?: string[]; // Optional: variant-specific images
}

export interface IBulkDiscountTier {
  minQuantity: number;
  discountPercent: number; // Percentage discount (e.g., 10 for 10% off)
}

export interface IProduct extends Document {
  sellerId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  price: number;
  category: string;
  imageUrl?: string; // Keep for backward compatibility
  imageUrls?: string[]; // New: array of image URLs
  colorImages?: { [color: string]: string[] }; // Images per color (e.g., { "Red": ["url1", "url2"], "Blue": ["url3", "url4"] })
  stockQuantity: number;
  variants?: IProductVariant[]; // Product variants (size, color, price, stock)
  bulkDiscountTiers?: IBulkDiscountTier[]; // Bulk discount tiers (e.g., [{minQuantity: 6, discountPercent: 10}])
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: [true, 'Product title is required'],
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be positive']
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true
    },
    imageUrl: {
      type: String,
      trim: true
    },
    imageUrls: {
      type: [String],
      default: []
    },
    colorImages: {
      type: Schema.Types.Mixed,
      default: {}
    },
    stockQuantity: {
      type: Number,
      required: [true, 'Stock quantity is required'],
      min: [0, 'Stock quantity cannot be negative'],
      default: 0
    },
    variants: {
      type: [{
        size: { type: String, trim: true },
        color: { type: String, trim: true },
        price: { type: Number, min: [0, 'Variant price must be positive'] },
        stock: { type: Number, required: true, min: [0, 'Variant stock cannot be negative'] },
        imageUrls: { type: [String], default: [] }
      }],
      default: []
    },
    bulkDiscountTiers: {
      type: [{
        minQuantity: { type: Number, required: true, min: [1, 'Minimum quantity must be at least 1'] },
        discountPercent: { type: Number, required: true, min: [0, 'Discount percent cannot be negative'], max: [100, 'Discount percent cannot exceed 100'] }
      }],
      default: []
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    }
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
ProductSchema.index({ sellerId: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ title: 'text', description: 'text' }); // Text search

export default mongoose.model<IProduct>('Product', ProductSchema);

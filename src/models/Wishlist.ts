import mongoose, { Document, Schema } from 'mongoose';

export interface IWishlistItem {
  productId: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist extends Document {
  userId: mongoose.Types.ObjectId;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const WishlistItemSchema: Schema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const WishlistSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    items: [WishlistItemSchema]
  },
  {
    timestamps: true
  }
);

// Index for faster queries
WishlistSchema.index({ 'items.productId': 1 });

// Prevent duplicate products in wishlist
WishlistSchema.pre('save', function (next) {
  const seen = new Set();
  this.items = this.items.filter((item: any) => {
    const productId = item.productId.toString();
    if (seen.has(productId)) {
      return false;
    }
    seen.add(productId);
    return true;
  });
  next();
});

export default mongoose.model<IWishlist>('Wishlist', WishlistSchema);

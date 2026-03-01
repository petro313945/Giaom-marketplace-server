import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  quantity: number;
  price: number;
  title: string;
  variant?: {
    size?: string;
    color?: string;
  };
}

export interface IShippingAddress {
  fullName: string;
  address: string;
  city: string;
  state?: string;
  zipCode: string;
  country: string;
  phone?: string;
}

export interface IOrder extends Document {
  userId?: mongoose.Types.ObjectId;
  guestEmail?: string;
  items: IOrderItem[];
  totalAmount: number;
  shippingAddress: IShippingAddress;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentIntentId?: string;
  paymentStatus?: 'pending' | 'succeeded' | 'failed' | 'refunded';
  paymentMethod?: string;
  trackingNumber?: string;
  carrier?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema: Schema = new Schema({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  variant: {
    size: { type: String, trim: true },
    color: { type: String, trim: true }
  }
});

const ShippingAddressSchema: Schema = new Schema({
  fullName: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String
  },
  zipCode: {
    type: String,
    required: true
  },
  country: {
    type: String,
    required: true
  },
  phone: {
    type: String
  }
});

const OrderSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    },
    guestEmail: {
      type: String,
      required: false,
      trim: true,
      lowercase: true
    },
    items: [OrderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount must be positive']
    },
    shippingAddress: {
      type: ShippingAddressSchema,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      default: 'pending'
    },
    paymentIntentId: {
      type: String,
      default: null
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'succeeded', 'failed', 'refunded'],
      default: 'pending'
    },
    paymentMethod: {
      type: String,
      default: null
    },
    trackingNumber: {
      type: String,
      default: null
    },
    carrier: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// Indexes
OrderSchema.index({ userId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ createdAt: -1 });

export default mongoose.model<IOrder>('Order', OrderSchema);

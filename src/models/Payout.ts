import mongoose, { Document, Schema } from 'mongoose';

export interface IPayout extends Document {
  sellerId: mongoose.Types.ObjectId;
  amount: number; // Total amount before commission
  commission: number; // Marketplace commission (10% by default)
  netAmount: number; // Amount after commission (amount - commission)
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payoutMethod?: string; // e.g., 'bank_transfer', 'paypal', etc.
  payoutDetails?: {
    accountNumber?: string;
    bankName?: string;
    accountHolderName?: string;
    // Add other payout method details as needed
  };
  requestedAt: Date;
  processedAt?: Date;
  failureReason?: string;
  orderIds: mongoose.Types.ObjectId[]; // Orders included in this payout
  createdAt: Date;
  updatedAt: Date;
}

const PayoutSchema: Schema = new Schema(
  {
    sellerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be positive']
    },
    commission: {
      type: Number,
      required: true,
      min: [0, 'Commission must be positive'],
      default: 0
    },
    netAmount: {
      type: Number,
      required: true,
      min: [0, 'Net amount must be positive']
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'pending'
    },
    payoutMethod: {
      type: String,
      trim: true
    },
    payoutDetails: {
      accountNumber: String,
      bankName: String,
      accountHolderName: String
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    processedAt: {
      type: Date
    },
    failureReason: {
      type: String,
      trim: true
    },
    orderIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Order'
    }]
  },
  {
    timestamps: true
  }
);

// Indexes for faster queries
PayoutSchema.index({ sellerId: 1, createdAt: -1 });
PayoutSchema.index({ status: 1 });
PayoutSchema.index({ requestedAt: -1 });

export default mongoose.model<IPayout>('Payout', PayoutSchema);

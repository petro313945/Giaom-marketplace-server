import mongoose, { Document, Schema } from 'mongoose';

export interface IRefundRequest extends Document {
  orderId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  guestEmail?: string;
  reason: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  refundAmount?: number;
  adminNotes?: string;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RefundRequestSchema: Schema = new Schema(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true
    },
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
    reason: {
      type: String,
      required: true,
      enum: ['defective', 'wrong_item', 'not_as_described', 'damaged', 'late_delivery', 'other'],
      trim: true
    },
    description: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'processed'],
      default: 'pending'
    },
    refundAmount: {
      type: Number,
      required: false,
      min: 0
    },
    adminNotes: {
      type: String,
      required: false,
      trim: true
    },
    processedAt: {
      type: Date,
      required: false
    }
  },
  {
    timestamps: true
  }
);

// Indexes
RefundRequestSchema.index({ orderId: 1 });
RefundRequestSchema.index({ userId: 1 });
RefundRequestSchema.index({ status: 1 });
RefundRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IRefundRequest>('RefundRequest', RefundRequestSchema);

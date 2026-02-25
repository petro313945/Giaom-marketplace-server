import mongoose, { Document, Schema } from 'mongoose';

export interface ISellerProfile extends Document {
  userId: mongoose.Types.ObjectId;
  businessName: string;
  businessDescription?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

const SellerProfileSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    businessName: {
      type: String,
      required: [true, 'Business name is required'],
      trim: true
    },
    businessDescription: {
      type: String,
      trim: true
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

// Indexes
SellerProfileSchema.index({ status: 1 });

export default mongoose.model<ISellerProfile>('SellerProfile', SellerProfileSchema);

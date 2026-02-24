import mongoose, { Document, Schema } from 'mongoose';

export interface IReport extends Document {
  reporterId: mongoose.Types.ObjectId; // User who submitted the report
  reportedType: 'product' | 'user' | 'review'; // Type of content being reported
  reportedId: mongoose.Types.ObjectId; // ID of the reported content
  reason: string; // Category of report (e.g., 'spam', 'inappropriate', 'fake', etc.)
  description?: string; // Optional detailed description
  status: 'pending' | 'resolved' | 'dismissed'; // Report status
  adminNotes?: string; // Admin's notes on the report
  resolvedBy?: mongoose.Types.ObjectId; // Admin who resolved it
  resolvedAt?: Date; // When it was resolved
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    reportedType: {
      type: String,
      enum: ['product', 'user', 'review'],
      required: true,
      index: true
    },
    reportedId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    reason: {
      type: String,
      required: [true, 'Report reason is required'],
      trim: true,
      maxlength: [100, 'Reason must be less than 100 characters']
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description must be less than 1000 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
      index: true
    },
    adminNotes: {
      type: String,
      trim: true,
      maxlength: [500, 'Admin notes must be less than 500 characters']
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound index to prevent duplicate reports from same user for same content
ReportSchema.index({ reporterId: 1, reportedType: 1, reportedId: 1 }, { unique: true });

// Indexes for faster queries
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ reportedType: 1, reportedId: 1 });

export default mongoose.model<IReport>('Report', ReportSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IMarketplaceSettings extends Document {
  commissionRate: number; // Commission rate as decimal (e.g., 0.10 for 10%)
  createdAt: Date;
  updatedAt: Date;
}

const MarketplaceSettingsSchema: Schema = new Schema(
  {
    commissionRate: {
      type: Number,
      required: true,
      min: [0, 'Commission rate cannot be negative'],
      max: [1, 'Commission rate cannot exceed 100%'],
      default: 0.10 // 10% default
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one document exists
MarketplaceSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ commissionRate: 0.10 }); // Default 10%
  }
  return settings;
};

export default mongoose.model<IMarketplaceSettings>('MarketplaceSettings', MarketplaceSettingsSchema);

import mongoose, { Document, Schema } from 'mongoose';

export interface IHomeSettings extends Document {
  featuredCategories: mongoose.Types.ObjectId[];
  featuredProducts: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const HomeSettingsSchema: Schema = new Schema(
  {
    featuredCategories: {
      type: [Schema.Types.ObjectId],
      ref: 'Category',
      default: []
    },
    featuredProducts: {
      type: [Schema.Types.ObjectId],
      ref: 'Product',
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Ensure only one document exists
HomeSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export default mongoose.model<IHomeSettings>('HomeSettings', HomeSettingsSchema);

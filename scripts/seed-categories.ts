import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../src/models/Category';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/giaom-marketplace';

const defaultCategories = [
  { name: 'Electronics', slug: 'electronics', description: 'Electronic devices and gadgets' },
  { name: 'Fashion', slug: 'fashion', description: 'Apparel and fashion items' },
  { name: 'Home & Garden', slug: 'home-garden', description: 'Home decor, furniture, and garden supplies' },
  { name: 'Sports', slug: 'sports', description: 'Sports equipment and outdoor gear' },
  { name: 'Art', slug: 'art', description: 'Artwork, paintings, and creative pieces' },
  { name: 'Books', slug: 'books', description: 'Books and literature' }
];

async function seedCategories() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing categories
    await Category.deleteMany({});
    console.log('🗑️  Cleared existing categories');

    // Insert default categories
    const categories = await Category.insertMany(defaultCategories);
    console.log(`✅ Seeded ${categories.length} categories`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();

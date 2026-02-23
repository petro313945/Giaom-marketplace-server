import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product';
import User from '../src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/giaom-marketplace';

const exampleProducts = [
  {
    title: 'Wireless Headphones',
    description: 'High-quality wireless headphones with noise cancellation and premium sound quality.',
    price: 89.99,
    category: 'electronics',
    imageUrl: '/wireless-headphones.png',
  },
  {
    title: 'Vintage Leather Bag',
    description: 'Handcrafted vintage leather bag with classic design and durable construction.',
    price: 129.99,
    category: 'fashion',
    imageUrl: '/vintage-leather-bag.jpg',
  },
  {
    title: 'Handmade Ceramic Mug',
    description: 'Beautiful handmade ceramic mug perfect for your morning coffee or tea.',
    price: 24.99,
    category: 'home-garden',
    imageUrl: '/ceramic-mug.png',
  },
  {
    title: 'Smart Watch',
    description: 'Feature-rich smartwatch with fitness tracking, notifications, and long battery life.',
    price: 199.99,
    category: 'electronics',
    imageUrl: '/smartwatch-lifestyle.png',
  },
  {
    title: 'Organic Cotton T-Shirt',
    description: 'Comfortable organic cotton t-shirt, eco-friendly and soft on the skin.',
    price: 29.99,
    category: 'fashion',
    imageUrl: '/cotton-tshirt.png',
  },
  {
    title: 'Yoga Mat',
    description: 'Premium rolled yoga mat with non-slip surface and comfortable cushioning.',
    price: 39.99,
    category: 'sports',
    imageUrl: '/rolled-yoga-mat.png',
  },
];

async function seedProducts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Get or create a seller user
    let seller = await User.findOne({ email: 'seller@test.com' });
    
    if (!seller) {
      // Create a test seller user
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('earn$10K', 10);
      
      seller = await User.create({
        email: 'seller@test.com',
        password: hashedPassword,
        fullName: 'Test Seller',
        role: 'seller',
      });
      console.log('✅ Created test seller user');
    }

    // Make sure seller has approved seller profile
    const SellerProfile = require('../src/models/SellerProfile').default;
    let sellerProfile = await SellerProfile.findOne({ userId: seller._id });
    
    if (!sellerProfile) {
      sellerProfile = await SellerProfile.create({
        userId: seller._id,
        businessName: 'Test Seller Business',
        businessDescription: 'A test business for seeding products',
        status: 'approved',
      });
      console.log('✅ Created approved seller profile');
    } else if (sellerProfile.status !== 'approved') {
      sellerProfile.status = 'approved';
      await sellerProfile.save();
      console.log('✅ Updated seller profile to approved');
    }

    // Check if products already exist
    const existingProducts = await Product.find({ sellerId: seller._id });
    if (existingProducts.length > 0) {
      console.log(`⚠️  Found ${existingProducts.length} existing products. Skipping seed.`);
      console.log('   To re-seed, delete existing products first.');
      process.exit(0);
    }

    // Create products
    const products = await Product.insertMany(
      exampleProducts.map(product => ({
        ...product,
        sellerId: seller._id,
        status: 'approved', // Auto-approve for demo
      }))
    );

    console.log(`✅ Seeded ${products.length} products:`);
    products.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.title} - $${product.price}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding products:', error);
    process.exit(1);
  }
}

seedProducts();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import User from '../src/models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/giaom-marketplace';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create or update admin user
    let admin = await User.findOne({ email: 'admin@test.com' });
    if (!admin) {
      const hashedPassword = await bcrypt.hash('Admin123!', 10);
      admin = await User.create({
        email: 'admin@test.com',
        password: hashedPassword,
        fullName: 'Admin User',
        role: 'admin',
      });
      console.log('✅ Created admin user (admin@test.com / Admin123!)');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    process.exit(1);
  }
}

seedAdmin();

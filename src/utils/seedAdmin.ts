import bcrypt from 'bcryptjs';
import User from '../models/User';

/**
 * Seeds the admin user on first run
 * This function is idempotent - safe to call multiple times
 */
export const seedAdmin = async (): Promise<void> => {
  try {
    // Check if admin user already exists
    const existingAdmin = await User.findOne({ email: 'admin@test.com' });
    
    if (existingAdmin) {
      console.log('ℹ️  Admin user already exists');
      return;
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    await User.create({
      email: 'admin@test.com',
      password: hashedPassword,
      fullName: 'Admin User',
      role: 'admin',
    });
    
    console.log('✅ Created admin user (admin@test.com / Admin123!)');
  } catch (error) {
    console.error('❌ Error seeding admin:', error);
    // Don't throw - allow server to start even if admin seeding fails
  }
};

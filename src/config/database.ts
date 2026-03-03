import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://projohn313_db_user:PQRMnrogRGZHyFeC@cluster0.gnbxt6u.mongodb.net/giaom-marketplace';

export const connectDatabase = async (): Promise<void> => {
  try {
    // Connection options for better reliability
    const options = {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      connectTimeoutMS: 10000, // 10 seconds connection timeout
      retryWrites: true,
      retryReads: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 2, // Maintain at least 2 socket connections
    };

    console.log('🔄 Attempting to connect to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI, options);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
  } catch (error: any) {
    console.error('❌ MongoDB Connection Error:', error);
    
    // Provide more helpful error messages
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('\n💡 Troubleshooting tips:');
      console.error('   1. Check your internet connection');
      console.error('   2. Verify MongoDB Atlas cluster is running (not paused)');
      console.error('   3. Check if your IP address is whitelisted in MongoDB Atlas');
      console.error('   4. Verify the connection string is correct');
      console.error('   5. Try using a different DNS server (8.8.8.8 or 1.1.1.1)');
    } else if (error.code === 'EAUTH') {
      console.error('\n💡 Authentication failed:');
      console.error('   1. Check your MongoDB username and password');
      console.error('   2. Verify the database user has proper permissions');
    }
    
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB Error:', err);
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

mongoose.connection.on('connecting', () => {
  console.log('🔄 MongoDB connecting...');
});

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is not set!');
  process.exit(1);
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI);
  } catch (error: any) {
    console.error('MongoDB Connection Error:', error.message);
    process.exit(1);
  }
};

export const getConnectionState = (): string => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
};

export const isConnected = (): boolean => {
  return mongoose.connection.readyState === 1;
};

mongoose.connection.on('error', (err) => {
  console.error('MongoDB Error:', err);
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  process.exit(0);
});

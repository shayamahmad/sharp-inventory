import mongoose from 'mongoose';

/**
 * @param {string} uri - Full MongoDB URI (local or Atlas mongodb+srv://...)
 */
export async function connectDb(uri) {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error('MONGODB_URI is missing — set it in backend/.env');
  }

  mongoose.set('strictQuery', true);

  const options = {
    serverSelectionTimeoutMS: 20_000,
    maxPoolSize: 10,
  };

  // Atlas SRV: prefer IPv4 on some Windows/Node setups (avoids flaky DNS/IPv6 timeouts)
  if (uri.trim().startsWith('mongodb+srv://')) {
    options.family = 4;
  }

  await mongoose.connect(uri.trim(), options);
  return mongoose.connection;
}

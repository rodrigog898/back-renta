
import mongoose, { Connection } from 'mongoose';
import env from './env';
import { retry } from '../utils/retry';

mongoose.set('strictQuery', true);

export async function connectDB(): Promise<Connection> {
  await retry(async () => {
    await mongoose.connect(env.mongoUri, {
      maxPoolSize: env.mongoPool,
      serverSelectionTimeoutMS: 10000
    });
  }, {
    retries: 5,
    minDelayMs: 300,
    maxDelayMs: 5000,
    factor: 2,
    onRetry: (err, attempt) => {
      console.error(`[DB] Retry #${attempt} after error:`, (err as any)?.message || err);
    }
  });

  // health ping
  await mongoose.connection.db.admin().command({ ping: 1 });

  // connection event logs
  mongoose.connection.on('disconnected', () => console.warn('[DB] disconnected'));
  mongoose.connection.on('reconnected', () => console.info('[DB] reconnected'));
  mongoose.connection.on('error', (e) => console.error('[DB] error', e));

  return mongoose.connection;
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

import mongoose from 'mongoose';
import { env } from './env';

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGODB_URI);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);

  // Drop the old timesheets unique index (shiftId+workerId without tenantId) if it still exists.
  // The new index is tenantId+shiftId+workerId so ghost cross-tenant timesheets don't block creation.
  try {
    await mongoose.connection.collection('timesheets').dropIndex('shiftId_1_workerId_1');
    console.log('[DB] Dropped legacy timesheets index shiftId_1_workerId_1');
  } catch {
    // Index didn't exist — normal after first successful migration
  }
}

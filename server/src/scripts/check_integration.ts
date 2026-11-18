import { connectDB } from '../config/db';
import { IntegrationSettings } from '../models/IntegrationSettings';
import mongoose from 'mongoose';

(async () => {
  await connectDB();
  const all = await IntegrationSettings.find({}).lean();
  console.log(JSON.stringify(all, null, 2));
  await mongoose.disconnect();
})();

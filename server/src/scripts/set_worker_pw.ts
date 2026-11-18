import { hashPassword } from '../utils/password';
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/orgx');
  const hash = await hashPassword('Worker123!');
  const result = await mongoose.connection.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId('6a4515e89bf6bdd1fe1f1238') },
    { $set: { passwordHash: hash } }
  );
  console.log('matched:', result.matchedCount, 'modified:', result.modifiedCount);
  await mongoose.disconnect();
}
run().catch(console.error);

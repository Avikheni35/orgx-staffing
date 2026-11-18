import { hashPassword } from '../utils/password';
import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/orgx');
  const agencyHash = await hashPassword('Avikheni123');
  const workerHash = await hashPassword('Worker123!');

  const r1 = await mongoose.connection.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId('6a44efb3daaaa8729307e31c') },
    { $set: { passwordHash: agencyHash } }
  );
  const r2 = await mongoose.connection.collection('users').updateOne(
    { _id: new mongoose.Types.ObjectId('6a4515e89bf6bdd1fe1f1238') },
    { $set: { passwordHash: workerHash } }
  );
  console.log('agency admin:', r1.modifiedCount, '| worker:', r2.modifiedCount);
  await mongoose.disconnect();
}
run().catch(console.error);

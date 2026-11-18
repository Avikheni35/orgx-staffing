import mongoose from 'mongoose';
import { Notification } from '../models/Notification';
import { User } from '../models/User';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/orgx');
  
  // Find the agency admin user
  const admin = await User.findOne({ email: 'avikheni35@gmail.com' }).lean();
  if (!admin) { console.log('user not found'); process.exit(1); }
  
  await Notification.create([
    {
      tenantId: admin.tenantId,
      recipientUserId: admin._id,
      type: 'shift_application',
      title: 'Neue Bewerbung',
      body: 'Siddharth Bhalani hat sich für eine Schicht beworben.',
      link: '/app/shifts',
      readAt: null,
    },
    {
      tenantId: admin.tenantId,
      recipientUserId: admin._id,
      type: 'timesheet_dispute',
      title: 'Stundenzettel bestritten',
      body: 'Siddharth Bhalani hat einen Stundenzettel bestritten: Stunden stimmen nicht überein.',
      link: '/app/timesheets',
      readAt: null,
    },
    {
      tenantId: admin.tenantId,
      recipientUserId: admin._id,
      type: 'contract_signed',
      title: 'Vertrag unterzeichnet',
      body: 'Siddharth Bhalani hat einen Vertrag unterzeichnet.',
      link: '/app/contracts',
      readAt: new Date(), // already read
    },
  ]);
  
  console.log('Seeded 3 notifications');
  await mongoose.disconnect();
}
run().catch(console.error);

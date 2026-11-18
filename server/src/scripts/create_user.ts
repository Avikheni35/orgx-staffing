import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { hashPassword } from '../utils/password';

async function run() {
  await connectDB();

  const tenant = await Tenant.findOne({ subdomain: 'demo' });
  if (!tenant) {
    console.error('Demo tenant not found — run the seed script first.');
    process.exit(1);
  }

  const email = 'avikheni35@gmail.com';
  const password = 'Admin1234!';

  const existing = await User.findOne({ email, tenantId: tenant._id });
  if (existing) {
    console.log(`User ${email} already exists in demo tenant.`);
    process.exit(0);
  }

  await User.create({
    tenantId: tenant._id,
    role: 'agency_admin',
    email,
    passwordHash: await hashPassword(password),
    firstName: 'Avik',
    lastName: 'Heni',
    status: 'active',
    emailVerified: true,
  });

  console.log(`Created agency_admin: ${email} / ${password} (tenant: demo)`);
  process.exit(0);
}

run().catch((err) => { console.error(err); process.exit(1); });

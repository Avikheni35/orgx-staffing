/**
 * Creates a super admin user and a demo tenant if they don't already exist.
 * Run once: npx tsx src/scripts/seed.ts
 */
import { connectDB } from '../config/db';
import { User } from '../models/User';
import { Tenant } from '../models/Tenant';
import { hashPassword } from '../utils/password';

async function seed() {
  await connectDB();

  // Super admin
  const superAdminEmail = process.env.SEED_SUPER_EMAIL ?? 'admin@platform.de';
  const superAdminPassword = process.env.SEED_SUPER_PASSWORD ?? 'SuperAdmin123!';

  const existing = await User.findOne({ email: superAdminEmail, role: 'super_admin' });
  if (!existing) {
    await User.create({
      tenantId: null,
      role: 'super_admin',
      email: superAdminEmail,
      passwordHash: await hashPassword(superAdminPassword),
      firstName: 'Platform',
      lastName: 'Admin',
      status: 'active',
      emailVerified: true,
    });
    console.log(`Super admin created: ${superAdminEmail}`);
  } else {
    console.log(`Super admin already exists: ${superAdminEmail}`);
  }

  // Demo tenant
  const demoSubdomain = 'demo';
  const existingTenant = await Tenant.findOne({ subdomain: demoSubdomain });
  if (!existingTenant) {
    const tenant = await Tenant.create({
      name: 'Demo Agentur GmbH',
      subdomain: demoSubdomain,
      loginCode: demoSubdomain,
      status: 'active',
      plan: 'growth',
    });

    // Agency admin for demo tenant
    await User.create({
      tenantId: tenant._id,
      role: 'agency_admin',
      email: 'agentur@demo.de',
      passwordHash: await hashPassword(process.env.SEED_DEMO_PASSWORD ?? 'Demo1234!'),
      firstName: 'Max',
      lastName: 'Mustermann',
      status: 'active',
      emailVerified: true,
    });

    // Demo worker (uses magic link — no password)
    await User.create({
      tenantId: tenant._id,
      role: 'worker',
      email: 'worker@demo.de',
      firstName: 'Anna',
      lastName: 'Schmidt',
      status: 'active',
      emailVerified: true,
    });

    console.log(`Demo tenant created (loginCode: ${demoSubdomain})`);
    console.log(`Agency admin: agentur@demo.de / ${process.env.SEED_DEMO_PASSWORD ?? 'Demo1234!'}`);
    console.log('Demo worker:  worker@demo.de  (magic link only)');
  } else {
    console.log('Demo tenant already exists');
  }

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

/**
 * Seeds minimum data for the neulogistik2 tenant to test M1→M2/M3 integration:
 *   - 1 worker (active) → triggers M2 staff pool sync
 *   - 1 business (Logistik AG Frankfurt already exists)
 *   - 1 shift + assignment
 *   - 1 timesheet (pending) → ready to approve → triggers M3 payroll line
 *
 * Run: npx tsx src/scripts/seed_neulogistik2.ts
 */
import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import { Tenant } from '../models/Tenant';
import { Worker } from '../models/Worker';
import { Business } from '../models/Business';
import { Shift } from '../models/Shift';
import { Timesheet } from '../models/Timesheet';
import { User } from '../models/User';

async function seed() {
  await connectDB();

  const tenant = await Tenant.findOne({ loginCode: 'neulogistik2' });
  if (!tenant) {
    console.error('Tenant neulogistik2 not found — run M1 seed first');
    process.exit(1);
  }
  const tenantId = tenant._id;
  const adminUser = await User.findOne({ tenantId, role: 'agency_admin' });
  if (!adminUser) {
    console.error('Admin user not found for neulogistik2');
    process.exit(1);
  }

  console.log(`Seeding for tenant: ${tenant.name} (${tenantId})`);

  // ── Business ──────────────────────────────────────────────────────────────
  let business = await Business.findOne({ tenantId, name: 'Logistik AG Frankfurt' });
  if (!business) {
    business = await Business.create({
      tenantId,
      name: 'Logistik AG Frankfurt',
      contactEmail: 'kontakt@logistik-ag.de',
      contactPhone: '+49 69 1234567',
      address: { street: 'Mainzer Landstr. 50', city: 'Frankfurt', postalCode: '60325', country: 'DE' },
      status: 'active',
      createdBy: adminUser._id,
    });
    console.log(`Business created: ${business.name}`);
  } else {
    console.log(`Business already exists: ${business.name}`);
  }

  // ── Worker ────────────────────────────────────────────────────────────────
  let worker = await Worker.findOne({ tenantId, email: 'thomas.mueller@neulogistik2.de' });
  if (!worker) {
    worker = await Worker.create({
      tenantId,
      firstName: 'Thomas',
      lastName: 'Müller',
      email: 'thomas.mueller@neulogistik2.de',
      phone: '+49 170 9876543',
      dateOfBirth: new Date('1990-05-15'),
      nationality: 'DE',
      address: { street: 'Kaiserstr. 12', city: 'Frankfurt', postalCode: '60311', country: 'DE' },
      status: 'active',
      steuerklasse: '1',
      moduleSource: 'workforce',
      externalRefs: [],
    });
    console.log(`Worker created: ${worker.firstName} ${worker.lastName} (active)`);
  } else {
    console.log(`Worker already exists: ${worker.firstName} ${worker.lastName}`);
  }

  // ── Shift ─────────────────────────────────────────────────────────────────
  const shiftStart = new Date('2026-08-20T07:00:00.000Z');
  const shiftEnd   = new Date('2026-08-20T15:00:00.000Z');

  let shift = await Shift.findOne({ tenantId, businessId: business._id, startTime: shiftStart });
  if (!shift) {
    shift = await Shift.create({
      tenantId,
      businessId: business._id,
      businessName: business.name,
      title: 'Lagerschicht Früh',
      startTime: shiftStart,
      endTime: shiftEnd,
      breakMinutes: 30,
      requiredWorkers: 1,
      payRatePerHour: 14.50,
      billingRatePerHour: 22.00,
      status: 'completed',
      isInstantBooking: false,
      moduleSource: 'workforce',
      externalRefs: [],
      assignedWorkers: [
        {
          workerId: worker._id,
          workerName: `${worker.firstName} ${worker.lastName}`,
          status: 'completed',
          completedAt: shiftEnd,
        },
      ],
      createdBy: adminUser._id,
    });
    console.log(`Shift created: ${shift.title} on 2026-08-20`);
  } else {
    console.log(`Shift already exists: ${shift.title}`);
  }

  // ── Timesheet ─────────────────────────────────────────────────────────────
  const PAY_RATE  = 14.50;
  const BILL_RATE = 22.00;
  const totalHours = (shiftEnd.getTime() - shiftStart.getTime()) / 3_600_000 - 0.5; // 7.5h minus 30-min break
  const grossPay   = Math.round(totalHours * PAY_RATE * 100) / 100;

  let timesheet = await Timesheet.findOne({ tenantId, shiftId: shift._id, workerId: worker._id });
  if (!timesheet) {
    timesheet = await Timesheet.create({
      tenantId,
      shiftId:              shift._id,
      workerId:             worker._id,
      workerName:           `${worker.firstName} ${worker.lastName}`,
      businessId:           business._id,
      businessName:         business.name,
      shiftDate:            shiftStart,
      plannedStart:         shiftStart,
      plannedEnd:           shiftEnd,
      plannedBreakMinutes:  30,
      actualStart:          shiftStart,
      actualEnd:            shiftEnd,
      actualBreakMinutes:   30,
      payRatePerHour:       PAY_RATE,
      billingRatePerHour:   BILL_RATE,
      totalHours,
      grossPay,
      status: 'pending',
      moduleSource: 'workforce',
      externalRefs: [],
    });
    console.log(`Timesheet created: ${totalHours}h @ ${PAY_RATE}€/h = ${grossPay}€ gross  [status: pending]`);
  } else {
    console.log(`Timesheet already exists: status=${timesheet.status}`);
  }

  console.log('\n✓ Seed complete for neulogistik2');
  console.log(`  Worker:    Thomas Müller (${worker._id}) — active`);
  console.log(`  Shift:     ${shift._id} — completed`);
  console.log(`  Timesheet: ${timesheet._id} — ${timesheet.status}`);
  console.log('\nNext steps:');
  console.log('  1. Go to M1 → Workers → Thomas Müller  (worker already active, M2 sync fires on activation)');
  console.log('  2. Go to M1 → Timesheets → Approve the pending timesheet → M3 payroll line auto-posts');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

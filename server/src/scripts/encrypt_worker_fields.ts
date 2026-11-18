/**
 * One-time migration: encrypts plaintext Worker IBAN / Steuernummer / SV-Nummer
 * and Tenant IBAN using AES-256-GCM.
 *
 * Run AFTER setting FIELD_ENCRYPTION_KEY in .env:
 *   cd server && npx tsx src/scripts/encrypt_worker_fields.ts
 *
 * The encryptField function is idempotent — values already in enc:... format
 * are returned unchanged, so this script is safe to re-run.
 */

import '../config/env'; // load .env before anything else
import { connectDB } from '../config/db';
import { Worker } from '../models/Worker';
import { Tenant } from '../models/Tenant';
import { encryptField } from '../utils/crypto';

async function run() {
  await connectDB();

  // --- Workers ---
  const workers = await Worker.find({
    $or: [
      { ibanEncrypted: { $exists: true, $ne: null } },
      { steuernummerEncrypted: { $exists: true, $ne: null } },
      { sozialversicherungsnummerEncrypted: { $exists: true, $ne: null } },
    ],
  }).select('ibanEncrypted steuernummerEncrypted sozialversicherungsnummerEncrypted');

  let workerUpdated = 0;
  for (const w of workers) {
    let dirty = false;

    if (w.ibanEncrypted && !w.ibanEncrypted.startsWith('enc:')) {
      w.ibanEncrypted = encryptField(w.ibanEncrypted);
      dirty = true;
    }
    if (w.steuernummerEncrypted && !w.steuernummerEncrypted.startsWith('enc:')) {
      w.steuernummerEncrypted = encryptField(w.steuernummerEncrypted);
      dirty = true;
    }
    if (w.sozialversicherungsnummerEncrypted && !w.sozialversicherungsnummerEncrypted.startsWith('enc:')) {
      w.sozialversicherungsnummerEncrypted = encryptField(w.sozialversicherungsnummerEncrypted);
      dirty = true;
    }

    if (dirty) {
      await w.save();
      workerUpdated++;
    }
  }

  console.log(`Workers processed: ${workers.length}, encrypted: ${workerUpdated}`);

  // --- Tenants ---
  const tenants = await Tenant.find({
    'companyDetails.ibanEncrypted': { $exists: true, $ne: null },
  }).select('companyDetails.ibanEncrypted');

  let tenantUpdated = 0;
  for (const t of tenants) {
    const raw = t.companyDetails?.ibanEncrypted;
    if (raw && !raw.startsWith('enc:')) {
      t.companyDetails.ibanEncrypted = encryptField(raw);
      await t.save();
      tenantUpdated++;
    }
  }

  console.log(`Tenants processed: ${tenants.length}, encrypted: ${tenantUpdated}`);
  console.log('Done.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

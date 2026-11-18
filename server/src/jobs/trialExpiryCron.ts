import { Tenant } from '../models/Tenant';
import { User } from '../models/User';
import { sendEmail } from '../utils/email';

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function expireTrials(): Promise<void> {
  const now = new Date();

  // Find trial tenants whose trialEndsAt has passed
  const expired = await Tenant.find({
    status: 'trial',
    trialEndsAt: { $lt: now },
  }).lean();

  if (expired.length === 0) return;

  for (const tenant of expired) {
    await Tenant.findByIdAndUpdate(tenant._id, { status: 'suspended' });

    // Notify agency admin(s)
    const admins = await User.find({
      tenantId: tenant._id,
      role: 'agency_admin',
      status: 'active',
    }).select('email firstName').lean();

    for (const admin of admins) {
      sendEmail({
        to: admin.email,
        subject: 'Ihre OrgX-Testphase ist abgelaufen',
        html: `
          <h2>Hallo ${admin.firstName},</h2>
          <p>Ihre 14-tägige Testphase für <strong>${(tenant as { name: string }).name}</strong> ist abgelaufen.</p>
          <p>Ihr Konto ist jetzt gesperrt. Wählen Sie einen Plan, um den Zugriff wiederherzustellen:</p>
          <p><a href="${process.env.CLIENT_URL ?? 'http://localhost:3000'}/app/settings/billing">
            Jetzt Plan auswählen →
          </a></p>
          <hr/>
          <p style="color:#888;font-size:12px;">
            Bei Fragen wenden Sie sich an support@orgx.de
          </p>
        `,
      }).catch(() => {});
    }

    console.log(`[trialExpiry] Suspended tenant ${(tenant as { name: string }).name} (${tenant._id})`);
  }
}

export function startTrialExpiryCron(): void {
  // Run once immediately on startup, then every 24 hours
  expireTrials().catch((e) => console.error('[trialExpiry] Error:', e));
  setInterval(() => {
    expireTrials().catch((e) => console.error('[trialExpiry] Error:', e));
  }, INTERVAL_MS);
}

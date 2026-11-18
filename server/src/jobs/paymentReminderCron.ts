import { Invoice } from '../models/Invoice';
import { Business } from '../models/Business';
import { sendEmail } from '../utils/email';

const REMINDER_INTERVAL_DAYS = 7;

async function sendPaymentReminders(): Promise<void> {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - REMINDER_INTERVAL_DAYS);

  // Find overdue or sent invoices past due date that haven't been reminded recently
  const invoices = await Invoice.find({
    status: { $in: ['sent', 'overdue'] },
    dueDate: { $lt: now },
    $or: [
      { lastReminderSentAt: { $exists: false } },
      { lastReminderSentAt: { $lt: cutoff } },
    ],
  }).lean();

  if (!invoices.length) return;
  console.log(`[PaymentReminderCron] Processing ${invoices.length} overdue invoice(s)`);

  let sent = 0;
  for (const inv of invoices) {
    try {
      const business = await Business.findOne(
        { _id: inv.businessId, tenantId: inv.tenantId },
        { contacts: 1, name: 1 },
      ).lean();

      const billingContacts = business?.contacts?.filter(
        (c: { hasPortalAccess: boolean; email: string }) => c.hasPortalAccess && c.email,
      ) ?? [];

      if (!billingContacts.length) continue;

      const daysOverdue = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000);
      const dueDateStr = new Date(inv.dueDate).toLocaleDateString('de-DE');

      const html = `
        <p>Sehr geehrte Damen und Herren,</p>
        <p>wir möchten Sie freundlich daran erinnern, dass die folgende Rechnung noch offen ist:</p>
        <table style="border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Rechnungsnummer:</td><td>${inv.invoiceNumber}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Betrag:</td><td>${inv.total.toFixed(2).replace('.', ',')} €</td></tr>
          <tr><td style="padding:4px 12px 4px 0;font-weight:bold">Fällig seit:</td><td>${dueDateStr} (${daysOverdue} Tage überfällig)</td></tr>
        </table>
        <p>Bitte überweisen Sie den ausstehenden Betrag so bald wie möglich.</p>
        <p>Falls Sie bereits gezahlt haben, bitten wir Sie, diese E-Mail zu ignorieren.</p>
        <p>Mit freundlichen Grüßen,<br>${inv.agencyName}</p>
      `;

      for (const contact of billingContacts) {
        await sendEmail({
          to: contact.email,
          subject: `Zahlungserinnerung – Rechnung ${inv.invoiceNumber}`,
          html,
        });
      }

      await Invoice.updateOne(
        { _id: inv._id },
        { $set: { lastReminderSentAt: new Date(), status: 'overdue' } },
      );
      sent++;
    } catch (err) {
      console.error(`[PaymentReminderCron] Failed for invoice ${inv.invoiceNumber}:`, err);
    }
  }

  if (sent > 0) console.log(`[PaymentReminderCron] ${sent} reminder(s) sent`);
}

export function startPaymentReminderCron(): void {
  sendPaymentReminders().catch(console.error);

  const MS_24H = 24 * 60 * 60 * 1000;
  setInterval(() => {
    sendPaymentReminders().catch(console.error);
  }, MS_24H);

  console.log('[PaymentReminderCron] Started (runs every 24h)');
}

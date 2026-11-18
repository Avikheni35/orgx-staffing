import { Invoice, IInvoice, InvoiceStatus } from '../models/Invoice';
import { Timesheet } from '../models/Timesheet';
import { Business } from '../models/Business';
import { Tenant } from '../models/Tenant';
import { AppError } from '../utils/AppError';
import { emitIntegrationEvent } from '../utils/integration';
import { peers } from '../utils/serviceClient';
import { enqueueOutbox } from '../utils/outbox';

export interface InvoiceFilters {
  status?: InvoiceStatus;
  businessId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  limit?: number;
}

export async function listInvoices(tenantId: string, filters: InvoiceFilters = {}) {
  const { status, businessId, from, to, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = { tenantId };

  if (status) query.status = status;
  if (businessId) query.businessId = businessId;
  if (from || to) {
    query.invoiceDate = {};
    if (from) (query.invoiceDate as Record<string, Date>).$gte = from;
    if (to) (query.invoiceDate as Record<string, Date>).$lte = to;
  }

  const [invoices, total] = await Promise.all([
    Invoice.find(query).sort({ invoiceDate: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Invoice.countDocuments(query),
  ]);

  return { invoices, total, page, pages: Math.ceil(total / limit) };
}

export async function getInvoice(tenantId: string, invoiceId: string): Promise<IInvoice> {
  const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
  if (!invoice) throw new AppError('Invoice not found', 404);
  return invoice;
}

export interface CreateInvoiceData {
  businessId: string;
  timesheetIds: string[];
  invoiceDate: Date;
  dueDate: Date;
  periodFrom: Date;
  periodTo: Date;
  notes?: string;
}

export async function createInvoice(
  tenantId: string,
  data: CreateInvoiceData,
  createdBy: string
): Promise<IInvoice> {
  if (data.timesheetIds.length === 0) {
    throw new AppError('Select at least one timesheet', 400);
  }

  // Validate timesheets belong to this tenant + business + are approved + not yet exported
  const timesheets = await Timesheet.find({
    _id: { $in: data.timesheetIds },
    tenantId,
    businessId: data.businessId,
    status: 'approved',
  });

  if (timesheets.length !== data.timesheetIds.length) {
    throw new AppError('One or more timesheets are invalid, not approved, or already exported', 400);
  }

  const [business, tenant] = await Promise.all([
    Business.findOne({ _id: data.businessId, tenantId }).lean(),
    Tenant.findById(tenantId),
  ]);

  if (!business) throw new AppError('Business not found', 404);
  if (!tenant) throw new AppError('Tenant not found', 404);

  // Atomically get next invoice number
  const updatedTenant = await Tenant.findByIdAndUpdate(
    tenantId,
    { $inc: { 'invoiceSettings.currentNumber': 1 } },
    { new: true }
  );
  const invoiceNumber = `${updatedTenant!.invoiceSettings.prefix}-${updatedTenant!.invoiceSettings.currentNumber}`;

  // Build line items — use billingRatePerHour if set, fall back to payRatePerHour
  const lineItems = timesheets.map((ts) => {
    const rate = ts.billingRatePerHour ?? ts.payRatePerHour;
    const amount = parseFloat((ts.totalHours * rate).toFixed(2));
    const dateStr = new Date(ts.shiftDate).toLocaleDateString('de-DE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
    return {
      timesheetId: ts._id,
      description: `${ts.workerName} – ${dateStr}`,
      hours: ts.totalHours,
      ratePerHour: rate,
      amount,
    };
  });

  const subtotal = parseFloat(lineItems.reduce((s, l) => s + l.amount, 0).toFixed(2));
  const vatRate = tenant.invoiceSettings.vatRate;
  const vatAmount = parseFloat((subtotal * vatRate / 100).toFixed(2));
  const total = parseFloat((subtotal + vatAmount).toFixed(2));

  const businessAddress = [
    business.address?.street,
    [business.address?.postalCode, business.address?.city].filter(Boolean).join(' '),
    business.address?.country,
  ].filter(Boolean).join(', ');

  const invoice = await Invoice.create({
    tenantId,
    invoiceNumber,
    businessId: data.businessId,
    businessName: business.name,
    businessAddress: businessAddress || undefined,
    businessVatId: business.vatNumber,
    agencyName: tenant.name,
    agencyAddress: tenant.companyDetails.address,
    agencyVatId: tenant.companyDetails.vatId,
    invoiceDate: data.invoiceDate,
    dueDate: data.dueDate,
    periodFrom: data.periodFrom,
    periodTo: data.periodTo,
    lineItems,
    subtotal,
    vatRate,
    vatAmount,
    total,
    notes: data.notes,
    createdBy,
  });

  // Mark timesheets as exported so they can't be double-invoiced
  await Timesheet.updateMany(
    { _id: { $in: data.timesheetIds } },
    { $set: { status: 'exported' } }
  );

  emitIntegrationEvent({
    tenantId,
    eventType: 'invoice.created',
    entityType: 'Invoice',
    entityId: invoice._id,
    payload: { invoiceNumber: invoice.invoiceNumber, businessId: invoice.businessId, businessName: invoice.businessName, total: invoice.total, status: invoice.status },
  });

  return invoice;
}

export async function updateInvoiceStatus(
  tenantId: string,
  invoiceId: string,
  status: InvoiceStatus
): Promise<IInvoice> {
  const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
  if (!invoice) throw new AppError('Invoice not found', 404);
  if (invoice.status === 'cancelled') throw new AppError('Cannot update a cancelled invoice', 400);

  invoice.status = status;
  await invoice.save();

  if (status === 'sent' || status === 'paid') {
    emitIntegrationEvent({
      tenantId,
      eventType: `invoice.${status}`,
      entityType: 'Invoice',
      entityId: invoice._id,
      payload: { invoiceNumber: invoice.invoiceNumber, businessId: invoice.businessId, total: invoice.total, status },
    });

    // Post journal entry to M3 ERP
    const journalPayload =
      status === 'sent'
        ? {
            debitAccount:  1400,
            creditAccount: 4400,
            amountCents:   Math.round(invoice.total * 100),
            description:   `Invoice ${invoice.invoiceNumber} – ${invoice.businessName}`,
            postingDate:   invoice.invoiceDate.toISOString().split('T')[0],
            sourceRef:     { module: 'm1', type: 'invoice', id: invoice._id.toString() },
          }
        : {
            debitAccount:  1200,
            creditAccount: 1400,
            amountCents:   Math.round(invoice.total * 100),
            description:   `Payment received: ${invoice.invoiceNumber} – ${invoice.businessName}`,
            postingDate:   new Date().toISOString().split('T')[0],
            sourceRef:     { module: 'm1', type: 'payment', id: invoice._id.toString() },
          };

    const delivered = await peers.m3.postJournalEntry(tenantId, journalPayload);
    if (!delivered) {
      await enqueueOutbox({
        tenantId,
        type: `invoice.${status}`,
        targetModule: 'm3',
        targetPath: '/api/internal/journal-entries',
        payload: journalPayload,
      });
    }
  }

  return invoice;
}

// Returns approved (not yet exported) timesheets for a business, ready to invoice
export async function getInvoiceableTimesheets(tenantId: string, businessId: string) {
  return Timesheet.find({
    tenantId,
    businessId,
    status: 'approved',
  }).sort({ shiftDate: 1 }).lean();
}

import { Schema, model, Document, Types } from 'mongoose';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface IInvoiceLineItem {
  timesheetId: Types.ObjectId;
  description: string;
  hours: number;
  ratePerHour: number;
  amount: number;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  invoiceNumber: string;
  // Client snapshot
  businessId: Types.ObjectId;
  businessName: string;
  businessAddress?: string;
  businessVatId?: string;
  // Agency snapshot
  agencyName: string;
  agencyAddress?: string;
  agencyVatId?: string;
  // Dates
  invoiceDate: Date;
  dueDate: Date;
  periodFrom: Date;
  periodTo: Date;
  // Line items
  lineItems: IInvoiceLineItem[];
  // Totals
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  // Meta
  status: InvoiceStatus;
  notes?: string;
  lastReminderSentAt?: Date;
  moduleSource: 'workforce';
  externalRefs: Array<{ module: string; entityType: string; entityId: string; linkedAt: Date }>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LineItemSchema = new Schema<IInvoiceLineItem>(
  {
    timesheetId: { type: Schema.Types.ObjectId, ref: 'Timesheet', required: true },
    description: { type: String, required: true },
    hours: { type: Number, required: true },
    ratePerHour: { type: Number, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    invoiceNumber: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    businessName: { type: String, required: true },
    businessAddress: String,
    businessVatId: String,
    agencyName: { type: String, required: true },
    agencyAddress: String,
    agencyVatId: String,
    invoiceDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    periodFrom: { type: Date, required: true },
    periodTo: { type: Date, required: true },
    lineItems: [LineItemSchema],
    subtotal: { type: Number, required: true },
    vatRate: { type: Number, required: true },
    vatAmount: { type: Number, required: true },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'paid', 'overdue', 'cancelled'],
      default: 'draft',
    },
    notes: String,
    lastReminderSentAt: Date,
    moduleSource: { type: String, default: 'workforce', immutable: true },
    externalRefs: [{ module: String, entityType: String, entityId: String, linkedAt: { type: Date, default: Date.now }, _id: false }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

InvoiceSchema.index({ tenantId: 1, invoiceDate: -1 });
InvoiceSchema.index({ tenantId: 1, status: 1 });
InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

export const Invoice = model<IInvoice>('Invoice', InvoiceSchema);

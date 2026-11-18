import { Schema, model, Document, Types } from 'mongoose';

export interface ICreditNote extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  invoiceId: Types.ObjectId;
  creditNoteNumber: string;
  reason: string;
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'applied';
  issuedAt?: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CreditNoteSchema = new Schema<ICreditNote>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    invoiceId: { type: Schema.Types.ObjectId, ref: 'Invoice', required: true },
    creditNoteNumber: { type: String, required: true },
    reason: { type: String, required: true },
    lineItems: [
      {
        description: { type: String, required: true },
        quantity: { type: Number, required: true },
        unitPrice: { type: Number, required: true },
        total: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    vatRate: { type: Number, default: 19 },
    vatAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['draft', 'issued', 'applied'], default: 'draft' },
    issuedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

CreditNoteSchema.index({ tenantId: 1, invoiceId: 1 });
CreditNoteSchema.index({ tenantId: 1, creditNoteNumber: 1 }, { unique: true });

export const CreditNote = model<ICreditNote>('CreditNote', CreditNoteSchema);

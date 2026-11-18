import { Schema, model, Document, Types } from 'mongoose';

export type ContractStatus = 'pending_signature' | 'signed' | 'voided';

export interface IContract extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  shiftId: Types.ObjectId;
  workerId: Types.ObjectId;
  workerName: string;
  workerEmail: string;
  agencyName: string;
  businessName: string;
  shiftTitle: string;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  payRatePerHour: number;
  contractHtml: string;
  status: ContractStatus;
  signedAt?: Date;
  signatureData?: string;
  signedIp?: string;
  emailSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContractSchema = new Schema<IContract>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: { type: String, required: true },
    workerEmail: { type: String, required: true },
    agencyName: { type: String, required: true },
    businessName: { type: String, required: true },
    shiftTitle: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    breakMinutes: { type: Number, default: 0 },
    payRatePerHour: { type: Number, required: true },
    contractHtml: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending_signature', 'signed', 'voided'],
      default: 'pending_signature',
    },
    signedAt: Date,
    signatureData: String,
    signedIp: String,
    emailSentAt: Date,
  },
  { timestamps: true }
);

ContractSchema.index({ tenantId: 1, status: 1 });
ContractSchema.index({ tenantId: 1, shiftId: 1, workerId: 1 }, { unique: true });
ContractSchema.index({ tenantId: 1, workerId: 1 });

export const Contract = model<IContract>('Contract', ContractSchema);

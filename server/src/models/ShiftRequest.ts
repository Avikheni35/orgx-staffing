import { Schema, model, Document, Types } from 'mongoose';

export interface IShiftRequest extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  businessId: Types.ObjectId;
  locationId?: string;
  requestedBy: Types.ObjectId;
  title: string;
  description?: string;
  date: Date;
  startTime: string;
  endTime: string;
  workersNeeded: number;
  qualifications?: string[];
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled';
  agencyNote?: string;
  linkedShiftId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftRequestSchema = new Schema<IShiftRequest>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    locationId: String,
    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: String,
    date: { type: Date, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    workersNeeded: { type: Number, required: true, min: 1 },
    qualifications: [String],
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'fulfilled'], default: 'pending' },
    agencyNote: String,
    linkedShiftId: { type: Schema.Types.ObjectId, ref: 'Shift' },
  },
  { timestamps: true }
);

ShiftRequestSchema.index({ tenantId: 1, businessId: 1, status: 1 });
ShiftRequestSchema.index({ tenantId: 1, status: 1 });

export const ShiftRequest = model<IShiftRequest>('ShiftRequest', ShiftRequestSchema);

import { Schema, model, Document, Types } from 'mongoose';

export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface IShiftApplication extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  shiftId: Types.ObjectId;
  workerId: Types.ObjectId;
  workerName: string;
  status: ApplicationStatus;
  appliedAt: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
}

const ShiftApplicationSchema = new Schema<IShiftApplication>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    appliedAt: { type: Date, default: Date.now },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: false }
);

// One application per worker per shift
ShiftApplicationSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });
ShiftApplicationSchema.index({ tenantId: 1, workerId: 1, status: 1 });
ShiftApplicationSchema.index({ tenantId: 1, shiftId: 1 });

export const ShiftApplication = model<IShiftApplication>('ShiftApplication', ShiftApplicationSchema);

import { Schema, model, Document, Types } from 'mongoose';

export type TimesheetStatus = 'pending' | 'approved' | 'disputed' | 'exported';

export interface ITimesheet extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  shiftId: Types.ObjectId;
  workerId: Types.ObjectId;
  workerName: string;
  businessId: Types.ObjectId;
  businessName: string;
  shiftDate: Date;
  plannedStart: Date;
  plannedEnd: Date;
  plannedBreakMinutes: number;
  actualStart: Date;
  actualEnd: Date;
  actualBreakMinutes: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  totalHours: number;
  grossPay: number;
  status: TimesheetStatus;
  notes?: string;
  disputeReason?: string;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  moduleSource: 'workforce';
  externalRefs: Array<{ module: string; entityType: string; entityId: string; linkedAt: Date }>;
  createdAt: Date;
  updatedAt: Date;
}

const TimesheetSchema = new Schema<ITimesheet>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: { type: String, required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    businessName: { type: String, required: true },
    shiftDate: { type: Date, required: true },
    plannedStart: { type: Date, required: true },
    plannedEnd: { type: Date, required: true },
    plannedBreakMinutes: { type: Number, default: 0 },
    actualStart: { type: Date, required: true },
    actualEnd: { type: Date, required: true },
    actualBreakMinutes: { type: Number, default: 0 },
    payRatePerHour: { type: Number, required: true },
    billingRatePerHour: Number,
    totalHours: { type: Number, required: true },
    grossPay: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'disputed', 'exported'],
      default: 'pending',
    },
    notes: String,
    disputeReason: String,
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    moduleSource: { type: String, default: 'workforce', immutable: true },
    externalRefs: [{ module: String, entityType: String, entityId: String, linkedAt: { type: Date, default: Date.now }, _id: false }],
  },
  { timestamps: true }
);

TimesheetSchema.index({ tenantId: 1, shiftDate: -1 });
TimesheetSchema.index({ tenantId: 1, workerId: 1 });
TimesheetSchema.index({ tenantId: 1, status: 1 });
TimesheetSchema.index({ tenantId: 1, shiftId: 1, workerId: 1 }, { unique: true });

export const Timesheet = model<ITimesheet>('Timesheet', TimesheetSchema);

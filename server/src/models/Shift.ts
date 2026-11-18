import { Schema, model, Document, Types } from 'mongoose';

export type ShiftStatus = 'draft' | 'published' | 'completed' | 'cancelled';
export type WorkerAssignmentStatus = 'assigned' | 'confirmed' | 'completed' | 'no_show';

export interface ICheckInLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface IWorkerAssignment {
  workerId: Types.ObjectId;
  workerName: string;
  status: WorkerAssignmentStatus;
  completedAt?: Date;
  checkInTime?: Date;
  checkInLocation?: ICheckInLocation;
  checkOutTime?: Date;
}

export interface IShift extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  businessId: Types.ObjectId;
  businessName: string;
  locationId?: Types.ObjectId;
  locationName?: string;
  title: string;
  startTime: Date;
  endTime: Date;
  breakMinutes: number;
  requiredWorkers: number;
  assignedWorkers: IWorkerAssignment[];
  payRatePerHour: number;
  billingRatePerHour?: number;
  status: ShiftStatus;
  notes?: string;
  completedAt?: Date;
  isInstantBooking: boolean;
  moduleSource: 'workforce';
  externalRefs: Array<{ module: string; entityType: string; entityId: string; linkedAt: Date }>;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerAssignmentSchema = new Schema<IWorkerAssignment>(
  {
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: { type: String, required: true },
    status: {
      type: String,
      enum: ['assigned', 'confirmed', 'completed', 'no_show'],
      default: 'assigned',
    },
    completedAt: Date,
    checkInTime: Date,
    checkInLocation: {
      lat: Number,
      lng: Number,
      accuracy: Number,
    },
    checkOutTime: Date,
  },
  { _id: false }
);

const ShiftSchema = new Schema<IShift>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    businessName: { type: String, required: true },
    locationId: { type: Schema.Types.ObjectId },
    locationName: String,
    title: { type: String, required: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    breakMinutes: { type: Number, default: 0 },
    requiredWorkers: { type: Number, default: 1, min: 1 },
    assignedWorkers: [WorkerAssignmentSchema],
    payRatePerHour: { type: Number, required: true, min: 0 },
    billingRatePerHour: Number,
    status: {
      type: String,
      enum: ['draft', 'published', 'completed', 'cancelled'],
      default: 'draft',
    },
    notes: String,
    completedAt: Date,
    isInstantBooking: { type: Boolean, default: false },
    moduleSource: { type: String, default: 'workforce', immutable: true },
    externalRefs: [{ module: String, entityType: String, entityId: String, linkedAt: { type: Date, default: Date.now }, _id: false }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

ShiftSchema.index({ tenantId: 1, startTime: -1 });
ShiftSchema.index({ tenantId: 1, businessId: 1 });
ShiftSchema.index({ tenantId: 1, 'assignedWorkers.workerId': 1 });

export const Shift = model<IShift>('Shift', ShiftSchema);

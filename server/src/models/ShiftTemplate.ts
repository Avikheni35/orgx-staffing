import { Schema, model, Types, Document } from 'mongoose';

export interface IShiftTemplate extends Document {
  tenantId: Types.ObjectId;
  name: string;
  businessId: Types.ObjectId;
  businessName: string;
  locationId?: Types.ObjectId;
  locationName?: string;
  title: string;
  startHour: number;
  startMinute: number;
  durationHours: number;
  breakMinutes: number;
  requiredWorkers: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  notes?: string;
  createdBy: Types.ObjectId;
}

const schema = new Schema<IShiftTemplate>(
  {
    tenantId:           { type: Schema.Types.ObjectId, required: true, index: true },
    name:               { type: String, required: true, trim: true },
    businessId:         { type: Schema.Types.ObjectId, required: true },
    businessName:       { type: String, required: true },
    locationId:         { type: Schema.Types.ObjectId },
    locationName:       { type: String },
    title:              { type: String, required: true, trim: true },
    startHour:          { type: Number, required: true, min: 0, max: 23 },
    startMinute:        { type: Number, default: 0, min: 0, max: 59 },
    durationHours:      { type: Number, required: true, min: 0.5 },
    breakMinutes:       { type: Number, default: 0 },
    requiredWorkers:    { type: Number, default: 1 },
    payRatePerHour:     { type: Number, required: true },
    billingRatePerHour: { type: Number },
    notes:              { type: String },
    createdBy:          { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true, collection: 'm1_shift_templates' }
);

export const ShiftTemplate = model<IShiftTemplate>('ShiftTemplate', schema);

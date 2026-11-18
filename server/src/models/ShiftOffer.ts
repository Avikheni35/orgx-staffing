import { Schema, model, Document, Types } from 'mongoose';

export type ShiftOfferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface IShiftOffer extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  shiftId: Types.ObjectId;
  workerId: Types.ObjectId;
  workerName: string;
  sentBy: Types.ObjectId;
  status: ShiftOfferStatus;
  message?: string;
  responseNote?: string;
  expiresAt: Date;
  respondedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftOfferSchema = new Schema<IShiftOffer>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    shiftId:      { type: Schema.Types.ObjectId, ref: 'Shift',  required: true },
    workerId:     { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName:   { type: String, required: true },
    sentBy:       { type: Schema.Types.ObjectId, ref: 'User',   required: true },
    status:       { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled', 'expired'], default: 'pending' },
    message:      String,
    responseNote: String,
    expiresAt:    { type: Date, required: true },
    respondedAt:  Date,
  },
  { timestamps: true }
);

// One pending offer per worker per shift at a time
ShiftOfferSchema.index({ shiftId: 1, workerId: 1 }, { unique: true });
ShiftOfferSchema.index({ tenantId: 1, workerId: 1, status: 1 });
ShiftOfferSchema.index({ tenantId: 1, shiftId: 1 });
ShiftOfferSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL — auto-expire docs

export const ShiftOffer = model<IShiftOffer>('ShiftOffer', ShiftOfferSchema);

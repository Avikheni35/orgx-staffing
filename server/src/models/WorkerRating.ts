import { Schema, model, Document, Types } from 'mongoose';

export interface IWorkerRating extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  shiftId: Types.ObjectId;
  workerId: Types.ObjectId;
  businessId: Types.ObjectId;
  ratedBy: Types.ObjectId;
  overallRating: number;
  punctuality?: number;
  quality?: number;
  attitude?: number;
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerRatingSchema = new Schema<IWorkerRating>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    businessId: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    ratedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    overallRating: { type: Number, required: true, min: 1, max: 5 },
    punctuality: { type: Number, min: 1, max: 5 },
    quality: { type: Number, min: 1, max: 5 },
    attitude: { type: Number, min: 1, max: 5 },
    comment: String,
  },
  { timestamps: true }
);

WorkerRatingSchema.index({ tenantId: 1, shiftId: 1, workerId: 1 }, { unique: true });
WorkerRatingSchema.index({ tenantId: 1, workerId: 1 });

export const WorkerRating = model<IWorkerRating>('WorkerRating', WorkerRatingSchema);

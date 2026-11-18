import mongoose, { Document, Schema } from 'mongoose';

export interface IOutboxEvent extends Document {
  tenantId: mongoose.Types.ObjectId;
  type: string;
  targetModule: 'm2' | 'm3';
  targetPath: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'delivered' | 'failed';
  attempts: number;
  lastAttemptAt?: Date;
  createdAt: Date;
}

const schema = new Schema<IOutboxEvent>({
  tenantId:      { type: Schema.Types.ObjectId, required: true, index: true },
  type:          { type: String, required: true },
  targetModule:  { type: String, required: true, enum: ['m2', 'm3'] },
  targetPath:    { type: String, required: true },
  payload:       { type: Schema.Types.Mixed, required: true },
  status:        { type: String, enum: ['pending', 'delivered', 'failed'], default: 'pending', index: true },
  attempts:      { type: Number, default: 0 },
  lastAttemptAt: Date,
  createdAt:     { type: Date, default: Date.now, index: { expireAfterSeconds: 30 * 24 * 3600 } },
});

export const OutboxEvent = mongoose.model<IOutboxEvent>('OutboxEvent', schema, 'm1_outbox_events');

import { Schema, model, Document, Types } from 'mongoose';

export type M1Module = 'workforce' | 'event' | 'erp' | 'inventory';

export interface IIntegrationEvent extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  sourceModule: M1Module;
  eventType: string;      // e.g. 'worker.created', 'shift.completed'
  entityType: string;     // e.g. 'Worker', 'Shift', 'Invoice'
  entityId: Types.ObjectId;
  payload: Record<string, unknown>;
  consumedBy: string[];   // module names that have consumed this event
  createdAt: Date;
}

const IntegrationEventSchema = new Schema<IIntegrationEvent>(
  {
    tenantId:     { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    sourceModule: { type: String, required: true },
    eventType:    { type: String, required: true },
    entityType:   { type: String, required: true },
    entityId:     { type: Schema.Types.ObjectId, required: true },
    payload:      { type: Schema.Types.Mixed, default: {} },
    consumedBy:   [{ type: String }],
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

IntegrationEventSchema.index({ tenantId: 1, sourceModule: 1, eventType: 1, createdAt: -1 });
IntegrationEventSchema.index({ tenantId: 1, entityType: 1, entityId: 1 });
// 30-day auto-expiry
IntegrationEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const IntegrationEvent = model<IIntegrationEvent>('IntegrationEvent', IntegrationEventSchema);

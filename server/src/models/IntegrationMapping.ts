import { Schema, model, Document, Types } from 'mongoose';
import { M1Module } from './IntegrationEvent';

export interface IIntegrationMapping extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;

  sourceModule: M1Module;
  sourceEntityType: string;   // e.g. 'Worker'
  sourceEntityId: Types.ObjectId;

  targetModule: M1Module;
  targetEntityType: string;   // e.g. 'StaffProfile' (M2), 'Employee' (M3), 'Customer' (M3)
  targetEntityId: Types.ObjectId | null; // null while pending

  snapshot: Record<string, unknown>; // denormalized key fields from source at link time
  snapshotAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

const IntegrationMappingSchema = new Schema<IIntegrationMapping>(
  {
    tenantId:          { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    sourceModule:      { type: String, required: true },
    sourceEntityType:  { type: String, required: true },
    sourceEntityId:    { type: Schema.Types.ObjectId, required: true },
    targetModule:      { type: String, required: true },
    targetEntityType:  { type: String, required: true },
    targetEntityId:    { type: Schema.Types.ObjectId, default: null },
    snapshot:          { type: Schema.Types.Mixed, default: {} },
    snapshotAt:        { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// One mapping per source entity ↔ target module+type pair
IntegrationMappingSchema.index(
  { tenantId: 1, sourceModule: 1, sourceEntityType: 1, sourceEntityId: 1, targetModule: 1, targetEntityType: 1 },
  { unique: true }
);
IntegrationMappingSchema.index({ tenantId: 1, targetModule: 1, targetEntityId: 1 });

export const IntegrationMapping = model<IIntegrationMapping>('IntegrationMapping', IntegrationMappingSchema);

import { Schema, model, Document, Types } from 'mongoose';

export type AuditAction =
  | 'worker.status_changed'
  | 'worker.created'
  | 'worker.deleted'
  | 'worker.aueg_override'
  | 'worker.document_added'
  | 'worker.document_deleted'
  | 'worker.document_verified'
  | 'worker.document_remarked'
  | 'shift.published'
  | 'shift.cancelled'
  | 'assignment.created'
  | 'invoice.status_changed'
  | 'invoice.created'
  | 'timesheet.approved'
  | 'timesheet.disputed'
  | 'staff.invited'
  | 'staff.status_changed'
  | 'staff.removed'
  | 'portal_access.granted'
  | 'portal_access.revoked'
  | 'settings.agency_updated'
  | 'settings.features_m1_updated'
  | 'settings.features_m2_updated'
  | 'tenant.status_changed'
  | 'billing.plan_changed'
  | 'billing.subscription_cancelled'
  | 'billing.subscription_reactivated'
  | 'worker.approved'
  | 'worker.rejected'
  | 'worker.availability_updated'
  | 'credit_note.created'
  | 'credit_note.issued'
  | 'settings.integration_token_regenerated'
  | 'worker.dsgvo_export'
  | 'worker.dsgvo_anonymized'
  | 'worker.sensitive_data_updated'
  | 'worker.payslip_downloaded'
  | 'tenant.impersonated';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  actorId: Types.ObjectId;
  actorName: string;
  actorRole: string;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
  ip?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String, required: true },
    actorRole: { type: String, required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: String,
    targetName: String,
    details: { type: Schema.Types.Mixed },
    ip: String,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Audit logs are never updated — immutable
    versionKey: false,
  }
);

// TTL: auto-delete after 10 years (DSGVO / HGB §257 retention)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 10 * 365 * 24 * 60 * 60 });
auditLogSchema.index({ tenantId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1 });

export const AuditLog = model<IAuditLog>('AuditLog', auditLogSchema);

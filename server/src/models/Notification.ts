import mongoose, { Document, Schema, Types } from 'mongoose';

export type NotificationType =
  | 'shift_application'
  | 'timesheet_dispute'
  | 'timesheet_approved'
  | 'contract_signed'
  | 'worker_registered'
  | 'aueg_warning'
  | 'aueg_block'
  | 'shift_offer'
  | 'shift_request'
  | 'billing';

export interface INotification extends Document {
  tenantId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, index: true },
    recipientUserId: { type: Schema.Types.ObjectId, required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String },
    readAt: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

NotificationSchema.index({ tenantId: 1, recipientUserId: 1, createdAt: -1 });

// Auto-delete after 90 days
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

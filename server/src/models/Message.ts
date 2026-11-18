import { Schema, model, Document, Types } from 'mongoose';

export type MessageSenderRole = 'agency' | 'worker';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  workerId: Types.ObjectId;
  workerName: string;
  senderRole: MessageSenderRole;
  senderId: string;
  senderName: string;
  body: string;
  readAt?: Date;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    workerId: { type: Schema.Types.ObjectId, ref: 'Worker', required: true },
    workerName: { type: String, required: true },
    senderRole: { type: String, enum: ['agency', 'worker'], required: true },
    senderId: { type: String, required: true },
    senderName: { type: String, required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    readAt: Date,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

MessageSchema.index({ tenantId: 1, workerId: 1, createdAt: 1 });
MessageSchema.index({ tenantId: 1, createdAt: -1 });

export const Message = model<IMessage>('Message', MessageSchema);

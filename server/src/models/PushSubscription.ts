import { Schema, model, Document, Types } from 'mongoose';

export interface IPushSubscription extends Document {
  userId:   Types.ObjectId;
  tenantId: Types.ObjectId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth:   string;
  };
  createdAt: Date;
}

const PushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    userId:   { type: Schema.Types.ObjectId, required: true },
    tenantId: { type: Schema.Types.ObjectId, required: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth:   { type: String, required: true },
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: 'm1_push_subscriptions' }
);

PushSubscriptionSchema.index({ userId: 1 });
PushSubscriptionSchema.index({ endpoint: 1 }, { unique: true });

export const PushSubscription = model<IPushSubscription>('PushSubscription', PushSubscriptionSchema);

import mongoose, { Document, Schema } from 'mongoose';
import { randomBytes } from 'crypto';

interface ServiceConnection {
  url: string;
  token: string;
  enabled: boolean;
  lastPingAt?: Date;
  lastPingOk?: boolean;
}

export interface IIntegrationSettings extends Document {
  tenantId: mongoose.Types.ObjectId;
  ownServiceToken: string;
  connectedServices: {
    m2?: ServiceConnection;
    m3?: ServiceConnection;
  };
}

const connectionSchema = new Schema<ServiceConnection>(
  {
    url:        { type: String, required: true },
    token:      { type: String, required: true },
    enabled:    { type: Boolean, default: true },
    lastPingAt: Date,
    lastPingOk: Boolean,
  },
  { _id: false }
);

const schema = new Schema<IIntegrationSettings>(
  {
    tenantId: { type: Schema.Types.ObjectId, required: true, unique: true },
    ownServiceToken: {
      type: String,
      required: true,
      unique: true,
      default: () => 'sk_m1_' + randomBytes(24).toString('hex'),
    },
    connectedServices: {
      m2: connectionSchema,
      m3: connectionSchema,
    },
  },
  { timestamps: true, collection: 'm1_integration_settings' }
);

export const IntegrationSettings = mongoose.model<IIntegrationSettings>(
  'IntegrationSettings',
  schema
);

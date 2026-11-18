import { Schema, model, Document, Types } from 'mongoose';

export interface IBusinessContact {
  _id: Types.ObjectId;
  firstName: string;
  lastName: string;
  role?: string;
  email: string;
  phone?: string;
  hasPortalAccess: boolean;
  userId?: Types.ObjectId;
}

export interface IBusinessLocation {
  _id: Types.ObjectId;
  name: string;
  street: string;
  city: string;
  postalCode: string;
  country: string;
  notes?: string;
}

export interface IBusiness extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  industry?: string;
  vatNumber?: string;
  hrbNumber?: string;
  address: {
    street?: string;
    city?: string;
    postalCode?: string;
    country: string;
  };
  billingAddress?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country: string;
  };
  defaultBillingRatePerHour?: number;
  contacts: IBusinessContact[];
  locations: IBusinessLocation[];
  notes?: string;
  status: 'active' | 'inactive';
  moduleSource: 'workforce';
  externalRefs: Array<{ module: string; entityType: string; entityId: string; linkedAt: Date }>;

  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    name: { type: String, required: true, trim: true },
    industry: String,
    vatNumber: String,
    hrbNumber: String,
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'DE' },
    },
    billingAddress: {
      street: String,
      city: String,
      postalCode: String,
      country: String,
    },
    defaultBillingRatePerHour: Number,
    contacts: [
      {
        firstName: { type: String, required: true },
        lastName: { type: String, required: true },
        role: String,
        email: { type: String, lowercase: true },
        phone: String,
        hasPortalAccess: { type: Boolean, default: false },
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    locations: [
      {
        name: { type: String, required: true },
        street: String,
        city: String,
        postalCode: String,
        country: { type: String, default: 'DE' },
        notes: String,
      },
    ],
    notes: String,
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    moduleSource: { type: String, default: 'workforce', immutable: true },
    externalRefs: [{ module: String, entityType: String, entityId: String, linkedAt: { type: Date, default: Date.now }, _id: false }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

BusinessSchema.index({ tenantId: 1, status: 1 });
BusinessSchema.index({ tenantId: 1, name: 1 });

export const Business = model<IBusiness>('Business', BusinessSchema);

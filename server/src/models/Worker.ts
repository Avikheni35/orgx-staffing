import { Schema, model, Document, Types } from 'mongoose';

export type WorkerStatus = 'pending_review' | 'active' | 'inactive' | 'suspended' | 'blacklisted' | 'anonymized';
export type LanguageLevel = 'basic' | 'conversational' | 'fluent' | 'native';
export type DocumentCategory =
  | 'identity'
  | 'work_permit'
  | 'health_certificate'
  | 'contract'
  | 'other';

export interface IWorkerDocument {
  _id: Types.ObjectId;
  category: DocumentCategory;
  label: string;
  fileUrl: string;
  expiryDate?: Date;
  verified: boolean;
  uploadedAt: Date;
  remark?: string;
  remarkAt?: Date;
}

export interface IAuegEntry {
  businessId: Types.ObjectId;
  businessName: string;
  startDate: Date;
  monthsWorked: number;
  lastAssignmentDate?: Date;
}

export interface IExternalRef {
  module: 'event' | 'erp' | 'inventory';
  entityType: string;
  entityId: string;
  linkedAt: Date;
}

export interface IWorker extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  userId?: Types.ObjectId;

  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  gender?: 'male' | 'female' | 'diverse' | 'not_specified';
  nationality?: string;
  address: {
    street?: string;
    city?: string;
    postalCode?: string;
    country: string;
  };
  phone?: string;
  email: string;

  // Tax / social — stored encrypted in production
  steuerklasse?: string;
  steuernummerEncrypted?: string;
  sozialversicherungsnummerEncrypted?: string;
  healthInsuranceProvider?: string;

  // Bank — stored encrypted
  ibanEncrypted?: string;
  bankName?: string;

  skills: string[];
  languages: Array<{ language: string; level: LanguageLevel }>;

  status: WorkerStatus;
  statusNote?: string;

  documents: IWorkerDocument[];

  availability: {
    weeklyPattern: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
    exceptions: Array<{ date: Date; available: boolean; note?: string }>;
    preferredRadiusKm?: number;
  };

  auegTracking: IAuegEntry[];

  rating: { average: number; count: number };
  totalHoursWorked: number;

  registrationSource: 'manual' | 'self_registration';
  dsgvoConsentAt?: Date;
  dsgvoConsentIp?: string;

  moduleSource: 'workforce';
  externalRefs: IExternalRef[];
  // Cross-module link: set when this worker also has an M2 StaffProfile (same tenant)
  staffProfileId?: Types.ObjectId;

  createdBy?: Types.ObjectId;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkerSchema = new Schema<IWorker>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'diverse', 'not_specified'] },
    nationality: String,
    address: {
      street: String,
      city: String,
      postalCode: String,
      country: { type: String, default: 'DE' },
    },
    phone: String,
    email: { type: String, required: true, lowercase: true, trim: true },

    steuerklasse: String,
    steuernummerEncrypted: String,
    sozialversicherungsnummerEncrypted: String,
    healthInsuranceProvider: String,

    ibanEncrypted: String,
    bankName: String,

    skills: [{ type: String, trim: true }],
    languages: [
      {
        language: { type: String, required: true },
        level: {
          type: String,
          enum: ['basic', 'conversational', 'fluent', 'native'],
          default: 'conversational',
        },
      },
    ],

    status: {
      type: String,
      enum: ['pending_review', 'active', 'inactive', 'suspended', 'blacklisted', 'anonymized'],
      default: 'pending_review',
    },
    statusNote: String,

    documents: [
      {
        category: {
          type: String,
          enum: ['identity', 'work_permit', 'health_certificate', 'contract', 'other'],
        },
        label: String,
        fileUrl: String,
        expiryDate: Date,
        verified: { type: Boolean, default: false },
        uploadedAt: { type: Date, default: Date.now },
        remark: String,
        remarkAt: Date,
      },
    ],

    availability: {
      weeklyPattern: {
        monday: { type: Boolean, default: true },
        tuesday: { type: Boolean, default: true },
        wednesday: { type: Boolean, default: true },
        thursday: { type: Boolean, default: true },
        friday: { type: Boolean, default: true },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false },
      },
      exceptions: [
        {
          date: Date,
          available: Boolean,
          note: String,
        },
      ],
      preferredRadiusKm: Number,
    },

    auegTracking: [
      {
        businessId: { type: Schema.Types.ObjectId, ref: 'Business' },
        businessName: String,
        startDate: Date,
        monthsWorked: { type: Number, default: 0 },
        lastAssignmentDate: Date,
      },
    ],

    rating: {
      average: { type: Number, default: 0 },
      count: { type: Number, default: 0 },
    },
    totalHoursWorked: { type: Number, default: 0 },

    registrationSource: {
      type: String,
      enum: ['manual', 'self_registration'],
      default: 'manual',
    },
    dsgvoConsentAt: Date,
    dsgvoConsentIp: String,
    moduleSource: { type: String, default: 'workforce', immutable: true },
    externalRefs: [
      {
        module:     { type: String, required: true },
        entityType: { type: String, required: true },
        entityId:   { type: String, required: true },
        linkedAt:   { type: Date, default: Date.now },
        _id: false,
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    staffProfileId: { type: Schema.Types.ObjectId },
    deletedAt: Date,
  },
  { timestamps: true }
);

WorkerSchema.index({ tenantId: 1, status: 1 });
WorkerSchema.index({ tenantId: 1, email: 1 }, { unique: true });
WorkerSchema.index({ tenantId: 1, lastName: 1, firstName: 1 });

export const Worker = model<IWorker>('Worker', WorkerSchema);

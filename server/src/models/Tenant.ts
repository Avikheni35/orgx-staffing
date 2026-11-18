import { Schema, model, Document, Types } from 'mongoose';

export interface ITenant extends Document {
  _id: Types.ObjectId;
  name: string;
  subdomain: string;
  loginCode: string;
  status: 'trial' | 'active' | 'suspended';
  plan: 'starter' | 'growth' | 'pro' | 'enterprise';
  branding: {
    logoUrl?: string;
    primaryColor: string;
  };
  companyDetails: {
    address?: string;
    hrbNumber?: string;
    auegLicenseNumber?: string;
    vatId?: string;
    ibanEncrypted?: string;
  };
  invoiceSettings: {
    prefix: string;
    currentNumber: number;
    vatRate: number;
    paymentTermsDays: number;
  };
  complianceSettings: {
    auegWarnMonths: number;
    auegBlockMonths: number;
    minRestHoursBetweenShifts: number;
    mindestlohnOverride?: number;
  };
  securitySettings: {
    require2FA: boolean;
  };
  planLimits: {
    maxWorkers: number;
    maxDisponents: number;
  };
  featureFlags?: {
    // Worker / Onboarding
    workerSelfRegistration: boolean;
    requireDocumentUpload: boolean;
    enableMagicLink: boolean;
    enableJobApplicationForm: boolean;
    // Attendance
    attendanceMethod: 'manual' | 'qr' | 'gps' | 'nfc';
    overtimeThresholdHours: number;
    timesheetApprovalRequired: boolean;
    // Compliance
    contractAutoVoidOverlap: boolean;
    // Invoice / Finance
    autoInvoiceOnApproval: boolean;
    datevExportEnabled: boolean;
    // Portal / Features
    enableClientPortal: boolean;
    enableWorkerRatings: boolean;
    smsNotifications: boolean;
    sessionTimeoutMinutes: number | null;
  };
  // M2-specific feature flags (stored on same tenant doc, strict: false in M2)
  m2FeatureFlags?: {
    publicApplicationFlow: boolean;
    autoAssignOnAvailability: boolean;
    autoApproveTimesheets: boolean;
    requireCheckinPhoto: boolean;
    disputeWindowDays: number;
    invoicingEnabled: boolean;
    paymentGateway: 'none' | 'stripe' | 'sepa';
    defaultEventVisibility: 'private' | 'public';
    eventClientPortal: boolean;
    staffRatingEnabled: boolean;
  };
  // Modules this tenant has subscribed to. Absence = all enabled (backward compat).
  enabledModules?: ('m1' | 'm2' | 'm3')[];
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeSubscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid';
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialEndsAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    subdomain: { type: String, required: true, unique: true, lowercase: true, trim: true },
    loginCode: { type: String, required: true, unique: true, lowercase: true, trim: true },
    status: { type: String, enum: ['trial', 'active', 'suspended'], default: 'trial' },
    plan: { type: String, enum: ['starter', 'growth', 'pro', 'enterprise'], default: 'starter' },
    branding: {
      logoUrl: String,
      primaryColor: { type: String, default: '#1976d2' },
    },
    companyDetails: {
      address: String,
      hrbNumber: String,
      auegLicenseNumber: String,
      vatId: String,
      ibanEncrypted: String,
    },
    invoiceSettings: {
      prefix: { type: String, default: 'RE' },
      currentNumber: { type: Number, default: 1000 },
      vatRate: { type: Number, default: 19 },
      paymentTermsDays: { type: Number, default: 14 },
    },
    complianceSettings: {
      auegWarnMonths: { type: Number, default: 9 },
      auegBlockMonths: { type: Number, default: 18 },
      minRestHoursBetweenShifts: { type: Number, default: 11 },
      mindestlohnOverride: Number,
    },
    planLimits: {
      maxWorkers: { type: Number, default: 50 },
      maxDisponents: { type: Number, default: 3 },
    },
    securitySettings: {
      require2FA: { type: Boolean, default: true },
    },
    featureFlags: {
      workerSelfRegistration:   { type: Boolean, default: false },
      requireDocumentUpload:    { type: Boolean, default: false },
      enableMagicLink:          { type: Boolean, default: true  },
      enableJobApplicationForm: { type: Boolean, default: false },
      attendanceMethod:         { type: String, enum: ['manual','qr','gps','nfc'], default: 'manual' },
      overtimeThresholdHours:   { type: Number, default: 8 },
      timesheetApprovalRequired:{ type: Boolean, default: true  },
      contractAutoVoidOverlap:  { type: Boolean, default: true  },
      autoInvoiceOnApproval:    { type: Boolean, default: false },
      datevExportEnabled:       { type: Boolean, default: false },
      enableClientPortal:       { type: Boolean, default: true  },
      enableWorkerRatings:      { type: Boolean, default: false },
      smsNotifications:         { type: Boolean, default: false },
      sessionTimeoutMinutes:    { type: Number,  default: null  },
    },
    m2FeatureFlags: {
      publicApplicationFlow:       { type: Boolean, default: false },
      autoAssignOnAvailability:    { type: Boolean, default: false },
      autoApproveTimesheets:       { type: Boolean, default: false },
      requireCheckinPhoto:         { type: Boolean, default: false },
      disputeWindowDays:           { type: Number,  default: 7   },
      invoicingEnabled:            { type: Boolean, default: true  },
      paymentGateway:              { type: String, enum: ['none','stripe','sepa'], default: 'none' },
      defaultEventVisibility:      { type: String, enum: ['private','public'], default: 'private' },
      eventClientPortal:           { type: Boolean, default: true  },
      staffRatingEnabled:          { type: Boolean, default: true  },
    },
    enabledModules: [{ type: String, enum: ['m1', 'm2', 'm3'] }],
    stripeCustomerId: { type: String, index: true },
    stripeSubscriptionId: String,
    stripeSubscriptionStatus: {
      type: String,
      enum: ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'unpaid'],
    },
    currentPeriodEnd: Date,
    cancelAtPeriodEnd: { type: Boolean, default: false },
    trialEndsAt: Date,
  },
  { timestamps: true }
);


export const Tenant = model<ITenant>('Tenant', TenantSchema);

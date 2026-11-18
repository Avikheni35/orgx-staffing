import { Schema, model, Document, Types } from 'mongoose';
import type { UserRole } from '../types';

export interface IModuleRole {
  module: 'm1' | 'm2';
  role: string;
  profileId: Types.ObjectId;
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  role: UserRole;
  moduleRoles: IModuleRole[];
  email: string;
  passwordHash?: string;
  firstName: string;
  lastName: string;
  phone?: string;
  status: 'active' | 'inactive' | 'suspended';
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  twoFactorSecret?: string;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  emailOtpHash?: string;
  emailOtpExpires?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  magicLinkTokenHash?: string;
  magicLinkExpires?: Date;
  inviteTokenHash?: string;
  inviteExpires?: Date;
  refreshTokenHashes: string[];
  lastLoginAt?: Date;
  language: 'de' | 'en';
  notificationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', default: null },
    role: {
      type: String,
      enum: ['super_admin', 'agency_admin', 'disponent', 'worker', 'business_contact'],
      required: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true },
    passwordHash: String,
    firstName: { type: String, required: false, default: '', trim: true },
    lastName: { type: String, required: false, default: '', trim: true },
    phone: String,
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    emailVerified: { type: Boolean, default: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: String,
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    emailOtpHash: String,
    emailOtpExpires: Date,
    passwordResetTokenHash: String,
    passwordResetExpires: Date,
    magicLinkTokenHash: String,
    magicLinkExpires: Date,
    inviteTokenHash: String,
    inviteExpires: Date,
    moduleRoles: [
      {
        module:    { type: String, enum: ['m1', 'm2'], required: true },
        role:      { type: String, required: true },
        profileId: { type: Schema.Types.ObjectId, required: true },
      },
    ],
    refreshTokenHashes: [{ type: String }],
    lastLoginAt: Date,
    language: { type: String, enum: ['de', 'en'], default: 'de' },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

// Email unique per tenant (null tenantId = super admin, globally unique)
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

export const User = model<IUser>('User', UserSchema);

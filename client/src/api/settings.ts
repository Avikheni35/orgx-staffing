import apiClient from './client';

export interface AgencySettings {
  _id: string;
  name: string;
  subdomain: string;
  loginCode: string;
  status: string;
  plan: string;
  branding: { primaryColor: string; logoUrl?: string };
  companyDetails: {
    address?: string;
    hrbNumber?: string;
    auegLicenseNumber?: string;
    vatId?: string;
    iban?: string;
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
  planLimits: { maxWorkers: number; maxDisponents: number };
  securitySettings?: { require2FA: boolean };
  trialEndsAt?: string;
}

export interface UpdateAgencySettings {
  name?: string;
  branding?: { primaryColor?: string };
  companyDetails?: {
    address?: string;
    hrbNumber?: string;
    auegLicenseNumber?: string;
    vatId?: string;
    iban?: string;
  };
  invoiceSettings?: {
    prefix?: string;
    vatRate?: number;
    paymentTermsDays?: number;
  };
  complianceSettings?: {
    auegWarnMonths?: number;
    auegBlockMonths?: number;
    minRestHoursBetweenShifts?: number;
    mindestlohnOverride?: number | null;
  };
  securitySettings?: {
    require2FA?: boolean;
  };
}

export interface M1FeatureFlags {
  workerSelfRegistration: boolean;
  requireDocumentUpload: boolean;
  enableMagicLink: boolean;
  enableJobApplicationForm: boolean;
  attendanceMethod: 'manual' | 'qr' | 'gps' | 'nfc';
  overtimeThresholdHours: number;
  timesheetApprovalRequired: boolean;
  contractAutoVoidOverlap: boolean;
  autoInvoiceOnApproval: boolean;
  datevExportEnabled: boolean;
  enableClientPortal: boolean;
  enableWorkerRatings: boolean;
  smsNotifications: boolean;
  sessionTimeoutMinutes: number | null;
}

export interface M2FeatureFlags {
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
}

export interface StaffProfile {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  phone?: string;
  language: 'de' | 'en';
  notificationPreferences: { email: boolean; sms: boolean; push: boolean };
  lastLoginAt?: string;
  createdAt: string;
}

export interface UpdateStaffProfile {
  firstName?: string;
  lastName?: string;
  phone?: string;
  language?: 'de' | 'en';
  notificationPreferences?: { email?: boolean; sms?: boolean; push?: boolean };
}

export const settingsApi = {
  getAgency: () => apiClient.get<AgencySettings>('/settings/agency').then((r) => r.data),
  updateAgency: (data: UpdateAgencySettings) =>
    apiClient.patch<AgencySettings>('/settings/agency', data).then((r) => r.data),

  getM1Features: () => apiClient.get<M1FeatureFlags>('/settings/features/m1').then((r) => r.data),
  updateM1Features: (data: Partial<M1FeatureFlags>) =>
    apiClient.patch<M1FeatureFlags>('/settings/features/m1', data).then((r) => r.data),

  getM2Features: () => apiClient.get<M2FeatureFlags>('/settings/features/m2').then((r) => r.data),
  updateM2Features: (data: Partial<M2FeatureFlags>) =>
    apiClient.patch<M2FeatureFlags>('/settings/features/m2', data).then((r) => r.data),

  getProfile: () => apiClient.get<StaffProfile>('/settings/profile').then((r) => r.data),
  updateProfile: (data: UpdateStaffProfile) =>
    apiClient.patch<StaffProfile>('/settings/profile', data).then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post('/settings/profile/change-password', { currentPassword, newPassword }).then((r) => r.data),
};

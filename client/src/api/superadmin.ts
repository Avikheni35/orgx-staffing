import apiClient from './client';

export type TenantStatus = 'trial' | 'active' | 'suspended';
export type TenantPlan = 'starter' | 'growth' | 'pro' | 'enterprise';
export type TenantModule = 'm1' | 'm2' | 'm3';

export interface TenantStats {
  userCount: number;
  workerCount: number;
  activeWorkers: number;
}

export interface Tenant {
  _id: string;
  name: string;
  subdomain: string;
  loginCode: string;
  status: TenantStatus;
  plan: TenantPlan;
  trialEndsAt?: string;
  companyDetails: {
    address?: string;
    hrbNumber?: string;
    auegLicenseNumber?: string;
    vatId?: string;
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
  planLimits: {
    maxWorkers: number;
    maxDisponents: number;
  };
  enabledModules?: TenantModule[];
  createdAt: string;
  _stats?: TenantStats;
}

export interface TenantUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt?: string;
  createdAt: string;
}

export interface TenantDetail {
  tenant: Tenant;
  users: TenantUser[];
  workerByStatus: Record<string, number>;
}

export interface CreateTenantData {
  name: string;
  subdomain: string;
  loginCode: string;
  plan?: TenantPlan;
  module: TenantModule;
  adminFirstName: string;
  adminLastName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface UpdateTenantData {
  name?: string;
  status?: TenantStatus;
  plan?: TenantPlan;
  trialEndsAt?: string;
  companyDetails?: Partial<Tenant['companyDetails']>;
  invoiceSettings?: Partial<Tenant['invoiceSettings']>;
  complianceSettings?: Partial<Tenant['complianceSettings']>;
  planLimits?: Partial<Tenant['planLimits']>;
  enabledModules?: TenantModule[];
}

export interface ImpersonateResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string | null;
    language: string;
  };
  tenantName: string;
}

export const superadminApi = {
  listTenants: () =>
    apiClient.get<Tenant[]>('/superadmin/tenants').then((r) => r.data),

  getTenant: (id: string) =>
    apiClient.get<TenantDetail>(`/superadmin/tenants/${id}`).then((r) => r.data),

  createTenant: (data: CreateTenantData) =>
    apiClient.post<{ tenant: Tenant; adminUser: { _id: string; email: string } }>('/superadmin/tenants', data).then((r) => r.data),

  updateTenant: (id: string, data: UpdateTenantData) =>
    apiClient.patch<Tenant>(`/superadmin/tenants/${id}`, data).then((r) => r.data),

  impersonate: (tenantId: string, userId: string) =>
    apiClient.post<ImpersonateResponse>(`/superadmin/tenants/${tenantId}/impersonate`, { userId }).then((r) => r.data),
};

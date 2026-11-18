import apiClient from './client';

export interface ShiftTemplate {
  _id: string;
  tenantId: string;
  name: string;
  businessId: string;
  businessName: string;
  locationId?: string;
  locationName?: string;
  title: string;
  startHour: number;
  startMinute: number;
  durationHours: number;
  breakMinutes: number;
  requiredWorkers: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  notes?: string;
  createdAt: string;
}

export interface CreateTemplateData {
  name: string;
  businessId: string;
  locationId?: string;
  title: string;
  startHour: number;
  startMinute?: number;
  durationHours: number;
  breakMinutes?: number;
  requiredWorkers?: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  notes?: string;
}

export const shiftTemplatesApi = {
  list: () =>
    apiClient.get<{ templates: ShiftTemplate[] }>('/shift-templates').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ShiftTemplate>(`/shift-templates/${id}`).then((r) => r.data),

  create: (data: CreateTemplateData) =>
    apiClient.post<ShiftTemplate>('/shift-templates', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateTemplateData>) =>
    apiClient.put<ShiftTemplate>(`/shift-templates/${id}`, data).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete<{ ok: boolean }>(`/shift-templates/${id}`).then((r) => r.data),

  use: (id: string, startDate: string) =>
    apiClient.post(`/shift-templates/${id}/use`, { startDate }).then((r) => r.data),
};

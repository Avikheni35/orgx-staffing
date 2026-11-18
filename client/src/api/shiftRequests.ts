import apiClient from './client';

export interface ShiftRequest {
  _id: string;
  tenantId: string;
  businessId: string | { _id: string; name: string };
  locationId?: string;
  requestedBy: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  workersNeeded: number;
  qualifications?: string[];
  status: 'pending' | 'accepted' | 'declined' | 'fulfilled';
  agencyNote?: string;
  linkedShiftId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftRequestData {
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  workersNeeded: number;
  qualifications?: string[];
  locationId?: string;
}

export const shiftRequestsApi = {
  list: (params?: { status?: string }) =>
    apiClient.get<ShiftRequest[]>('/shift-requests', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ShiftRequest>(`/shift-requests/${id}`).then((r) => r.data),

  create: (data: CreateShiftRequestData) =>
    apiClient.post<ShiftRequest>('/shift-requests', data).then((r) => r.data),

  respond: (id: string, status: 'accepted' | 'declined', agencyNote?: string) =>
    apiClient.patch<ShiftRequest>(`/shift-requests/${id}/respond`, { status, agencyNote }).then((r) => r.data),
};

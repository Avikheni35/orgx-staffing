import apiClient from './client';

export type ShiftStatus = 'draft' | 'published' | 'completed' | 'cancelled';
export type WorkerAssignmentStatus = 'assigned' | 'confirmed' | 'completed' | 'no_show';

export interface WorkerAssignment {
  workerId: string;
  workerName: string;
  status: WorkerAssignmentStatus;
  completedAt?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInLocation?: { lat: number; lng: number; accuracy?: number };
}

export interface AttendanceShift {
  _id: string;
  title: string;
  businessName: string;
  locationName?: string;
  startTime: string;
  endTime: string;
  status: ShiftStatus;
  completedAt?: string;
  workers: {
    workerId: string;
    workerName: string;
    status: WorkerAssignmentStatus;
    checkInTime?: string;
    checkOutTime?: string;
    checkInLocation?: { lat: number; lng: number; accuracy?: number };
  }[];
}

export interface Shift {
  _id: string;
  tenantId: string;
  businessId: string;
  businessName: string;
  locationId?: string;
  locationName?: string;
  title: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  requiredWorkers: number;
  assignedWorkers: WorkerAssignment[];
  payRatePerHour: number;
  billingRatePerHour?: number;
  status: ShiftStatus;
  notes?: string;
  completedAt?: string;
  isInstantBooking?: boolean;
  createdAt: string;
}

export interface ShiftListResult {
  shifts: Shift[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateShiftData {
  businessId: string;
  locationId?: string;
  title: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  requiredWorkers?: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  status?: ShiftStatus;
  notes?: string;
}

export const shiftsApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get<ShiftListResult>('/shifts', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<Shift>(`/shifts/${id}`).then((r) => r.data),

  create: (data: CreateShiftData) =>
    apiClient.post<Shift>('/shifts', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateShiftData>) =>
    apiClient.put<Shift>(`/shifts/${id}`, data).then((r) => r.data),

  assignWorker: (id: string, workerId: string) =>
    apiClient.post<{ shift: Shift; contractId: string; auegWarning: { months: number; businessName: string } | null }>(`/shifts/${id}/workers`, { workerId }).then((r) => r.data),

  removeWorker: (id: string, workerId: string) =>
    apiClient.delete<Shift>(`/shifts/${id}/workers/${workerId}`).then((r) => r.data),

  updateWorkerStatus: (id: string, workerId: string, status: WorkerAssignmentStatus) =>
    apiClient.patch<Shift>(`/shifts/${id}/workers/${workerId}`, { status }).then((r) => r.data),

  getApplications: (id: string) =>
    apiClient.get<ShiftApplicationItem[]>(`/shifts/${id}/applications`).then((r) => r.data),

  approveApplication: (shiftId: string, appId: string) =>
    apiClient.post<{ application: ShiftApplicationItem; contractId: string; auegWarning: { months: number; businessName: string } | null }>(`/shifts/${shiftId}/applications/${appId}/approve`).then((r) => r.data),

  rejectApplication: (shiftId: string, appId: string) =>
    apiClient.post(`/shifts/${shiftId}/applications/${appId}/reject`).then((r) => r.data),

  createTimesheets: (id: string) =>
    apiClient.post<{ created: number }>(`/shifts/${id}/create-timesheets`).then((r) => r.data),

  sendOffers: (id: string, data: { workerIds: string[]; message?: string; expiresInHours?: number }) =>
    apiClient.post<{ results: { workerId: string; workerName: string; status: string }[] }>(`/shifts/${id}/offers`, data).then((r) => r.data),

  getOffers: (id: string) =>
    apiClient.get<ShiftOfferItem[]>(`/shifts/${id}/offers`).then((r) => r.data),

  cancelOffer: (shiftId: string, offerId: string) =>
    apiClient.delete<ShiftOfferItem>(`/shifts/${shiftId}/offers/${offerId}`).then((r) => r.data),

  getAttendance: (date?: string) =>
    apiClient.get<AttendanceShift[]>('/shifts/attendance', { params: date ? { date } : {} }).then((r) => r.data),

  instantWorker: (id: string) =>
    apiClient.post<{ mode: 'assigned' | 'instant_booking'; workerName?: string; contractId?: string; auegWarning?: { months: number; businessName: string } | null }>(`/shifts/${id}/instant-worker`).then((r) => r.data),

  clone: (id: string, offsetDays: number) =>
    apiClient.post<Shift>(`/shifts/${id}/clone`, { offsetDays }).then((r) => r.data),
};

export interface ShiftApplicationItem {
  _id: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  reviewedAt?: string;
}

export interface ShiftOfferItem {
  _id: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  sentBy: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  message?: string;
  responseNote?: string;
  expiresAt: string;
  respondedAt?: string;
  createdAt: string;
}

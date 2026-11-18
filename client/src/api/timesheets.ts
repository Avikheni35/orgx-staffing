import apiClient from './client';

export type TimesheetStatus = 'pending' | 'approved' | 'disputed' | 'exported';

export interface Timesheet {
  _id: string;
  tenantId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  businessId: string;
  businessName: string;
  shiftDate: string;
  plannedStart: string;
  plannedEnd: string;
  plannedBreakMinutes: number;
  actualStart: string;
  actualEnd: string;
  actualBreakMinutes: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  totalHours: number;
  grossPay: number;
  status: TimesheetStatus;
  notes?: string;
  disputeReason?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
}

export interface TimesheetListResult {
  timesheets: Timesheet[];
  total: number;
  page: number;
  pages: number;
}

export const timesheetsApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get<TimesheetListResult>('/timesheets', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Timesheet>(`/timesheets/${id}`).then((r) => r.data),

  update: (id: string, data: Partial<{ actualStart: string; actualEnd: string; actualBreakMinutes: number; notes: string; status: TimesheetStatus }>) =>
    apiClient.put<Timesheet>(`/timesheets/${id}`, data).then((r) => r.data),

  approve: (id: string) =>
    apiClient.post<Timesheet>(`/timesheets/${id}/approve`).then((r) => r.data),

  bulkApprove: (ids: string[]) =>
    apiClient.post<{ approved: number }>('/timesheets/bulk-approve', { ids }).then((r) => r.data),
};

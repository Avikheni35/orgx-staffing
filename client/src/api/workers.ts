import apiClient from './client';

export interface Worker {
  _id: string;
  tenantId: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  skills: string[];
  languages: Array<{ language: string; level: string }>;
  status: 'pending_review' | 'active' | 'inactive' | 'suspended' | 'blacklisted' | 'anonymized';
  statusNote?: string;
  documents: Array<{
    _id: string;
    category: string;
    label: string;
    fileUrl?: string;
    expiryDate?: string;
    verified: boolean;
    remark?: string;
    remarkAt?: string;
  }>;
  auegTracking: Array<{
    businessId: string;
    businessName: string;
    startDate: string;
    monthsWorked: number;
  }>;
  availability?: {
    weeklyPattern: {
      monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean;
      friday: boolean; saturday: boolean; sunday: boolean;
    };
    exceptions: Array<{ date: string; available: boolean; note?: string }>;
    preferredRadiusKm?: number;
  };
  steuerklasse?: string;
  healthInsuranceProvider?: string;
  iban?: string;
  steuernummer?: string;
  sozialversicherungsnummer?: string;
  dsgvoConsentAt?: string;
  dsgvoConsentIp?: string;
  rating: { average: number; count: number };
  totalHoursWorked: number;
  createdAt: string;
}

export interface WorkerListResult {
  workers: Worker[];
  total: number;
  page: number;
  pages: number;
}

export interface WorkerStats {
  total: number;
  active: number;
  pendingReview: number;
  expiringDocs: number;
  auegWarnings: number;
  pendingTimesheets: number;
  pendingContracts: number;
}

export interface CreateWorkerData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  nationality?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  skills?: string[];
  languages?: Array<{ language: string; level: string }>;
  steuerklasse?: string;
  healthInsuranceProvider?: string;
}

export const workersApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get<WorkerListResult>('/workers', { params }).then((r) => r.data),

  stats: () => apiClient.get<WorkerStats>('/workers/stats').then((r) => r.data),

  get: (id: string) => apiClient.get<Worker>(`/workers/${id}`).then((r) => r.data),

  create: (data: CreateWorkerData) =>
    apiClient.post<Worker>('/workers', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateWorkerData>) =>
    apiClient.put<Worker>(`/workers/${id}`, data).then((r) => r.data),

  setStatus: (id: string, status: Worker['status'], note?: string) =>
    apiClient.patch<Worker>(`/workers/${id}/status`, { status, note }).then((r) => r.data),

  sendInvite: (id: string) =>
    apiClient.post(`/workers/${id}/invite`).then((r) => r.data),

  addDocument: (id: string, data: { category: string; label: string; expiryDate?: string; file?: File | null }) => {
    const form = new FormData();
    form.append('category', data.category);
    form.append('label', data.label);
    if (data.expiryDate) form.append('expiryDate', data.expiryDate);
    if (data.file) form.append('file', data.file);
    return apiClient.post(`/workers/${id}/documents`, form).then((r) => r.data);
  },

  deleteDocument: (id: string, docId: string) =>
    apiClient.delete(`/workers/${id}/documents/${docId}`).then((r) => r.data),

  verifyDocument: (id: string, docId: string) =>
    apiClient.patch(`/workers/${id}/documents/${docId}/verify`).then((r) => r.data),

  remarkDocument: (id: string, docId: string, remark: string) =>
    apiClient.patch(`/workers/${id}/documents/${docId}/remark`, { remark }).then((r) => r.data),

  approve: (id: string) =>
    apiClient.patch<Worker>(`/workers/${id}/approve`).then((r) => r.data),

  reject: (id: string, note?: string) =>
    apiClient.patch<Worker>(`/workers/${id}/reject`, { note }).then((r) => r.data),

  getAvailability: (id: string) =>
    apiClient.get<{ weeklyPattern: { monday: boolean; tuesday: boolean; wednesday: boolean; thursday: boolean; friday: boolean; saturday: boolean; sunday: boolean }; exceptions: Array<{ date: string; available: boolean; note?: string }>; preferredRadiusKm?: number }>(`/workers/${id}/availability`).then((r) => r.data),

  updateAvailability: (id: string, data: { weeklyPattern?: Record<string, boolean>; exceptions?: Array<{ date: string; available: boolean; note?: string }>; preferredRadiusKm?: number }) =>
    apiClient.put(`/workers/${id}/availability`, data).then((r) => r.data),

  exportData: (id: string) =>
    apiClient.get(`/workers/${id}/export`, { responseType: 'blob' }).then((r) => r.data as Blob),

  anonymize: (id: string, reason: string) =>
    apiClient.post<{ message: string; workerId: string }>(`/workers/${id}/anonymize`, { reason }).then((r) => r.data),

  setSensitiveData: (id: string, data: { iban?: string | null; steuernummer?: string | null; sozialversicherungsnummer?: string | null }) =>
    apiClient.patch<{ message: string }>(`/workers/${id}/sensitive-data`, data).then((r) => r.data),

  downloadPayslip: (id: string, month: string) =>
    apiClient.get(`/workers/${id}/payslip`, { params: { month }, responseType: 'blob' }).then((r) => r.data as Blob),
};

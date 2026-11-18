import apiClient from './client';
import type { Timesheet } from './timesheets';
import type { Contract } from './contracts';

export interface WeeklyPattern {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface AvailabilityException {
  date: string;
  available: boolean;
  note?: string;
}

export interface WorkerAvailability {
  weeklyPattern: WeeklyPattern;
  exceptions: AvailabilityException[];
  preferredRadiusKm?: number;
}

export type WorkerAssignmentStatus = 'assigned' | 'confirmed' | 'completed' | 'no_show';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface WorkerShift {
  _id: string;
  tenantId: string;
  businessName: string;
  locationName?: string;
  title: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  requiredWorkers: number;
  assignedWorkers: Array<{ workerId: string; workerName: string; status: WorkerAssignmentStatus }>;
  payRatePerHour: number;
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  notes?: string;
  completedAt?: string | null;
  myStatus: WorkerAssignmentStatus | null;
  myCompletedAt?: string | null;
  myCheckInTime?: string | null;
  myCheckOutTime?: string | null;
  myApplication?: ShiftApplicationWithShift | null;
  myContract?: Contract | null;
  isInstantBooking?: boolean;
}

export interface ShiftApplication {
  _id: string;
  tenantId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  status: ApplicationStatus;
  appliedAt: string;
  reviewedAt?: string;
}

export interface ShiftApplicationWithShift extends ShiftApplication {
  shift: WorkerShift | null;
}

export interface WorkerDocument {
  _id: string;
  category: 'identity' | 'work_permit' | 'health_certificate' | 'contract' | 'other';
  label: string;
  fileUrl?: string;
  expiryDate?: string;
  verified: boolean;
  uploadedAt: string;
}

export interface WorkerMeResult {
  worker: {
    _id: string;
    firstName: string;
    lastName: string;
    status: string;
    documents: WorkerDocument[];
  };
  upcomingConfirmed: number;
  pendingTimesheets: number;
  pendingApplications: number;
  pendingOffers: number;
  nextShift: WorkerShift | null;
}

export type ShiftOfferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface ShiftOffer {
  _id: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  sentBy: string;
  status: ShiftOfferStatus;
  message?: string;
  responseNote?: string;
  expiresAt: string;
  respondedAt?: string;
  createdAt: string;
  isExpired: boolean;
  shift: WorkerShift | null;
}

export const workerPortalApi = {
  me: () => apiClient.get<WorkerMeResult>('/worker-portal/me').then((r) => r.data),

  getAvailableShifts: () =>
    apiClient.get<WorkerShift[]>('/worker-portal/available-shifts').then((r) => r.data),

  applyForShift: (shiftId: string) =>
    apiClient.post<ShiftApplication>(`/worker-portal/shifts/${shiftId}/apply`).then((r) => r.data),

  getOffers: () =>
    apiClient.get<ShiftOffer[]>('/worker-portal/offers').then((r) => r.data),

  acceptOffer: (offerId: string) =>
    apiClient.post<{ offer: ShiftOffer; contractId: string }>(`/worker-portal/offers/${offerId}/accept`).then((r) => r.data),

  declineOffer: (offerId: string, responseNote?: string) =>
    apiClient.post<ShiftOffer>(`/worker-portal/offers/${offerId}/decline`, { responseNote }).then((r) => r.data),

  getApplications: () =>
    apiClient.get<ShiftApplicationWithShift[]>('/worker-portal/applications').then((r) => r.data),

  getMyShifts: (tab: 'to-confirm' | 'timeline' | 'upcoming' | 'completed' | 'all' = 'to-confirm') =>
    apiClient.get<WorkerShift[]>('/worker-portal/shifts', { params: { tab } }).then((r) => r.data),

  getShift: (shiftId: string) =>
    apiClient.get<WorkerShift>(`/worker-portal/shifts/${shiftId}`).then((r) => r.data),

  withdrawApplication: (shiftId: string) =>
    apiClient.delete<{ success: boolean }>(`/worker-portal/shifts/${shiftId}/application`).then((r) => r.data),

  checkIn: (shiftId: string, location?: { lat: number; lng: number; accuracy?: number }) =>
    apiClient.post<{ success: boolean; checkInTime: string }>(`/worker-portal/${shiftId}/checkin`, location ?? {}).then((r) => r.data),

  checkOut: (shiftId: string) =>
    apiClient.post<{ success: boolean; checkOutTime: string }>(`/worker-portal/${shiftId}/checkout`).then((r) => r.data),

  completeShift: (shiftId: string) =>
    apiClient.patch(`/worker-portal/${shiftId}/complete`).then((r) => r.data),

  instantBook: (shiftId: string) =>
    apiClient.post<{ contractId: string; auegWarning: { months: number; businessName: string } | null }>(`/worker-portal/shifts/${shiftId}/instant-book`).then((r) => r.data),

  getTimesheets: (status: 'pending' | 'approved' | 'disputed' | 'exported' | 'all' = 'all') =>
    apiClient.get<Timesheet[]>('/worker-portal/timesheets', { params: { status } }).then((r) => r.data),

  getTimesheet: (id: string) =>
    apiClient.get<Timesheet>(`/worker-portal/timesheets/${id}`).then((r) => r.data),

  disputeTimesheet: (id: string, reason: string) =>
    apiClient.post<Timesheet>(`/worker-portal/timesheets/${id}/dispute`, { reason }).then((r) => r.data),

  withdrawDispute: (id: string) =>
    apiClient.post<Timesheet>(`/worker-portal/timesheets/${id}/withdraw-dispute`).then((r) => r.data),

  getAvailability: () =>
    apiClient.get<WorkerAvailability>('/worker-portal/availability').then((r) => r.data),

  updateAvailability: (data: Partial<WorkerAvailability>) =>
    apiClient.put<WorkerAvailability>('/worker-portal/availability', data).then((r) => r.data),

  getProfile: () => apiClient.get<WorkerProfile>('/worker-portal/profile').then((r) => r.data),

  updateProfile: (data: WorkerProfileUpdate) =>
    apiClient.patch<{ message: string }>('/worker-portal/profile', data).then((r) => r.data),
};

export interface WorkerProfile {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'diverse' | 'not_specified';
  nationality?: string;
  phone?: string;
  email: string;
  address: { street?: string; city?: string; postalCode?: string; country: string };
  steuerklasse?: string;
  steuernummer?: string;
  sozialversicherungsnummer?: string;
  healthInsuranceProvider?: string;
  iban?: string;
  bankName?: string;
  skills: string[];
  languages: Array<{ language: string; level: string }>;
}

export interface WorkerProfileUpdate {
  phone?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  steuerklasse?: string;
  steuernummer?: string;
  sozialversicherungsnummer?: string;
  healthInsuranceProvider?: string;
  iban?: string;
  bankName?: string;
}

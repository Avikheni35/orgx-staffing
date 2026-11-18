import apiClient from './client';

export type StaffRole = 'agency_admin' | 'disponent';
export type StaffStatus = 'active' | 'inactive' | 'suspended';

export interface StaffMember {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  status: StaffStatus;
  emailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  inviteExpires?: string;
}

export const staffApi = {
  list: () => apiClient.get<StaffMember[]>('/staff').then((r) => r.data),

  invite: (email: string, role: StaffRole) =>
    apiClient.post<StaffMember>('/staff', { email, role }).then((r) => r.data),

  resendInvite: (id: string) =>
    apiClient.post(`/staff/${id}/resend-invite`).then((r) => r.data),

  setStatus: (id: string, status: StaffStatus) =>
    apiClient.patch(`/staff/${id}/status`, { status }).then((r) => r.data),

  remove: (id: string) =>
    apiClient.delete(`/staff/${id}`).then((r) => r.data),
};

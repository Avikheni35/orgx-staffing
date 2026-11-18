import apiClient from './client';

export type ContractStatus = 'pending_signature' | 'signed' | 'voided';

export interface Contract {
  _id: string;
  tenantId: string;
  shiftId: string;
  workerId: string;
  workerName: string;
  workerEmail: string;
  agencyName: string;
  businessName: string;
  shiftTitle: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  payRatePerHour: number;
  contractHtml: string;
  status: ContractStatus;
  signedAt?: string;
  signatureData?: string;
  emailSentAt?: string;
  createdAt: string;
}

export const contractsApi = {
  // Agency
  list: (params?: { status?: string; shiftId?: string }) =>
    apiClient.get<Contract[]>('/contracts', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Contract>(`/contracts/${id}`).then((r) => r.data),

  // Worker portal
  myContracts: () =>
    apiClient.get<Contract[]>('/worker-portal/contracts').then((r) => r.data),

  myContract: (contractId: string) =>
    apiClient.get<Contract>(`/worker-portal/contracts/${contractId}`).then((r) => r.data),

  sign: (contractId: string, signatureData: string) =>
    apiClient
      .post<{ success: boolean; signedAt: string }>(`/worker-portal/contracts/${contractId}/sign`, { signatureData })
      .then((r) => r.data),
};

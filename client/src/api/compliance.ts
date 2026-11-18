import apiClient from './client';

export type AuegSeverity = 'warning' | 'blocked';

export interface AuegEntry {
  businessId: string;
  businessName: string;
  monthsWorked: number;
  lastAssignmentDate?: string;
  severity: AuegSeverity;
}

export interface AuegWorker {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  auegEntries: AuegEntry[];
}

export const complianceApi = {
  auegList: () => apiClient.get<AuegWorker[]>('/compliance/aueg').then((r) => r.data),
};

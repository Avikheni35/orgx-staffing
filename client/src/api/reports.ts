import apiClient from './client';

export type DocumentCategory = 'identity' | 'work_permit' | 'health_certificate' | 'contract' | 'other';

export interface ReportDocument {
  _id: string;
  category: DocumentCategory;
  label: string;
  expiryDate: string;
  verified: boolean;
  expired: boolean;
  daysLeft: number;
}

export interface DocumentReportRow {
  workerId: string;
  firstName: string;
  lastName: string;
  status: string;
  nationality?: string;
  documents: ReportDocument[];
  minDaysLeft: number;
  hasExpired: boolean;
}

export interface DocumentsReport {
  days: number;
  horizon: string;
  total: number;
  rows: DocumentReportRow[];
}

export const reportsApi = {
  getDocuments: (days = 60) =>
    apiClient.get<DocumentsReport>('/reports/documents', { params: { days } }).then((r) => r.data),
};

import apiClient from './client';
import type { Timesheet } from './timesheets';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceLineItem {
  timesheetId: string;
  description: string;
  hours: number;
  ratePerHour: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  tenantId: string;
  invoiceNumber: string;
  businessId: string;
  businessName: string;
  businessAddress?: string;
  businessVatId?: string;
  agencyName: string;
  agencyAddress?: string;
  agencyVatId?: string;
  invoiceDate: string;
  dueDate: string;
  periodFrom: string;
  periodTo: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
}

export interface InvoiceListResult {
  invoices: Invoice[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateInvoiceData {
  businessId: string;
  timesheetIds: string[];
  invoiceDate: string;
  dueDate: string;
  periodFrom: string;
  periodTo: string;
  notes?: string;
}

export const invoicesApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get<InvoiceListResult>('/invoices', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Invoice>(`/invoices/${id}`).then((r) => r.data),

  create: (data: CreateInvoiceData) =>
    apiClient.post<Invoice>('/invoices', data).then((r) => r.data),

  updateStatus: (id: string, status: InvoiceStatus) =>
    apiClient.patch<Invoice>(`/invoices/${id}/status`, { status }).then((r) => r.data),

  getInvoiceableTimesheets: (businessId: string) =>
    apiClient.get<Timesheet[]>('/invoices/invoiceable-timesheets', { params: { businessId } }).then((r) => r.data),

  downloadPdf: async (id: string, invoiceNumber: string) => {
    const response = await apiClient.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoiceNumber}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },

  datevExport: async (from?: string, to?: string) => {
    const params: Record<string, string> = {};
    if (from) params.from = from;
    if (to) params.to = to;
    const response = await apiClient.get('/invoices/datev-export', { params, responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datev_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};

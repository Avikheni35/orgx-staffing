import apiClient from './client';

export interface CreditNoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface CreditNote {
  _id: string;
  tenantId: string;
  invoiceId: string | { _id: string; invoiceNumber: string };
  creditNoteNumber: string;
  reason: string;
  lineItems: CreditNoteLineItem[];
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'applied';
  issuedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCreditNoteData {
  invoiceId: string;
  reason: string;
  lineItems: CreditNoteLineItem[];
  vatRate?: number;
}

export const creditNotesApi = {
  list: (invoiceId?: string) =>
    apiClient.get<CreditNote[]>('/credit-notes', { params: invoiceId ? { invoiceId } : undefined }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<CreditNote>(`/credit-notes/${id}`).then((r) => r.data),

  create: (data: CreateCreditNoteData) =>
    apiClient.post<CreditNote>('/credit-notes', data).then((r) => r.data),

  issue: (id: string) =>
    apiClient.patch<CreditNote>(`/credit-notes/${id}/issue`).then((r) => r.data),
};

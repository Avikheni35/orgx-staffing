import apiClient from './client';

export interface ClientShift {
  _id: string;
  title: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  locationName?: string;
  status: 'draft' | 'published' | 'completed' | 'cancelled';
  requiredWorkers: number;
  assignedWorkers: Array<{ workerId: string; workerName: string; status: string }>;
  notes?: string;
}

export interface ClientInvoice {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodFrom: string;
  periodTo: string;
  businessName: string;
  agencyName: string;
  agencyAddress?: string;
  agencyVatId?: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  lineItems: Array<{
    description: string;
    hours: number;
    ratePerHour: number;
    amount: number;
  }>;
  notes?: string;
}

export interface ClientDashboard {
  businessName: string;
  upcomingShifts: ClientShift[];
  upcomingShiftsCount: number;
  openInvoicesCount: number;
  totalInvoiced: number;
}

export interface ClientMe {
  business: {
    _id: string;
    name: string;
    industry?: string;
    address: { street?: string; city?: string; postalCode?: string; country?: string };
    vatId?: string;
    vatNumber?: string;
    website?: string;
    billingEmail?: string;
    billingAddress?: string;
  };
  contact: {
    firstName: string;
    lastName: string;
    position?: string;
    role?: string;
    email: string;
    phone?: string;
  };
}

export const clientPortalApi = {
  me: () => apiClient.get<ClientMe>('/client-portal/me').then((r) => r.data),
  getMe: () => apiClient.get<ClientMe>('/client-portal/me').then((r) => r.data),

  dashboard: () =>
    apiClient.get<ClientDashboard>('/client-portal/dashboard').then((r) => r.data),

  shifts: (status: 'upcoming' | 'past' | 'all' = 'upcoming') =>
    apiClient.get<ClientShift[]>(`/client-portal/shifts?status=${status}`).then((r) => r.data),

  shift: (id: string) =>
    apiClient.get<ClientShift>(`/client-portal/shifts/${id}`).then((r) => r.data),

  invoices: (status: 'open' | 'paid' | 'all' = 'all') =>
    apiClient.get<ClientInvoice[]>(`/client-portal/invoices?status=${status}`).then((r) => r.data),

  invoice: (id: string) =>
    apiClient.get<ClientInvoice>(`/client-portal/invoices/${id}`).then((r) => r.data),
};

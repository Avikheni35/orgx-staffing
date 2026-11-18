import apiClient from './client';

export interface Business {
  _id: string;
  tenantId: string;
  name: string;
  industry?: string;
  vatNumber?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  defaultBillingRatePerHour?: number;
  contacts: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    role?: string;
    email: string;
    phone?: string;
    hasPortalAccess: boolean;
  }>;
  locations: Array<{
    _id: string;
    name: string;
    street?: string;
    city?: string;
    postalCode?: string;
  }>;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface BusinessListResult {
  businesses: Business[];
  total: number;
  page: number;
  pages: number;
}

export interface CreateBusinessData {
  name: string;
  industry?: string;
  vatNumber?: string;
  hrbNumber?: string;
  address?: { street?: string; city?: string; postalCode?: string; country?: string };
  defaultBillingRatePerHour?: number;
  notes?: string;
}

export interface ContactData {
  firstName: string;
  lastName: string;
  role?: string;
  email: string;
  phone?: string;
}

export interface LocationData {
  name: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  notes?: string;
}

export const businessesApi = {
  list: (params?: Record<string, string | number>) =>
    apiClient.get<BusinessListResult>('/businesses', { params }).then((r) => r.data),

  get: (id: string) => apiClient.get<Business>(`/businesses/${id}`).then((r) => r.data),

  create: (data: CreateBusinessData) =>
    apiClient.post<Business>('/businesses', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateBusinessData>) =>
    apiClient.put<Business>(`/businesses/${id}`, data).then((r) => r.data),

  addContact: (id: string, data: ContactData) =>
    apiClient.post<Business>(`/businesses/${id}/contacts`, data).then((r) => r.data),

  removeContact: (id: string, contactId: string) =>
    apiClient.delete<Business>(`/businesses/${id}/contacts/${contactId}`).then((r) => r.data),

  addLocation: (id: string, data: LocationData) =>
    apiClient.post<Business>(`/businesses/${id}/locations`, data).then((r) => r.data),

  removeLocation: (id: string, locationId: string) =>
    apiClient.delete<Business>(`/businesses/${id}/locations/${locationId}`).then((r) => r.data),

  grantPortalAccess: (id: string, contactId: string) =>
    apiClient.post(`/businesses/${id}/contacts/${contactId}/grant-access`).then((r) => r.data),

  revokePortalAccess: (id: string, contactId: string) =>
    apiClient.post(`/businesses/${id}/contacts/${contactId}/revoke-access`).then((r) => r.data),
};

import apiClient from './client';

export interface ContractTemplate {
  _id: string;
  tenantId: string;
  name: string;
  html: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ContractTemplatesListResult {
  templates: ContractTemplate[];
  placeholders: Record<string, string>;
  defaultHtml: string;
}

export const contractTemplatesApi = {
  list: () =>
    apiClient.get<ContractTemplatesListResult>('/contract-templates').then((r) => r.data),

  get: (id: string) =>
    apiClient.get<ContractTemplate>(`/contract-templates/${id}`).then((r) => r.data),

  create: (data: { name: string; html: string; isDefault?: boolean }) =>
    apiClient.post<ContractTemplate>('/contract-templates', data).then((r) => r.data),

  update: (id: string, data: { name: string; html: string; isDefault?: boolean }) =>
    apiClient.put<ContractTemplate>(`/contract-templates/${id}`, data).then((r) => r.data),

  setDefault: (id: string) =>
    apiClient.patch<ContractTemplate>(`/contract-templates/${id}/set-default`).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/contract-templates/${id}`).then((r) => r.data),
};

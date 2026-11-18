import apiClient from './client';

export interface ServiceConnection {
  url: string;
  token: string;
  enabled: boolean;
  lastPingAt?: string;
  lastPingOk?: boolean;
}

export interface IntegrationSettingsResponse {
  ownServiceToken: string;
  connectedServices: {
    m2: ServiceConnection | null;
    m3: ServiceConnection | null;
  };
}

export interface ConnectionPayload {
  module: 'm2' | 'm3';
  url: string;
  token: string;
  enabled: boolean;
}

export const serviceIntegrationsApi = {
  get: () =>
    apiClient.get<IntegrationSettingsResponse>('/settings/integrations').then((r) => r.data),

  saveConnection: (payload: ConnectionPayload) =>
    apiClient.put('/settings/integrations/connections', payload).then((r) => r.data),

  testConnection: (module: 'm2' | 'm3') =>
    apiClient
      .post<{ ok: boolean; latencyMs?: number }>(`/settings/integrations/test/${module}`)
      .then((r) => r.data),

  regenerateToken: () =>
    apiClient
      .post<{ ownServiceToken: string }>('/settings/integrations/regenerate-token')
      .then((r) => r.data),
};

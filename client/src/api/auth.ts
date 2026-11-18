import apiClient from './client';
import type { AuthUser } from '../types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface LoginResult {
  requiresOtp?: boolean;
  accessToken?: string;
  user?: AuthUser;
}

export const authApi = {
  login: (data: LoginPayload) =>
    apiClient.post<LoginResult>('/auth/login', data).then((r) => r.data),

  verifyOtp: (email: string, otp: string) =>
    apiClient.post<LoginResponse>('/auth/verify-otp', { email, otp }).then((r) => r.data),

  logout: () => apiClient.post('/auth/logout'),

  forgotPassword: (email: string) =>
    apiClient.post('/auth/forgot-password', { email }).then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    apiClient.post('/auth/reset-password', { token, password }).then((r) => r.data),

  sendMagicLink: (email: string, tenantCode?: string) =>
    apiClient.post(
      '/auth/magic-link',
      { email },
      tenantCode ? { headers: { 'X-Tenant-Code': tenantCode.trim().toLowerCase() } } : undefined
    ).then((r) => r.data),

  loginWithMagicLink: (token: string, tenantCode?: string) =>
    apiClient.post<LoginResponse>(
      '/auth/magic-login',
      { token },
      tenantCode ? { headers: { 'X-Tenant-Code': tenantCode } } : undefined
    ).then((r) => r.data),

  acceptInvite: (data: {
    token: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => apiClient.post<LoginResponse>('/auth/accept-invite', data).then((r) => r.data),

  me: () => apiClient.get<{ user: AuthUser }>('/auth/me').then((r) => r.data.user),
};

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  withCredentials: true, // send cookies (refresh token)
});

// Attach access token to every request
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string> | null = null;

// Auth endpoints that should never trigger a token refresh on 401
const AUTH_PATHS = ['/auth/login', '/auth/refresh', '/auth/magic-login', '/auth/accept-invite'];

function isAuthEndpoint(url?: string): boolean {
  return AUTH_PATHS.some((p) => url?.includes(p));
}

// Auto-refresh on 401 — only for protected endpoints, not auth endpoints themselves
apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (
      error.response?.status === 401 &&
      !original._retry &&
      !isAuthEndpoint(original.url)
    ) {
      original._retry = true;

      if (!refreshing) {
        refreshing = apiClient
          .post<{ accessToken: string }>('/auth/refresh')
          .then((r) => {
            const newToken = r.data.accessToken;
            useAuthStore.getState().setAccessToken(newToken);
            return newToken;
          })
          .catch((err) => {
            useAuthStore.getState().clearAuth();
            window.location.href = '/login';
            return Promise.reject(err);
          })
          .finally(() => {
            refreshing = null;
          });
      }

      try {
        const newToken = await refreshing;
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

import { create } from 'zustand';
import type { AuthUser } from '../types';

interface OriginalAuth {
  user: AuthUser;
  accessToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  originalAuth: OriginalAuth | null;
  impersonatedTenantName: string | null;

  setAuth: (user: AuthUser, accessToken: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  setInitialized: () => void;
  startImpersonation: (user: AuthUser, accessToken: string, tenantName: string) => void;
  exitImpersonation: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,
  originalAuth: null,
  impersonatedTenantName: null,

  setAuth: (user, accessToken) => set({ user, accessToken, isAuthenticated: true }),
  setAccessToken: (token) => set({ accessToken: token }),
  clearAuth: () => set({ user: null, accessToken: null, isAuthenticated: false, originalAuth: null, impersonatedTenantName: null }),
  setInitialized: () => set({ isInitializing: false }),

  startImpersonation: (user, accessToken, tenantName) => {
    const current = get();
    set({
      originalAuth: { user: current.user!, accessToken: current.accessToken! },
      user,
      accessToken,
      isAuthenticated: true,
      impersonatedTenantName: tenantName,
    });
  },

  exitImpersonation: () => {
    const { originalAuth } = get();
    if (!originalAuth) return;
    set({
      user: originalAuth.user,
      accessToken: originalAuth.accessToken,
      isAuthenticated: true,
      originalAuth: null,
      impersonatedTenantName: null,
    });
  },
}));

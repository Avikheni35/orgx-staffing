import apiClient from './client';

export type BillingPlan = 'starter' | 'growth' | 'pro' | 'enterprise';

export interface BillingStatus {
  plan: BillingPlan;
  status: 'trial' | 'active' | 'suspended';
  stripeSubscriptionStatus?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  trialEndsAt?: string;
  planLimits: { maxWorkers: number; maxDisponents: number };
  prices: Record<BillingPlan, number>;
}

export const billingApi = {
  getStatus: () =>
    apiClient.get<BillingStatus>('/billing/status').then((r) => r.data),

  startCheckout: (plan: BillingPlan) =>
    apiClient.post<{ url: string }>('/billing/checkout', { plan }).then((r) => r.data),

  openPortal: () =>
    apiClient.post<{ url: string }>('/billing/portal').then((r) => r.data),

  changePlan: (plan: BillingPlan) =>
    apiClient.post('/billing/change-plan', { plan }).then((r) => r.data),

  cancel: () =>
    apiClient.post('/billing/cancel').then((r) => r.data),

  reactivate: () =>
    apiClient.post('/billing/reactivate').then((r) => r.data),
};

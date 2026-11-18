import apiClient from './client';

export const pushApi = {
  getVapidPublicKey: () =>
    apiClient.get<{ publicKey: string | null }>('/push/vapid-public-key'),

  subscribe: (subscription: PushSubscriptionJSON) =>
    apiClient.post('/push/subscribe', {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh,
        auth:   subscription.keys?.auth,
      },
    }),

  unsubscribe: (endpoint?: string) =>
    apiClient.delete('/push/unsubscribe', { data: { endpoint } }),
};

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = window.atob(base64);
  const arr     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

import apiClient from './client';

export type NotificationType =
  | 'shift_application'
  | 'timesheet_dispute'
  | 'timesheet_approved'
  | 'contract_signed'
  | 'worker_registered'
  | 'aueg_warning'
  | 'aueg_block';

export interface AppNotification {
  _id: string;
  tenantId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  readAt?: string;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export const notificationsApi = {
  list: (params?: { limit?: number; skip?: number }) =>
    apiClient.get<NotificationsResponse>('/notifications', { params }).then((r) => r.data),

  markRead: (id: string) =>
    apiClient.patch(`/notifications/${id}/read`).then((r) => r.data),

  markAllRead: () =>
    apiClient.patch('/notifications/read-all').then((r) => r.data),
};

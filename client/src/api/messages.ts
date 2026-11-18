import apiClient from './client';

export interface Message {
  _id: string;
  tenantId: string;
  workerId: string;
  workerName: string;
  senderRole: 'agency' | 'worker';
  senderId: string;
  senderName: string;
  body: string;
  readAt?: string;
  createdAt: string;
}

export interface Thread {
  _id: string;         // workerId
  workerName: string;
  latestBody: string;
  latestAt: string;
  latestSenderRole: 'agency' | 'worker';
  unreadCount: number;
}

export const messagesApi = {
  // Disponent side
  listThreads: () =>
    apiClient.get<Thread[]>('/messages').then((r) => r.data),

  getThread: (workerId: string) =>
    apiClient.get<{ worker: { _id: string; firstName: string; lastName: string }; messages: Message[] }>(
      `/messages/${workerId}`
    ).then((r) => r.data),

  sendToWorker: (workerId: string, body: string) =>
    apiClient.post<Message>(`/messages/${workerId}`, { body }).then((r) => r.data),

  // Worker side
  getMyThread: () =>
    apiClient.get<Message[]>('/worker-portal/messages').then((r) => r.data),

  sendToAgency: (body: string) =>
    apiClient.post<Message>('/worker-portal/messages', { body }).then((r) => r.data),

  getUnreadCount: () =>
    apiClient.get<{ count: number }>('/worker-portal/messages/unread-count').then((r) => r.data),
};

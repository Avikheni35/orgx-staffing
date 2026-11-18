import apiClient from './client';

export interface WorkerRating {
  _id: string;
  shiftId: string;
  workerId: string;
  businessId: string;
  ratedBy: string;
  overallRating: number;
  punctuality?: number;
  quality?: number;
  attitude?: number;
  comment?: string;
  createdAt: string;
}

export interface CreateWorkerRatingData {
  shiftId: string;
  workerId: string;
  overallRating: number;
  punctuality?: number;
  quality?: number;
  attitude?: number;
  comment?: string;
}

export const workerRatingsApi = {
  list: (params?: { workerId?: string; shiftId?: string }) =>
    apiClient.get<WorkerRating[]>('/worker-ratings', { params }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<WorkerRating>(`/worker-ratings/${id}`).then((r) => r.data),

  create: (data: CreateWorkerRatingData) =>
    apiClient.post<WorkerRating>('/worker-ratings', data).then((r) => r.data),
};

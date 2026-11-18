import { OutboxEvent } from '../models/OutboxEvent';

export interface OutboxParams {
  tenantId: string;
  type: string;
  targetModule: 'm2' | 'm3';
  targetPath: string;
  payload: object;
}

export async function enqueueOutbox(params: OutboxParams): Promise<void> {
  try {
    await OutboxEvent.create(params);
  } catch {
    // fire-and-forget — never propagate
  }
}

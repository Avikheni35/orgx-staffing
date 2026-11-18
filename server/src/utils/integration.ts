import { Types } from 'mongoose';
import { IntegrationEvent, M1Module } from '../models/IntegrationEvent';

interface EmitParams {
  tenantId: string | Types.ObjectId;
  sourceModule?: M1Module;
  eventType: string;
  entityType: string;
  entityId: string | Types.ObjectId;
  payload?: Record<string, unknown>;
}

// Fire-and-forget — never throws, call after the primary mutation succeeds.
export function emitIntegrationEvent(params: EmitParams): void {
  const { tenantId, sourceModule = 'workforce', eventType, entityType, entityId, payload = {} } = params;

  IntegrationEvent.create({
    tenantId,
    sourceModule,
    eventType,
    entityType,
    entityId,
    payload,
    consumedBy: [],
  }).catch((err) => {
    console.error('[IntegrationEvent] emit failed:', eventType, err?.message);
  });
}

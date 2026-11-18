import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { IntegrationEvent } from '../models/IntegrationEvent';
import { IntegrationMapping } from '../models/IntegrationMapping';
import { Worker } from '../models/Worker';
import { Business } from '../models/Business';
import { Shift } from '../models/Shift';
import { Invoice } from '../models/Invoice';
import { Timesheet } from '../models/Timesheet';
import { Types } from 'mongoose';

const router = Router();
router.use(requireAuth);

// ── Integration Events ─────────────────────────────────────────────────────

// GET /api/integrations/events?entityType=Worker&eventType=worker.created&page=1&limit=20
router.get(
  '/events',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { entityType, eventType, page = '1', limit = '20' } = req.query as Record<string, string>;

    const query: Record<string, unknown> = { tenantId };
    if (entityType) query.entityType = entityType;
    if (eventType) query.eventType = eventType;

    const p = Math.max(1, parseInt(page));
    const l = Math.min(100, parseInt(limit));

    const [events, total] = await Promise.all([
      IntegrationEvent.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      IntegrationEvent.countDocuments(query),
    ]);

    res.json({ events, total, page: p, pages: Math.ceil(total / l) });
  })
);

// POST /api/integrations/events/:id/consume  — mark event consumed by a module
router.post(
  '/events/:id/consume',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { module: moduleName } = req.body as { module: string };
    if (!moduleName) throw new AppError('module is required', 400);

    const event = await IntegrationEvent.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $addToSet: { consumedBy: moduleName } },
      { new: true }
    );
    if (!event) throw new AppError('Event not found', 404);
    res.json(event);
  })
);

// ── Integration Mappings ───────────────────────────────────────────────────

// GET /api/integrations/mappings?sourceEntityType=Worker&targetModule=event
router.get(
  '/mappings',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { sourceEntityType, targetModule, page = '1', limit = '50' } = req.query as Record<string, string>;

    const query: Record<string, unknown> = { tenantId };
    if (sourceEntityType) query.sourceEntityType = sourceEntityType;
    if (targetModule) query.targetModule = targetModule;

    const p = Math.max(1, parseInt(page));
    const l = Math.min(200, parseInt(limit));

    const [mappings, total] = await Promise.all([
      IntegrationMapping.find(query).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).lean(),
      IntegrationMapping.countDocuments(query),
    ]);

    res.json({ mappings, total, page: p, pages: Math.ceil(total / l) });
  })
);

const mappingSchema = z.object({
  sourceModule:     z.enum(['workforce', 'event', 'erp', 'inventory']),
  sourceEntityType: z.string().min(1),
  sourceEntityId:   z.string().min(1),
  targetModule:     z.enum(['workforce', 'event', 'erp', 'inventory']),
  targetEntityType: z.string().min(1),
  targetEntityId:   z.string().optional(),
  snapshot:         z.record(z.unknown()).optional(),
});

// POST /api/integrations/mappings
router.post(
  '/mappings',
  requireRole('agency_admin'),
  validate(mappingSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { sourceModule, sourceEntityType, sourceEntityId, targetModule, targetEntityType, targetEntityId, snapshot } = req.body;

    const mapping = await IntegrationMapping.findOneAndUpdate(
      { tenantId, sourceModule, sourceEntityType, sourceEntityId, targetModule, targetEntityType },
      {
        $set: {
          targetEntityId: targetEntityId ? new Types.ObjectId(targetEntityId) : null,
          snapshot: snapshot ?? {},
          snapshotAt: new Date(),
        },
        $setOnInsert: { tenantId, sourceModule, sourceEntityType, sourceEntityId: new Types.ObjectId(sourceEntityId), targetModule, targetEntityType },
      },
      { upsert: true, new: true }
    );

    res.status(201).json(mapping);
  })
);

// PATCH /api/integrations/mappings/:id/snapshot — update snapshot on source entity change
router.patch(
  '/mappings/:id/snapshot',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { snapshot } = req.body as { snapshot: Record<string, unknown> };
    if (!snapshot) throw new AppError('snapshot is required', 400);

    const mapping = await IntegrationMapping.findOneAndUpdate(
      { _id: req.params.id, tenantId },
      { $set: { snapshot, snapshotAt: new Date() } },
      { new: true }
    );
    if (!mapping) throw new AppError('Mapping not found', 404);
    res.json(mapping);
  })
);

// DELETE /api/integrations/mappings/:id
router.delete(
  '/mappings/:id',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const mapping = await IntegrationMapping.findOneAndDelete({ _id: req.params.id, tenantId });
    if (!mapping) throw new AppError('Mapping not found', 404);
    res.json({ message: 'Mapping deleted' });
  })
);

// ── External Ref Writer ────────────────────────────────────────────────────
// Called by M2/M3/M4 to register their entity ID back onto an M1 entity.
// POST /api/integrations/external-ref  { entityType, entityId, module, targetEntityType, targetEntityId }

const externalRefSchema = z.object({
  entityType:       z.enum(['Worker', 'Business', 'Shift', 'Invoice', 'Timesheet']),
  entityId:         z.string().min(1),
  module:           z.enum(['event', 'erp', 'inventory']),
  targetEntityType: z.string().min(1),
  targetEntityId:   z.string().min(1),
});

const MODEL_MAP = { Worker, Business, Shift, Invoice, Timesheet } as const;

router.post(
  '/external-ref',
  requireRole('agency_admin'),
  validate(externalRefSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const { entityType, entityId, module: moduleName, targetEntityType, targetEntityId } = req.body;

    const Model = MODEL_MAP[entityType as keyof typeof MODEL_MAP];
    const doc = await (Model as typeof Worker).findOne({ _id: entityId, tenantId });
    if (!doc) throw new AppError(`${entityType} not found`, 404);

    const refs = (doc as unknown as { externalRefs: Array<{ module: string; entityType: string; entityId: string }> }).externalRefs ?? [];
    const exists = refs.some((r) => r.module === moduleName && r.entityType === targetEntityType);
    if (!exists) {
      await (Model as typeof Worker).updateOne(
        { _id: entityId, tenantId },
        { $push: { externalRefs: { module: moduleName, entityType: targetEntityType, entityId: targetEntityId, linkedAt: new Date() } } }
      );
    }

    res.json({ message: 'External ref registered' });
  })
);

export default router;

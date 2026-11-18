import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AuditLog } from '../models/AuditLog';

const router = Router();
router.use(requireAuth);
router.use(requireRole('agency_admin'));

// GET /api/audit-log?page=1&limit=50&action=worker.status_changed&actorId=...
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId!;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { tenantId };
    if (req.query.action) filter.action = req.query.action;
    if (req.query.actorId) filter.actorId = req.query.actorId;
    if (req.query.targetType) filter.targetType = req.query.targetType;

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    res.json({ entries, total, page, pages: Math.ceil(total / limit) });
  })
);

export default router;

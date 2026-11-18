import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as timesheetService from '../services/timesheet.service';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

// GET /api/timesheets
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { from, to, status, workerId, businessId, shiftId, page, limit } = req.query as Record<string, string>;
    const result = await timesheetService.listTimesheets(tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status: status as timesheetService.TimesheetFilters['status'],
      workerId,
      businessId,
      shiftId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    res.json(result);
  })
);

// GET /api/timesheets/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const ts = await timesheetService.getTimesheet(tenantId, req.params.id);
    res.json(ts);
  })
);

// PUT /api/timesheets/:id
router.put(
  '/:id',
  validate(
    z.object({
      actualStart: z.coerce.date().optional(),
      actualEnd: z.coerce.date().optional(),
      actualBreakMinutes: z.number().min(0).optional(),
      notes: z.string().optional(),
      status: z.enum(['pending', 'approved', 'disputed', 'exported']).optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const ts = await timesheetService.updateTimesheet(tenantId, req.params.id, req.body);
    res.json(ts);
  })
);

// POST /api/timesheets/:id/approve
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const ts = await timesheetService.approveTimesheet(tenantId, req.params.id, req.user!.userId);
    res.json(ts);
  })
);

// POST /api/timesheets/bulk-approve
router.post(
  '/bulk-approve',
  validate(z.object({ ids: z.array(z.string()).min(1) })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const count = await timesheetService.bulkApprove(tenantId, req.body.ids, req.user!.userId);
    res.json({ approved: count });
  })
);

export default router;

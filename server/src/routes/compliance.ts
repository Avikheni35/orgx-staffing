import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { Worker } from '../models/Worker';
import { AUEG_WARN_MONTHS, AUEG_BLOCK_MONTHS } from '../services/compliance.service';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

// GET /api/compliance/aueg
router.get(
  '/aueg',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    const workers = await Worker.find(
      { tenantId, 'auegTracking.monthsWorked': { $gte: AUEG_WARN_MONTHS } },
      { firstName: 1, lastName: 1, email: 1, status: 1, auegTracking: 1 }
    )
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    const result = workers.map((w) => ({
      _id: w._id,
      firstName: w.firstName,
      lastName: w.lastName,
      email: w.email,
      status: w.status,
      auegEntries: w.auegTracking
        .filter((e) => e.monthsWorked >= AUEG_WARN_MONTHS)
        .map((e) => ({
          businessId: e.businessId,
          businessName: e.businessName,
          monthsWorked: e.monthsWorked,
          lastAssignmentDate: e.lastAssignmentDate,
          severity: e.monthsWorked >= AUEG_BLOCK_MONTHS ? 'blocked' : 'warning',
        }))
        .sort((a, b) => b.monthsWorked - a.monthsWorked),
    }));

    res.json(result);
  })
);

export default router;

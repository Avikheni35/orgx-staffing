import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { WorkerRating } from '../models/WorkerRating';
import { Shift } from '../models/Shift';
import { Worker } from '../models/Worker';

const router = Router();
router.use(requireAuth);

const ratingSchema = z.object({
  shiftId: z.string().min(1),
  workerId: z.string().min(1),
  overallRating: z.coerce.number().min(1).max(5),
  punctuality: z.coerce.number().min(1).max(5).optional(),
  quality: z.coerce.number().min(1).max(5).optional(),
  attitude: z.coerce.number().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
});

// GET /api/worker-ratings?workerId=&shiftId=
router.get(
  '/',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };
    if (req.query.workerId) filter.workerId = new Types.ObjectId(req.query.workerId as string);
    if (req.query.shiftId) filter.shiftId = new Types.ObjectId(req.query.shiftId as string);
    const ratings = await WorkerRating.find(filter).sort({ createdAt: -1 }).lean();
    res.json(ratings);
  })
);

// POST /api/worker-ratings — submit rating (business_contact via client portal OR agency staff)
router.post(
  '/',
  requireRole('agency_admin', 'disponent', 'business_contact'),
  validate(ratingSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { shiftId, workerId, overallRating, punctuality, quality, attitude, comment } = req.body as z.infer<typeof ratingSchema>;

    const shift = await Shift.findOne({ _id: shiftId, tenantId }).lean();
    if (!shift) throw new AppError('Schicht nicht gefunden', 404);

    const worker = await Worker.findOne({ _id: workerId, tenantId }).lean();
    if (!worker) throw new AppError('Mitarbeiter nicht gefunden', 404);

    const existing = await WorkerRating.findOne({ tenantId, shiftId, workerId });
    if (existing) throw new AppError('Bewertung für diese Schicht bereits vorhanden', 409);

    const rating = await WorkerRating.create({
      tenantId,
      shiftId,
      workerId,
      businessId: shift.businessId,
      ratedBy: req.user!.userId,
      overallRating,
      punctuality,
      quality,
      attitude,
      comment,
    });

    res.status(201).json(rating);
  })
);

// GET /api/worker-ratings/:id
router.get(
  '/:id',
  requireRole('agency_admin', 'disponent', 'business_contact'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const rating = await WorkerRating.findOne({ _id: req.params.id, tenantId }).lean();
    if (!rating) throw new AppError('Bewertung nicht gefunden', 404);
    res.json(rating);
  })
);

export default router;

import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { ShiftRequest } from '../models/ShiftRequest';
import { Business } from '../models/Business';
import { notify } from '../utils/notify';

const router = Router();
router.use(requireAuth);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  workersNeeded: z.coerce.number().int().min(1).max(100),
  qualifications: z.array(z.string()).optional(),
  locationId: z.string().optional(),
});

const respondSchema = z.object({
  status: z.enum(['accepted', 'declined']),
  agencyNote: z.string().max(1000).optional(),
});

// GET /api/shift-requests
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const role = req.user!.role;
    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };

    if (role === 'business_contact') {
      // Find the business linked to this user
      const biz = await Business.findOne({
        tenantId,
        'contacts.userId': new Types.ObjectId(req.user!.userId),
      }).lean();
      if (!biz) return res.json([]);
      filter.businessId = biz._id;
    }

    if (req.query.status) filter.status = req.query.status;
    const requests = await ShiftRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json(requests);
  })
);

// POST /api/shift-requests — business_contact creates request
router.post(
  '/',
  requireRole('business_contact'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    const biz = await Business.findOne({
      tenantId,
      'contacts.userId': new Types.ObjectId(req.user!.userId),
    }).lean();
    if (!biz) throw new AppError('Kein Unternehmen gefunden', 404);

    const { title, description, date, startTime, endTime, workersNeeded, qualifications, locationId } =
      req.body as z.infer<typeof createSchema>;

    const request = await ShiftRequest.create({
      tenantId,
      businessId: biz._id,
      requestedBy: req.user!.userId,
      locationId,
      title,
      description,
      date: new Date(date),
      startTime,
      endTime,
      workersNeeded,
      qualifications,
    });

    notify({
      tenantId: tenantId.toString(),
      type: 'shift_request' as const,
      title: 'Neue Schichtanfrage',
      body: `${biz.name} hat eine neue Schichtanfrage gestellt: ${title}`,
      link: `/app/shift-requests/${request._id}`,
      recipientRoles: ['agency_admin', 'disponent'],
    });

    res.status(201).json(request);
  })
);

// GET /api/shift-requests/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const request = await ShiftRequest.findOne({ _id: req.params.id, tenantId })
      .populate('businessId', 'name')
      .lean();
    if (!request) throw new AppError('Anfrage nicht gefunden', 404);
    res.json(request);
  })
);

// PATCH /api/shift-requests/:id/respond — agency responds
router.patch(
  '/:id/respond',
  requireRole('agency_admin', 'disponent'),
  validate(respondSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { status, agencyNote } = req.body as z.infer<typeof respondSchema>;

    const request = await ShiftRequest.findOneAndUpdate(
      { _id: req.params.id, tenantId, status: 'pending' },
      { status, agencyNote },
      { new: true }
    );
    if (!request) throw new AppError('Anfrage nicht gefunden oder bereits bearbeitet', 404);
    res.json(request);
  })
);

export default router;

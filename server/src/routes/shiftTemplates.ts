import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { ShiftTemplate } from '../models/ShiftTemplate';
import { Business } from '../models/Business';
import { Tenant } from '../models/Tenant';
import * as shiftService from '../services/shift.service';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

const templateSchema = z.object({
  name:               z.string().min(1).max(100),
  businessId:         z.string().min(1),
  locationId:         z.string().optional(),
  title:              z.string().min(1).max(100),
  startHour:          z.coerce.number().int().min(0).max(23),
  startMinute:        z.coerce.number().int().min(0).max(59).default(0),
  durationHours:      z.coerce.number().min(0.5).max(24),
  breakMinutes:       z.coerce.number().int().min(0).default(0),
  requiredWorkers:    z.coerce.number().int().min(1).default(1),
  payRatePerHour:     z.coerce.number().positive(),
  billingRatePerHour: z.coerce.number().positive().optional(),
  notes:              z.string().optional(),
});

// GET /shift-templates
router.get('/', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId ?? req.tenantId!;
  const templates = await ShiftTemplate.find({ tenantId }).sort({ name: 1 }).lean();
  res.json({ templates });
}));

// POST /shift-templates
router.post('/', validate(templateSchema), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId ?? req.tenantId!;
  const body = req.body as z.infer<typeof templateSchema>;

  const business = await Business.findOne({ _id: body.businessId, tenantId }).lean();
  if (!business) throw new AppError('Unternehmen nicht gefunden.', 404);

  let locationName: string | undefined;
  if (body.locationId) {
    const loc = business.locations?.find((l) => l._id.toString() === body.locationId);
    locationName = (loc as { name?: string } | undefined)?.name;
  }

  const template = await ShiftTemplate.create({
    tenantId,
    name: body.name,
    businessId: business._id,
    businessName: business.name,
    locationId: body.locationId || undefined,
    locationName,
    title: body.title,
    startHour: body.startHour,
    startMinute: body.startMinute,
    durationHours: body.durationHours,
    breakMinutes: body.breakMinutes,
    requiredWorkers: body.requiredWorkers,
    payRatePerHour: body.payRatePerHour,
    billingRatePerHour: body.billingRatePerHour,
    notes: body.notes,
    createdBy: req.user!.userId,
  });
  res.status(201).json(template);
}));

// GET /shift-templates/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId ?? req.tenantId!;
  const template = await ShiftTemplate.findOne({ _id: req.params.id, tenantId }).lean();
  if (!template) throw new AppError('Vorlage nicht gefunden.', 404);
  res.json(template);
}));

// PUT /shift-templates/:id
router.put('/:id', validate(templateSchema.partial()), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId ?? req.tenantId!;
  const body = req.body as Partial<z.infer<typeof templateSchema>>;

  const template = await ShiftTemplate.findOne({ _id: req.params.id, tenantId });
  if (!template) throw new AppError('Vorlage nicht gefunden.', 404);

  if (body.businessId && body.businessId !== template.businessId.toString()) {
    const business = await Business.findOne({ _id: body.businessId, tenantId }).lean();
    if (!business) throw new AppError('Unternehmen nicht gefunden.', 404);
    template.businessId = business._id as unknown as typeof template.businessId;
    template.businessName = business.name;
  }

  const { businessId, ...rest } = body;
  Object.assign(template, rest);
  await template.save();
  res.json(template);
}));

// DELETE /shift-templates/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId ?? req.tenantId!;
  const template = await ShiftTemplate.findOneAndDelete({ _id: req.params.id, tenantId });
  if (!template) throw new AppError('Vorlage nicht gefunden.', 404);
  res.json({ ok: true });
}));

// POST /shift-templates/:id/use — create a shift from this template for a given date
router.post('/:id/use', validate(z.object({ startDate: z.string().min(1) })), asyncHandler(async (req, res) => {
  const tenantId = req.user!.tenantId ?? req.tenantId!;
  const template = await ShiftTemplate.findOne({ _id: req.params.id, tenantId }).lean();
  if (!template) throw new AppError('Vorlage nicht gefunden.', 404);

  const tenant = await Tenant.findById(tenantId).select('complianceSettings').lean();

  const [year, month, day] = (req.body.startDate as string).split('-').map(Number);
  const startTime = new Date(year, month - 1, day, template.startHour, template.startMinute, 0, 0);
  const endTime = new Date(startTime.getTime() + template.durationHours * 3_600_000);

  const shift = await shiftService.createShift(
    tenantId.toString(),
    {
      businessId: template.businessId.toString(),
      locationId: template.locationId?.toString(),
      title: template.title,
      startTime,
      endTime,
      breakMinutes: template.breakMinutes,
      requiredWorkers: template.requiredWorkers,
      payRatePerHour: template.payRatePerHour,
      billingRatePerHour: template.billingRatePerHour,
      status: 'draft',
      notes: template.notes,
    },
    req.user!.userId,
    tenant?.complianceSettings?.mindestlohnOverride
  );
  res.status(201).json(shift);
}));

export default router;

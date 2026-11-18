import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { ContractTemplate } from '../models/ContractTemplate';
import { DEFAULT_TEMPLATE_HTML, PLACEHOLDER_LABELS, resolvePlaceholders, buildPlaceholderData } from '../utils/contractTemplate';

const router = Router();
router.use(requireAuth);
router.use(requireRole('agency_admin'));

const templateSchema = z.object({
  name: z.string().min(1).max(120),
  html: z.string().min(10),
  isDefault: z.boolean().optional(),
});

// GET /api/contract-templates — list + expose placeholder reference
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const templates = await ContractTemplate.find({ tenantId })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();
    res.json({ templates, placeholders: PLACEHOLDER_LABELS, defaultHtml: DEFAULT_TEMPLATE_HTML });
  })
);

// GET /api/contract-templates/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const tpl = await ContractTemplate.findOne({ _id: req.params.id, tenantId }).lean();
    if (!tpl) throw new AppError('Template not found', 404);
    res.json(tpl);
  })
);

// POST /api/contract-templates
router.post(
  '/',
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { name, html, isDefault } = req.body as z.infer<typeof templateSchema>;

    if (isDefault) {
      await ContractTemplate.updateMany({ tenantId }, { isDefault: false });
    }

    const tpl = await ContractTemplate.create({
      tenantId,
      name,
      html,
      isDefault: isDefault ?? false,
      createdBy: req.user!.userId,
    });
    res.status(201).json(tpl);
  })
);

// PUT /api/contract-templates/:id
router.put(
  '/:id',
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { name, html, isDefault } = req.body as z.infer<typeof templateSchema>;

    const tpl = await ContractTemplate.findOne({ _id: req.params.id, tenantId });
    if (!tpl) throw new AppError('Template not found', 404);

    if (isDefault) {
      await ContractTemplate.updateMany({ tenantId, _id: { $ne: tpl._id } }, { isDefault: false });
    }

    tpl.name = name;
    tpl.html = html;
    if (isDefault !== undefined) tpl.isDefault = isDefault;
    await tpl.save();
    res.json(tpl);
  })
);

// PATCH /api/contract-templates/:id/set-default
router.patch(
  '/:id/set-default',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const tpl = await ContractTemplate.findOne({ _id: req.params.id, tenantId });
    if (!tpl) throw new AppError('Template not found', 404);

    await ContractTemplate.updateMany({ tenantId }, { isDefault: false });
    tpl.isDefault = true;
    await tpl.save();
    res.json(tpl);
  })
);

// POST /api/contract-templates/:id/preview — render template with sample data
router.post(
  '/:id/preview',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    let html: string;
    if (req.params.id === 'draft') {
      // Allow previewing unsaved HTML passed in the body
      html = (req.body as { html?: string }).html ?? DEFAULT_TEMPLATE_HTML;
    } else {
      const tpl = await ContractTemplate.findOne({ _id: req.params.id, tenantId }).lean();
      if (!tpl) throw new AppError('Template not found', 404);
      html = tpl.html;
    }

    const sample = buildPlaceholderData({
      workerFirstName: 'Max',
      workerLastName: 'Mustermann',
      workerEmail: 'max.mustermann@example.de',
      agencyName: 'Muster Zeitarbeit GmbH',
      agencyAddress: 'Musterstraße 1, 10115 Berlin',
      businessName: 'Beispielkunde GmbH',
      shiftTitle: 'Servicekraft / Kellner',
      startTime: new Date('2026-07-10T08:00:00'),
      endTime: new Date('2026-07-10T16:00:00'),
      breakMinutes: 30,
      payRatePerHour: 14.50,
    });

    res.json({ html: resolvePlaceholders(html, sample) });
  })
);

// DELETE /api/contract-templates/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const tpl = await ContractTemplate.findOne({ _id: req.params.id, tenantId });
    if (!tpl) throw new AppError('Template not found', 404);
    if (tpl.isDefault) throw new AppError('Cannot delete the default template. Set another template as default first.', 400);
    await tpl.deleteOne();
    res.json({ message: 'Template deleted' });
  })
);

export default router;

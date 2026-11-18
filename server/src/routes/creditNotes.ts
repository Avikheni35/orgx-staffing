import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { CreditNote } from '../models/CreditNote';
import { Invoice } from '../models/Invoice';
import { Tenant } from '../models/Tenant';
import { logAudit } from '../utils/audit';

const router = Router();
router.use(requireAuth);

const lineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  total: z.coerce.number().nonnegative(),
});

const createSchema = z.object({
  invoiceId: z.string().min(1),
  reason: z.string().min(1),
  lineItems: z.array(lineItemSchema).min(1),
  vatRate: z.coerce.number().min(0).max(100).optional(),
});

// GET /api/credit-notes — list for tenant
router.get(
  '/',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { invoiceId } = req.query;
    const filter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };
    if (invoiceId) filter.invoiceId = new Types.ObjectId(invoiceId as string);
    const notes = await CreditNote.find(filter).sort({ createdAt: -1 }).lean();
    res.json(notes);
  })
);

// POST /api/credit-notes
router.post(
  '/',
  requireRole('agency_admin'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { invoiceId, reason, lineItems, vatRate: vatRateInput } = req.body as z.infer<typeof createSchema>;

    const invoice = await Invoice.findOne({ _id: invoiceId, tenantId });
    if (!invoice) throw new AppError('Rechnung nicht gefunden', 404);

    const tenant = await Tenant.findById(tenantId).lean();
    const vatRate = vatRateInput ?? (tenant?.invoiceSettings?.vatRate ?? 19);

    const subtotal = lineItems.reduce((s, li) => s + li.total, 0);
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

    const count = await CreditNote.countDocuments({ tenantId });
    const creditNoteNumber = `GS-${String(count + 1).padStart(4, '0')}`;

    const note = await CreditNote.create({
      tenantId,
      invoiceId,
      creditNoteNumber,
      reason,
      lineItems,
      subtotal,
      vatRate,
      vatAmount,
      totalAmount,
      createdBy: req.user!.userId,
    });

    logAudit({ req, action: 'credit_note.created', targetType: 'CreditNote', targetId: note._id.toString(), targetName: creditNoteNumber });
    res.status(201).json(note);
  })
);

// GET /api/credit-notes/:id
router.get(
  '/:id',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const note = await CreditNote.findOne({ _id: req.params.id, tenantId })
      .populate('invoiceId', 'invoiceNumber')
      .lean();
    if (!note) throw new AppError('Gutschrift nicht gefunden', 404);
    res.json(note);
  })
);

// PATCH /api/credit-notes/:id/issue
router.patch(
  '/:id/issue',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const note = await CreditNote.findOneAndUpdate(
      { _id: req.params.id, tenantId, status: 'draft' },
      { status: 'issued', issuedAt: new Date() },
      { new: true }
    );
    if (!note) throw new AppError('Gutschrift nicht gefunden oder bereits ausgestellt', 404);
    logAudit({ req, action: 'credit_note.issued', targetType: 'CreditNote', targetId: note._id.toString(), targetName: note.creditNoteNumber });
    res.json(note);
  })
);

export default router;

import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { uploadDocument } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';
import * as workerService from '../services/worker.service';
import { Worker } from '../models/Worker';
import { User } from '../models/User';
import { Timesheet } from '../models/Timesheet';
import { Shift } from '../models/Shift';
import { WorkerRating } from '../models/WorkerRating';
import { logAudit } from '../utils/audit';
import { decryptField, encryptField } from '../utils/crypto';
import { AppError } from '../utils/AppError';
import { htmlToPdf, buildPayslipHtml } from '../utils/pdf';
import { Tenant } from '../models/Tenant';
import { applyAnonymizationFields, buildExportBundle } from '../utils/dsgvo';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

const createSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'diverse', 'not_specified']).optional(),
  nationality: z.string().optional(),
  address: z
    .object({
      street: z.string().optional(),
      city: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  skills: z.array(z.string()).optional(),
  languages: z
    .array(z.object({ language: z.string(), level: z.string() }))
    .optional(),
  steuerklasse: z.string().optional(),
  healthInsuranceProvider: z.string().optional(),
});

const statusSchema = z.object({
  status: z.enum(['pending_review', 'active', 'inactive', 'suspended', 'blacklisted']),
  note: z.string().optional(),
});

const sensitiveDataSchema = z.object({
  iban: z.string().max(34).nullable().optional(),
  steuernummer: z.string().max(20).nullable().optional(),
  sozialversicherungsnummer: z.string().max(20).nullable().optional(),
});

// GET /api/workers
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { status, skill, search, page, limit } = req.query as Record<string, string>;
    const result = await workerService.listWorkers(tenantId, {
      status: status as workerService.WorkerFilters['status'],
      skill,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    res.json(result);
  })
);

// GET /api/workers/stats
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const stats = await workerService.getDashboardStats(tenantId);
    res.json(stats);
  })
);

// GET /api/workers/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const safeDecrypt = (v?: string) => { try { return v ? decryptField(v) : undefined; } catch { return undefined; } };
    const result = worker.toObject() as Record<string, unknown>;
    result.iban = safeDecrypt(worker.ibanEncrypted);
    result.steuernummer = safeDecrypt(worker.steuernummerEncrypted);
    result.sozialversicherungsnummer = safeDecrypt(worker.sozialversicherungsnummerEncrypted);
    res.json(result);
  })
);

// POST /api/workers
router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.createWorker(tenantId, req.body, req.user!.userId);
    res.status(201).json(worker);
  })
);

// PUT /api/workers/:id
router.put(
  '/:id',
  validate(createSchema.partial()),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.updateWorker(tenantId, req.params.id, req.body);
    res.json(worker);
  })
);

// PATCH /api/workers/:id/sensitive-data  (agency_admin only — encrypts IBAN, Steuernr., SV-Nr.)
router.patch(
  '/:id/sensitive-data',
  requireRole('agency_admin'),
  validate(sensitiveDataSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const { iban, steuernummer, sozialversicherungsnummer } = req.body as {
      iban?: string | null;
      steuernummer?: string | null;
      sozialversicherungsnummer?: string | null;
    };
    const updatedFields: string[] = [];
    if (iban !== undefined) {
      worker.ibanEncrypted = iban ? encryptField(iban) : undefined;
      updatedFields.push('iban');
    }
    if (steuernummer !== undefined) {
      worker.steuernummerEncrypted = steuernummer ? encryptField(steuernummer) : undefined;
      updatedFields.push('steuernummer');
    }
    if (sozialversicherungsnummer !== undefined) {
      worker.sozialversicherungsnummerEncrypted = sozialversicherungsnummer ? encryptField(sozialversicherungsnummer) : undefined;
      updatedFields.push('sozialversicherungsnummer');
    }
    await worker.save();
    logAudit({
      req,
      action: 'worker.sensitive_data_updated',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { updatedFields },
    });
    res.json({ message: 'Sensible Daten aktualisiert.' });
  })
);

// POST /api/workers/:id/invite
router.post(
  '/:id/invite',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const inviter = await User.findById(req.user!.userId).lean();
    const invitedByName = inviter
      ? `${inviter.firstName} ${inviter.lastName}`.trim() || 'Ihr Disponent'
      : 'Ihr Disponent';
    await workerService.sendWorkerInvite(tenantId, req.params.id, invitedByName);
    res.json({ message: 'Invitation sent' });
  })
);

// POST /api/workers/:id/documents  (multipart/form-data: file?, category, label, expiryDate?)
router.post(
  '/:id/documents',
  (req, res, next) => uploadDocument(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  asyncHandler(async (req, res) => {
    const { category, label, expiryDate } = req.body as Record<string, string>;
    if (!category || !label) return res.status(400).json({ message: 'category and label are required' });
    const validCategories = ['identity', 'work_permit', 'health_certificate', 'contract', 'other'];
    if (!validCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });

    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const fileUrl = req.file ? `/uploads/documents/${req.file.filename}` : '';
    const doc = {
      category,
      label,
      fileUrl,
      expiryDate: expiryDate ? new Date(expiryDate) : undefined,
      verified: false,
      uploadedAt: new Date(),
    };
    worker.documents.push(doc as never);
    await worker.save();
    logAudit({
      req,
      action: 'worker.document_added',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { category, label, hasFile: !!req.file },
    });
    res.status(201).json(worker.documents[worker.documents.length - 1]);
  })
);

// DELETE /api/workers/:id/documents/:docId
router.delete(
  '/:id/documents/:docId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const doc = worker.documents.find((d) => d._id.toString() === req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    const label = doc.label;
    worker.documents = worker.documents.filter((d) => d._id.toString() !== req.params.docId) as never;
    await worker.save();
    logAudit({
      req,
      action: 'worker.document_deleted',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { label },
    });
    res.json({ message: 'Deleted' });
  })
);

// PATCH /api/workers/:id/documents/:docId/verify
router.patch(
  '/:id/documents/:docId/verify',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const doc = worker.documents.find((d) => d._id.toString() === req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    doc.verified = true;
    doc.remark = undefined;
    doc.remarkAt = undefined;
    await worker.save();
    logAudit({
      req,
      action: 'worker.document_verified',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { label: doc.label, category: doc.category },
    });
    res.json(doc);
  })
);

const remarkSchema = z.object({ remark: z.string().min(1).max(500) });

// PATCH /api/workers/:id/documents/:docId/remark
router.patch(
  '/:id/documents/:docId/remark',
  validate(remarkSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const doc = worker.documents.find((d) => d._id.toString() === req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    doc.remark = req.body.remark;
    doc.remarkAt = new Date();
    doc.verified = false;
    await worker.save();
    logAudit({
      req,
      action: 'worker.document_remarked',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { label: doc.label, remark: req.body.remark },
    });
    res.json(doc);
  })
);

// GET /api/workers/:id/availability
router.get(
  '/:id/availability',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    res.json(worker.availability);
  })
);

// PUT /api/workers/:id/availability
router.put(
  '/:id/availability',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.getWorker(tenantId, req.params.id);
    const { weeklyPattern, exceptions, preferredRadiusKm } = req.body as {
      weeklyPattern?: Record<string, boolean>;
      exceptions?: Array<{ date: string; available: boolean; note?: string }>;
      preferredRadiusKm?: number;
    };
    if (weeklyPattern) {
      const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      for (const day of days) {
        if (day in weeklyPattern) {
          (worker.availability.weeklyPattern as Record<string, boolean>)[day] = Boolean(weeklyPattern[day]);
        }
      }
    }
    if (exceptions !== undefined) {
      worker.availability.exceptions = exceptions.map((e) => ({
        date: new Date(e.date),
        available: Boolean(e.available),
        note: e.note,
      }));
    }
    if (preferredRadiusKm !== undefined) {
      worker.availability.preferredRadiusKm = preferredRadiusKm > 0 ? preferredRadiusKm : undefined;
    }
    worker.markModified('availability');
    await worker.save();
    logAudit({
      req,
      action: 'worker.availability_updated',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
    });
    res.json(worker.availability);
  })
);

// PATCH /api/workers/:id/approve
router.patch(
  '/:id/approve',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await workerService.setWorkerStatus(tenantId, req.params.id, 'active', 'Manuell genehmigt');
    logAudit({
      req,
      action: 'worker.approved',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
    });
    res.json(worker);
  })
);

// PATCH /api/workers/:id/reject
router.patch(
  '/:id/reject',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const note = (req.body as { note?: string }).note;
    const worker = await workerService.setWorkerStatus(tenantId, req.params.id, 'inactive', note ?? 'Abgelehnt');
    logAudit({
      req,
      action: 'worker.rejected',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { note },
    });
    res.json(worker);
  })
);

// PATCH /api/workers/:id/status
router.patch(
  '/:id/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const actor = await User.findById(req.user!.userId).select('firstName lastName').lean();
    const previousWorker = await workerService.getWorker(tenantId, req.params.id);
    const worker = await workerService.setWorkerStatus(
      tenantId,
      req.params.id,
      req.body.status,
      req.body.note
    );
    logAudit({
      req,
      action: 'worker.status_changed',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: {
        from: previousWorker.status,
        to: req.body.status,
        note: req.body.note,
        actorName: actor ? `${actor.firstName} ${actor.lastName}` : undefined,
      },
    });
    res.json(worker);
  })
);

// ── DSGVO ────────────────────────────────────────────────────────────────────

// GET /api/workers/:id/export  (Art. 20 — data portability)
// Returns a structured JSON bundle of all personal data held for this worker.
// Restricted to agency_admin — never callable by disponent.
router.get(
  '/:id/export',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await Worker.findOne({ _id: req.params.id, tenantId }).lean();
    if (!worker) throw new AppError('Mitarbeiter nicht gefunden.', 404);

    const [timesheets, shifts, ratings] = await Promise.all([
      Timesheet.find({ workerId: worker._id, tenantId }).sort({ shiftDate: -1 }).lean(),
      Shift.find({ tenantId, 'assignedWorkers.workerId': worker._id })
        .select('startTime endTime title businessName locationName status')
        .sort({ startTime: -1 })
        .lean(),
      WorkerRating.find({ workerId: worker._id, tenantId }).sort({ createdAt: -1 }).lean(),
    ]);

    const safeDecrypt = (v?: string) => {
      if (!v) return undefined;
      try { return decryptField(v); } catch { return '[encrypted]'; }
    };

    const bundle = buildExportBundle(worker, timesheets, shifts, ratings, req.user!.userId, safeDecrypt);

    logAudit({
      req,
      action: 'worker.dsgvo_export',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
    });

    res
      .setHeader('Content-Disposition', `attachment; filename="dsgvo-export-${worker._id}.json"`)
      .setHeader('Content-Type', 'application/json')
      .json(bundle);
  })
);

// POST /api/workers/:id/anonymize  (Art. 17 — right to erasure)
// Irreversibly anonymizes all personal fields while retaining compliance-relevant
// financial and AÜG records per HGB §257 / AO §147. Restricted to agency_admin.
router.post(
  '/:id/anonymize',
  requireRole('agency_admin'),
  validate(z.object({ reason: z.string().min(1).max(500) })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const worker = await Worker.findOne({ _id: req.params.id, tenantId });
    if (!worker) throw new AppError('Mitarbeiter nicht gefunden.', 404);
    if (worker.status === 'anonymized') throw new AppError('Mitarbeiter wurde bereits anonymisiert.', 400);

    const tombstoneId = worker._id.toString().slice(-8);
    applyAnonymizationFields(worker as never, req.body.reason);
    worker.markModified('auegTracking');
    worker.markModified('address');
    worker.markModified('availability');
    await worker.save();

    // Deactivate the linked User account so it can no longer log in
    if (worker.userId) {
      await User.findByIdAndUpdate(worker.userId, {
        status: 'inactive',
        email: `deleted-${tombstoneId}@anonymized.invalid`,
        firstName: 'Gelöschter',
        lastName: 'Mitarbeiter',
        refreshTokenHashes: [],
      });
    }

    logAudit({
      req,
      action: 'worker.dsgvo_anonymized',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `Mitarbeiter (${tombstoneId})`,
      details: { reason: req.body.reason },
    });

    res.json({ message: 'Mitarbeiterdaten wurden erfolgreich anonymisiert.', workerId: worker._id.toString() });
  })
);

// GET /api/workers/:id/payslip?month=YYYY-MM  (agency_admin only)
// Generates an A4 PDF payslip for approved/exported timesheets in a given month.
router.get(
  '/:id/payslip',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { month } = req.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError('Query parameter ?month=YYYY-MM ist erforderlich.', 400);
    }

    const worker = await Worker.findOne({ _id: req.params.id, tenantId }).lean();
    if (!worker) throw new AppError('Mitarbeiter nicht gefunden.', 404);

    const [year, mon] = month.split('-').map(Number);
    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd   = new Date(year, mon, 0, 23, 59, 59, 999);

    const timesheets = await Timesheet.find({
      workerId: worker._id,
      tenantId,
      status: { $in: ['approved', 'exported'] },
      shiftDate: { $gte: monthStart, $lte: monthEnd },
    }).sort({ shiftDate: 1 }).lean();

    const tenant = await Tenant.findById(tenantId).lean();
    const cd = tenant?.companyDetails;
    const address = cd?.address || undefined;

    const safeDecrypt = (v?: string) => {
      if (!v) return undefined;
      try { return decryptField(v); } catch { return undefined; }
    };

    const workerAddress = worker.address
      ? [worker.address.street, `${worker.address.postalCode ?? ''} ${worker.address.city ?? ''}`.trim()].filter(Boolean).join(', ')
      : undefined;

    const rows = timesheets.map((t) => ({
      date: new Date(t.shiftDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      businessName: String(t.businessName ?? ''),
      hours: Number(t.totalHours ?? 0),
      rate: Number(t.payRatePerHour ?? 0),
      gross: Number(t.grossPay ?? 0),
    }));

    const totalHours = rows.reduce((s, r) => s + r.hours, 0);
    const totalGross = rows.reduce((s, r) => s + r.gross, 0);

    const monthLabel = monthStart.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

    const html = buildPayslipHtml({
      agencyName: tenant?.name ?? 'Zeitarbeitsagentur',
      agencyAddress: address,
      workerName: `${worker.firstName} ${worker.lastName}`,
      workerAddress,
      steuerklasse: worker.steuerklasse,
      steuernummer: safeDecrypt(worker.steuernummerEncrypted),
      sozialversicherungsnummer: safeDecrypt(worker.sozialversicherungsnummerEncrypted),
      monthLabel,
      generatedAt: new Date().toLocaleDateString('de-DE'),
      rows,
      totalHours,
      totalGross,
    });

    const pdf = await htmlToPdf(html);
    const filename = `lohnnachweis-${worker.lastName.toLowerCase()}-${month}.pdf`;

    logAudit({
      req,
      action: 'worker.payslip_downloaded',
      targetType: 'Worker',
      targetId: worker._id.toString(),
      targetName: `${worker.firstName} ${worker.lastName}`,
      details: { month },
    });

    res
      .setHeader('Content-Type', 'application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      .send(pdf);
  })
);

// GET /api/workers/documents/all — aggregate all documents across workers
router.get(
  '/documents/all',
  requireRole('agency_admin', 'disponent'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const workers = await Worker.find({ tenantId: new Types.ObjectId(tenantId) })
      .select('_id firstName lastName documents')
      .lean();

    const today = new Date();
    const in30days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const docs = workers.flatMap((w) =>
      w.documents.map((d) => {
        const expiry = d.expiryDate ? new Date(d.expiryDate) : null;
        let expiryStatus: 'valid' | 'expiringSoon' | 'expired' | 'noExpiry' = 'noExpiry';
        if (expiry) {
          if (expiry < today) expiryStatus = 'expired';
          else if (expiry < in30days) expiryStatus = 'expiringSoon';
          else expiryStatus = 'valid';
        }
        return {
          ...d,
          workerId: w._id,
          workerName: `${w.firstName} ${w.lastName}`,
          expiryStatus,
        };
      })
    );

    res.json(docs);
  })
);

export default router;

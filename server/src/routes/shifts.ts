import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as shiftService from '../services/shift.service';
import { Types } from 'mongoose';
import { ShiftApplication } from '../models/ShiftApplication';
import { ShiftOffer } from '../models/ShiftOffer';
import { Shift } from '../models/Shift';
import { Contract } from '../models/Contract';
import { Worker } from '../models/Worker';
import { Tenant } from '../models/Tenant';
import { AppError } from '../utils/AppError';
import { sendEmail, contractEmailHtml } from '../utils/email';
import { buildPlaceholderData, resolveContractHtml } from '../utils/contractTemplate';
import { env } from '../config/env';
import { checkAueg, updateAuegTracking, checkArbzg, AUEG_BLOCK_MONTHS } from '../services/compliance.service';
import { createTimesheetsForShift } from '../services/timesheet.service';
import { Timesheet } from '../models/Timesheet';
import { notify } from '../utils/notify';
import { sendSms } from '../utils/sms';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

const shiftSchema = z.object({
  businessId: z.string().min(1),
  locationId: z.string().optional(),
  title: z.string().min(1).max(100),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  breakMinutes: z.coerce.number().min(0).optional(),
  requiredWorkers: z.coerce.number().int().min(1).optional(),
  payRatePerHour: z.coerce.number().positive(),
  billingRatePerHour: z.coerce.number().positive().optional(),
  status: z.enum(['draft', 'published', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
  repeat: z.object({
    type: z.enum(['daily', 'weekly']),
    count: z.coerce.number().int().min(2).max(52),
  }).optional(),
});

// GET /api/shifts
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { from, to, status, businessId, workerId, page, limit } = req.query as Record<string, string>;
    const result = await shiftService.listShifts(tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      status: status as shiftService.ShiftFilters['status'],
      businessId,
      workerId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    res.json(result);
  })
);

// GET /api/shifts/:shiftId/workers/:workerId — assignment detail
router.get(
  '/:shiftId/workers/:workerId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { shiftId, workerId } = req.params;

    const shift = await Shift.findOne({ _id: shiftId, tenantId }).lean();
    if (!shift) throw new AppError('Shift not found', 404);

    const assignment = shift.assignedWorkers.find(
      (aw) => aw.workerId.toString() === workerId
    );
    if (!assignment) throw new AppError('Assignment not found', 404);

    const [worker, contract, timesheet] = await Promise.all([
      Worker.findOne({ _id: workerId, tenantId })
        .select('firstName lastName email phone status auegTracking rating')
        .lean(),
      Contract.findOne({ tenantId, shiftId: shift._id, workerId }).lean(),
      Timesheet.findOne({ tenantId, shiftId: shift._id, workerId }).lean(),
    ]);

    res.json({ shift, assignment, worker, contract, timesheet });
  })
);

// GET /api/shifts/attendance — must come before /:id to avoid matching 'attendance' as an id
router.get(
  '/attendance',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { date } = req.query as { date?: string };

    const target = date ? new Date(date) : new Date();
    const dayStart = new Date(target);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(target);
    dayEnd.setHours(23, 59, 59, 999);

    const shifts = await Shift.find({
      tenantId,
      startTime: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['published', 'completed'] },
    })
      .sort({ startTime: 1 })
      .lean();

    const result = shifts.map((s) => ({
      _id: s._id,
      title: s.title,
      businessName: s.businessName,
      locationName: s.locationName,
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      completedAt: s.completedAt,
      workers: s.assignedWorkers.map((aw) => ({
        workerId: aw.workerId,
        workerName: aw.workerName,
        status: aw.status,
        checkInTime: aw.checkInTime,
        checkOutTime: aw.checkOutTime,
        checkInLocation: aw.checkInLocation,
      })),
    }));

    res.json(result);
  })
);

// GET /api/shifts/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const shift = await shiftService.getShift(tenantId, req.params.id);
    res.json(shift);
  })
);

// POST /api/shifts
router.post(
  '/',
  validate(shiftSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const tenant = await Tenant.findById(tenantId).select('complianceSettings').lean();
    const { repeat, ...shiftData } = req.body as { repeat?: { type: 'daily' | 'weekly'; count: number }; [k: string]: unknown };

    const baseShiftData = shiftData as unknown as shiftService.CreateShiftData;

    if (!repeat) {
      const shift = await shiftService.createShift(tenantId, baseShiftData, req.user!.userId, tenant?.complianceSettings?.mindestlohnOverride);
      return res.status(201).json(shift);
    }

    const baseStart = new Date(baseShiftData.startTime);
    const baseEnd = new Date(baseShiftData.endTime);
    const durationMs = baseEnd.getTime() - baseStart.getTime();
    const offsetDays = repeat.type === 'weekly' ? 7 : 1;

    const shifts = [];
    for (let i = 0; i < repeat.count; i++) {
      const startTime = new Date(baseStart.getTime() + i * offsetDays * 86_400_000);
      const endTime   = new Date(startTime.getTime() + durationMs);
      const s = await shiftService.createShift(
        tenantId,
        { ...baseShiftData, startTime, endTime },
        req.user!.userId,
        tenant?.complianceSettings?.mindestlohnOverride
      );
      shifts.push(s);
    }
    res.status(201).json({ shifts, count: shifts.length });
  })
);

// PUT /api/shifts/:id
router.put(
  '/:id',
  validate(shiftSchema.partial()),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const tenant = await Tenant.findById(tenantId).select('complianceSettings').lean();
    const shift = await shiftService.updateShift(tenantId, req.params.id, req.body, tenant?.complianceSettings?.mindestlohnOverride);
    res.json(shift);
  })
);

// POST /api/shifts/:id/clone
// Creates a new draft shift by copying all config fields and offsetting times by `offsetDays` (default 7).
// Assigned workers are not copied — the clone starts empty.
router.post(
  '/:id/clone',
  validate(z.object({ offsetDays: z.coerce.number().int().min(1).max(365).optional() })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const source = await Shift.findOne({ _id: req.params.id, tenantId }).lean();
    if (!source) throw new AppError('Schicht nicht gefunden.', 404);

    const offsetMs = ((req.body as { offsetDays?: number }).offsetDays ?? 7) * 86_400_000;
    const newStart = new Date(new Date(source.startTime).getTime() + offsetMs);
    const newEnd   = new Date(new Date(source.endTime).getTime()   + offsetMs);

    const tenant = await Tenant.findById(tenantId).select('complianceSettings').lean();
    const clone = await shiftService.createShift(
      tenantId,
      {
        businessId:         source.businessId.toString(),
        locationId:         source.locationId?.toString(),
        title:              source.title,
        startTime:          newStart,
        endTime:            newEnd,
        breakMinutes:       source.breakMinutes,
        requiredWorkers:    source.requiredWorkers,
        payRatePerHour:     source.payRatePerHour,
        billingRatePerHour: source.billingRatePerHour,
        notes:              source.notes,
        status:             'draft',
      },
      req.user!.userId,
      tenant?.complianceSettings?.mindestlohnOverride
    );

    res.status(201).json(clone);
  })
);

// POST /api/shifts/:id/workers  — assign worker (creates contract + email)
router.post(
  '/:id/workers',
  validate(z.object({ workerId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    const [tenant, worker] = await Promise.all([
      Tenant.findById(tenantId).lean(),
      Worker.findOne({ _id: req.body.workerId, tenantId }).lean(),
    ]);
    if (!worker) throw new AppError('Worker not found', 404);

    const cs = tenant?.complianceSettings;
    const { shift, auegWarning } = await shiftService.assignWorker(
      tenantId, req.params.id, req.body.workerId,
      { auegWarnMonths: cs?.auegWarnMonths, auegBlockMonths: cs?.auegBlockMonths, minRestHoursBetweenShifts: cs?.minRestHoursBetweenShifts }
    );

    // Create contract and send email (same flow as application approval)
    const agencyName = tenant?.name ?? 'Agentur';
    const placeholderData = buildPlaceholderData({
      workerFirstName: worker.firstName,
      workerLastName: worker.lastName,
      workerEmail: worker.email,
      agencyName,
      agencyAddress: tenant?.companyDetails?.address,
      businessName: shift.businessName,
      shiftTitle: shift.title,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      payRatePerHour: shift.payRatePerHour,
    });
    const contractHtml = await resolveContractHtml(tenantId, placeholderData);

    const existingContract = await Contract.findOne({ tenantId, shiftId: shift._id, workerId: worker._id });
    let contract;
    if (!existingContract) {
      contract = await Contract.create({
        tenantId,
        shiftId: shift._id,
        workerId: worker._id,
        workerName: `${worker.firstName} ${worker.lastName}`,
        workerEmail: worker.email,
        agencyName,
        businessName: shift.businessName,
        shiftTitle: shift.title,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        payRatePerHour: shift.payRatePerHour,
        contractHtml,
      });
    } else {
      contract = existingContract;
    }

    const portalUrl = `${env.CLIENT_URL}/worker/contracts/${contract._id}`;
    sendEmail({
      to: worker.email,
      subject: `Vertrag zur Unterzeichnung: ${shift.title} – ${agencyName}`,
      html: contractEmailHtml({
        workerName: `${worker.firstName} ${worker.lastName}`,
        agencyName,
        shiftTitle: shift.title,
        startTime: shift.startTime,
        portalUrl,
      }),
    }).then(() => {
      Contract.findByIdAndUpdate(contract!._id, { emailSentAt: new Date() }).exec();
    }).catch((err) => { console.error('[CONTRACT EMAIL]', err); });

    res.json({ shift, contractId: contract._id, auegWarning });
  })
);

// DELETE /api/shifts/:id/workers/:workerId
router.delete(
  '/:id/workers/:workerId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    // Fetch worker before removal so we have userId for the notification
    const workerDoc = await Worker.findOne({ _id: req.params.workerId, tenantId }).lean();

    const shift = await shiftService.removeWorker(tenantId, req.params.id, req.params.workerId);

    // Void any pending contract so the worker can't sign their way back in
    await Contract.findOneAndUpdate(
      { tenantId, shiftId: shift._id, workerId: req.params.workerId, status: 'pending_signature' },
      { $set: { status: 'voided' } }
    );

    if (workerDoc?.userId) {
      notify({
        tenantId: tenantId.toString(),
        type: 'shift_application',
        title: 'Schicht-Zuweisung aufgehoben',
        body: `Sie wurden aus der Schicht „${shift.title}" entfernt. Ihr Vertrag wurde storniert.`,
        link: '/worker/contracts',
        recipientIds: [workerDoc.userId.toString()],
      });
    }

    res.json(shift);
  })
);

// PATCH /api/shifts/:id/workers/:workerId
router.patch(
  '/:id/workers/:workerId',
  validate(z.object({ status: z.enum(['assigned', 'confirmed', 'completed', 'no_show']) })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const shift = await shiftService.updateWorkerStatus(
      tenantId,
      req.params.id,
      req.params.workerId,
      req.body.status
    );
    res.json(shift);
  })
);

// GET /api/shifts/:id/applications
router.get(
  '/:id/applications',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const applications = await ShiftApplication.find({
      tenantId,
      shiftId: req.params.id,
    })
      .sort({ appliedAt: 1 })
      .lean();
    res.json(applications);
  })
);

// POST /api/shifts/:id/applications/:appId/approve
router.post(
  '/:id/applications/:appId/approve',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    const application = await ShiftApplication.findOne({
      _id: req.params.appId,
      tenantId,
      shiftId: req.params.id,
    });
    if (!application) throw new AppError('Application not found', 404);
    if (application.status !== 'pending') throw new AppError('Application is no longer pending', 400);

    const [shift, worker, tenant] = await Promise.all([
      Shift.findOne({ _id: req.params.id, tenantId }),
      Worker.findOne({ _id: application.workerId, tenantId }).lean(),
      Tenant.findById(tenantId).lean(),
    ]);
    if (!shift) throw new AppError('Shift not found', 404);
    if (!worker) throw new AppError('Worker not found', 404);

    const alreadyAssigned = shift.assignedWorkers.some(
      (aw) => aw.workerId.toString() === application.workerId.toString()
    );

    let auegWarning: { months: number; businessName: string } | null = null;

    if (!alreadyAssigned) {
      const cs = tenant?.complianceSettings;

      // ArbZG: rest check (configurable per tenant, default 11h)
      await checkArbzg(
        application.workerId.toString(),
        tenantId.toString(),
        shift.startTime,
        shift.endTime,
        shift._id.toString(),
        cs?.minRestHoursBetweenShifts
      );

      // AÜG: block/warn thresholds (configurable per tenant)
      const workerFull = await Worker.findOne({ _id: application.workerId, tenantId });
      if (!workerFull) throw new AppError('Worker not found', 404);

      const aueg = checkAueg(workerFull, shift.businessId.toString(), shift.startTime, {
        warnMonths: cs?.auegWarnMonths,
        blockMonths: cs?.auegBlockMonths,
      });
      if (aueg.status === 'blocked') {
        throw new AppError(
          `AÜG-Verstoß: ${application.workerName} hat bereits ${aueg.currentMonths} Monate bei ${aueg.businessName} gearbeitet (Maximum: ${cs?.auegBlockMonths ?? 18} Monate)`,
          400
        );
      }
      if (aueg.status === 'warning') {
        auegWarning = { months: aueg.projectedMonths, businessName: aueg.businessName };
      }

      shift.assignedWorkers.push({
        workerId: application.workerId,
        workerName: application.workerName,
        status: 'assigned',
      });
      shift.markModified('assignedWorkers');
      await shift.save();

      // Update AÜG tracking after successful assignment
      updateAuegTracking(workerFull, shift.businessId, shift.businessName, shift.startTime);
      await workerFull.save();
    }

    application.status = 'approved';
    application.reviewedBy = new Types.ObjectId(req.user!.userId);
    application.reviewedAt = new Date();
    await application.save();

    // Generate contract from template and send email
    const agencyName = tenant?.name ?? 'Agentur';
    const placeholderData = buildPlaceholderData({
      workerFirstName: worker.firstName,
      workerLastName: worker.lastName,
      workerEmail: worker.email,
      agencyName,
      agencyAddress: tenant?.companyDetails?.address,
      businessName: shift.businessName,
      shiftTitle: shift.title,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      payRatePerHour: shift.payRatePerHour,
    });
    const contractHtml = await resolveContractHtml(tenantId, placeholderData);

    const existingContract = await Contract.findOne({
      tenantId,
      shiftId: shift._id,
      workerId: application.workerId,
    });

    let contract;
    if (!existingContract) {
      contract = await Contract.create({
        tenantId,
        shiftId: shift._id,
        workerId: application.workerId,
        workerName: application.workerName,
        workerEmail: worker.email,
        agencyName,
        businessName: shift.businessName,
        shiftTitle: shift.title,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        payRatePerHour: shift.payRatePerHour,
        contractHtml,
      });
    } else {
      contract = existingContract;
    }

    // Send email (non-blocking — don't fail the request if email fails)
    const portalUrl = `${env.CLIENT_URL}/worker/contracts/${contract._id}`;
    sendEmail({
      to: worker.email,
      subject: `Vertrag zur Unterzeichnung: ${shift.title} – ${agencyName}`,
      html: contractEmailHtml({
        workerName: application.workerName,
        agencyName,
        shiftTitle: shift.title,
        startTime: shift.startTime,
        portalUrl,
      }),
    }).then(() => {
      Contract.findByIdAndUpdate(contract!._id, { emailSentAt: new Date() }).exec();
    }).catch((err) => {
      console.error('[CONTRACT EMAIL] Failed to send:', err);
    });

    res.json({ application, contractId: contract._id, auegWarning });
  })
);

// POST /api/shifts/:id/applications/:appId/reject
router.post(
  '/:id/applications/:appId/reject',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    const [application, shiftDoc] = await Promise.all([
      ShiftApplication.findOne({ _id: req.params.appId, tenantId, shiftId: req.params.id }),
      Shift.findOne({ _id: req.params.id, tenantId }).lean(),
    ]);
    if (!application) throw new AppError('Application not found', 404);
    if (application.status !== 'pending') throw new AppError('Application is no longer pending', 400);

    application.status = 'rejected';
    application.reviewedBy = new Types.ObjectId(req.user!.userId);
    application.reviewedAt = new Date();
    await application.save();

    // Notify worker of the rejection
    const workerDoc = await Worker.findOne({ _id: application.workerId, tenantId }).lean();
    if (workerDoc?.userId) {
      notify({
        tenantId: tenantId.toString(),
        type: 'shift_application',
        title: 'Bewerbung abgelehnt',
        body: `Ihre Bewerbung für die Schicht „${shiftDoc?.title ?? ''}" wurde leider abgelehnt.`,
        link: '/worker/available-shifts',
        recipientIds: [workerDoc.userId.toString()],
      });
    }

    res.json(application);
  })
);

// POST /api/shifts/:id/instant-worker — assign first pending applicant, or activate instant booking for all workers
router.post(
  '/:id/instant-worker',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    const shift = await Shift.findOne({ _id: req.params.id, tenantId });
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status === 'completed' || shift.status === 'cancelled') {
      throw new AppError('Shift is not open for assignment', 400);
    }

    const tenant = await Tenant.findById(tenantId).lean();
    const cs = tenant?.complianceSettings;
    const agencyName = tenant?.name ?? 'Agentur';

    const firstApp = await ShiftApplication.findOne({
      shiftId: shift._id,
      tenantId,
      status: 'pending',
    }).sort({ appliedAt: 1 });

    if (firstApp) {
      const worker = await Worker.findOne({ _id: firstApp.workerId, tenantId });
      if (!worker) throw new AppError('Worker not found', 404);

      const alreadyAssigned = shift.assignedWorkers.some(
        (aw) => aw.workerId.toString() === firstApp.workerId.toString()
      );

      let auegWarning: { months: number; businessName: string } | null = null;

      if (!alreadyAssigned) {
        await checkArbzg(
          firstApp.workerId.toString(),
          tenantId.toString(),
          shift.startTime,
          shift.endTime,
          shift._id.toString(),
          cs?.minRestHoursBetweenShifts
        );

        const aueg = checkAueg(worker, shift.businessId.toString(), shift.startTime, {
          warnMonths: cs?.auegWarnMonths,
          blockMonths: cs?.auegBlockMonths,
        });
        if (aueg.status === 'blocked') {
          throw new AppError(
            `AÜG-Verstoß: ${firstApp.workerName} hat bereits ${aueg.currentMonths} Monate bei ${aueg.businessName} gearbeitet`,
            400
          );
        }
        if (aueg.status === 'warning') {
          auegWarning = { months: aueg.projectedMonths, businessName: aueg.businessName };
        }

        shift.assignedWorkers.push({ workerId: firstApp.workerId, workerName: firstApp.workerName, status: 'assigned' });
        shift.markModified('assignedWorkers');
        await shift.save();

        updateAuegTracking(worker, shift.businessId, shift.businessName, shift.startTime);
        await worker.save();
      }

      firstApp.status = 'approved';
      firstApp.reviewedBy = new Types.ObjectId(req.user!.userId);
      firstApp.reviewedAt = new Date();
      await firstApp.save();

      const workerLean = await Worker.findOne({ _id: firstApp.workerId, tenantId }).lean();
      const placeholderData = buildPlaceholderData({
        workerFirstName: worker.firstName,
        workerLastName: worker.lastName,
        workerEmail: worker.email,
        agencyName,
        agencyAddress: tenant?.companyDetails?.address,
        businessName: shift.businessName,
        shiftTitle: shift.title,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        payRatePerHour: shift.payRatePerHour,
      });
      const contractHtml = await resolveContractHtml(tenantId, placeholderData);

      const existingContract = await Contract.findOne({ tenantId, shiftId: shift._id, workerId: firstApp.workerId });
      let contract;
      if (!existingContract) {
        contract = await Contract.create({
          tenantId,
          shiftId: shift._id,
          workerId: firstApp.workerId,
          workerName: firstApp.workerName,
          workerEmail: worker.email,
          agencyName,
          businessName: shift.businessName,
          shiftTitle: shift.title,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          payRatePerHour: shift.payRatePerHour,
          contractHtml,
        });
      } else {
        contract = existingContract;
      }

      const portalUrl = `${env.CLIENT_URL}/worker/contracts/${contract._id}`;
      sendEmail({
        to: worker.email,
        subject: `Vertrag zur Unterzeichnung: ${shift.title} – ${agencyName}`,
        html: contractEmailHtml({ workerName: firstApp.workerName, agencyName, shiftTitle: shift.title, startTime: shift.startTime, portalUrl }),
      }).then(() => {
        Contract.findByIdAndUpdate(contract!._id, { emailSentAt: new Date() }).exec();
      }).catch((err) => { console.error('[CONTRACT EMAIL]', err); });

      // suppress unused var warning
      void workerLean;

      return res.json({ mode: 'assigned', workerName: firstApp.workerName, contractId: contract._id, auegWarning });
    }

    // No applicants — broadcast as instant booking
    shift.isInstantBooking = true;
    await shift.save();

    notify({
      tenantId: tenantId.toString(),
      type: 'shift_application',
      title: 'Sofortbuchung verfügbar',
      body: `Schicht "${shift.title}" ist jetzt als Sofortbuchung verfügbar – direkte Zuweisung ohne Wartezeit.`,
      link: '/worker/available-shifts',
      recipientRoles: ['worker'],
    });

    return res.json({ mode: 'instant_booking' });
  })
);

// ─── Shift Offer endpoints ────────────────────────────────────────────────────

// POST /api/shifts/:id/offers — send offer(s) to one or more workers
router.post(
  '/:id/offers',
  validate(
    z.object({
      workerIds: z.array(z.string().min(1)).min(1).max(20),
      message: z.string().max(500).optional(),
      expiresInHours: z.number().int().min(1).max(168).default(24),
    })
  ),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { workerIds, message, expiresInHours } = req.body as {
      workerIds: string[];
      message?: string;
      expiresInHours: number;
    };

    const shift = await Shift.findOne({ _id: req.params.id, tenantId });
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status === 'cancelled' || shift.status === 'completed') {
      throw new AppError('Cannot send offers for this shift', 400);
    }

    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
    const results: { workerId: string; workerName: string; status: string }[] = [];

    for (const wId of workerIds) {
      const worker = await Worker.findOne({ _id: wId, tenantId }).lean();
      if (!worker) { results.push({ workerId: wId, workerName: 'Unbekannt', status: 'worker_not_found' }); continue; }

      const alreadyAssigned = shift.assignedWorkers.some((aw) => aw.workerId.toString() === wId);
      if (alreadyAssigned) { results.push({ workerId: wId, workerName: `${worker.firstName} ${worker.lastName}`, status: 'already_assigned' }); continue; }

      const conflictingShift = await Shift.findOne({
        tenantId,
        _id: { $ne: shift._id },
        status: { $in: ['draft', 'published'] },
        'assignedWorkers.workerId': new Types.ObjectId(wId),
        startTime: { $lt: shift.endTime },
        endTime: { $gt: shift.startTime },
      }).lean();
      if (conflictingShift) {
        results.push({ workerId: wId, workerName: `${worker.firstName} ${worker.lastName}`, status: 'schedule_conflict' });
        continue;
      }

      try {
        await ShiftOffer.findOneAndUpdate(
          { shiftId: shift._id, workerId: wId },
          {
            $setOnInsert: {
              tenantId,
              shiftId: shift._id,
              workerId: wId,
              workerName: `${worker.firstName} ${worker.lastName}`,
              sentBy: new Types.ObjectId(req.user!.userId),
              status: 'pending',
              message,
              expiresAt,
            },
          },
          { upsert: true, new: true }
        );
        results.push({ workerId: wId, workerName: `${worker.firstName} ${worker.lastName}`, status: 'sent' });
        if (worker.phone) {
          const shiftDate = shift.startTime.toLocaleDateString('de-DE');
          sendSms(worker.phone, `Neues Schichtangebot für ${shiftDate}. Jetzt in der App ansehen.`).catch(console.error);
        }
      } catch {
        results.push({ workerId: wId, workerName: `${worker.firstName} ${worker.lastName}`, status: 'already_offered' });
      }
    }

    res.status(201).json({ results });
  })
);

// GET /api/shifts/:id/offers — list all offers for a shift
router.get(
  '/:id/offers',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const shift = await Shift.findOne({ _id: req.params.id, tenantId }).lean();
    if (!shift) throw new AppError('Shift not found', 404);

    const offers = await ShiftOffer.find({ shiftId: req.params.id, tenantId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(offers);
  })
);

// DELETE /api/shifts/:id/offers/:offerId — cancel a pending offer
router.delete(
  '/:id/offers/:offerId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const offer = await ShiftOffer.findOne({ _id: req.params.offerId, shiftId: req.params.id, tenantId });
    if (!offer) throw new AppError('Offer not found', 404);
    if (offer.status !== 'pending') throw new AppError('Only pending offers can be cancelled', 400);
    offer.status = 'cancelled';
    await offer.save();
    res.json(offer);
  })
);

// ─────────────────────────────────────────────────────────────────────────────

// POST /api/shifts/:id/create-timesheets — manually trigger timesheet creation for a completed shift
router.post(
  '/:id/create-timesheets',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const shift = await Shift.findOne({ _id: req.params.id, tenantId });
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status !== 'completed') throw new AppError('Timesheets can only be created for completed shifts', 400);

    const newlyCreated = await createTimesheetsForShift(tenantId, shift);

    const timesheets = await Timesheet.find({ shiftId: shift._id, tenantId }).lean();
    res.json({ created: newlyCreated, total: timesheets.length, timesheets });
  })
);

export default router;

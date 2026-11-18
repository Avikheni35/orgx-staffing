import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { uploadDocument } from '../middleware/upload';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Worker } from '../models/Worker';
import { Shift } from '../models/Shift';
import { Timesheet } from '../models/Timesheet';
import { ShiftApplication } from '../models/ShiftApplication';
import { ShiftOffer } from '../models/ShiftOffer';
import { Contract } from '../models/Contract';
import { Tenant } from '../models/Tenant';
import { Types } from 'mongoose';
import { buildPlaceholderData, resolveContractHtml } from '../utils/contractTemplate';
import { sendEmail, contractEmailHtml } from '../utils/email';
import { checkAueg, updateAuegTracking, checkArbzg } from '../services/compliance.service';
import { env } from '../config/env';
import { Message } from '../models/Message';
import { notify } from '../utils/notify';
import { createTimesheetsForShift } from '../services/timesheet.service';
import { encryptField, decryptField } from '../utils/crypto';

const router = Router();
router.use(requireAuth);
router.use(requireRole('worker'));

async function resolveWorker(userId: string, tenantId: string) {
  const worker = await Worker.findOne({ userId, tenantId });
  if (!worker) throw new AppError('Worker profile not found', 404);
  return worker;
}

// GET /api/worker-portal/me
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const now = new Date();

    const [upcomingConfirmed, pendingTimesheets, pendingApplications, pendingOffers, nextShift] = await Promise.all([
      Shift.countDocuments({
        tenantId: req.user!.tenantId,
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: 'confirmed' } },
        startTime: { $gte: now },
      }),
      Timesheet.countDocuments({ tenantId: req.user!.tenantId, workerId: worker._id, status: 'pending' }),
      ShiftApplication.countDocuments({ tenantId: req.user!.tenantId, workerId: worker._id, status: 'pending' }),
      ShiftOffer.countDocuments({ tenantId: req.user!.tenantId, workerId: worker._id, status: 'pending', expiresAt: { $gt: now } }),
      Shift.findOne({
        tenantId: req.user!.tenantId,
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: { $in: ['assigned', 'confirmed'] } } },
        status: { $in: ['draft', 'published'] },
        startTime: { $gte: now },
      }).sort({ startTime: 1 }).lean(),
    ]);

    const workerIdStr = worker._id.toString();
    const nextShiftWithStatus = nextShift
      ? {
          ...nextShift,
          myStatus: nextShift.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.status,
        }
      : null;

    res.json({ worker, upcomingConfirmed, pendingTimesheets, pendingApplications, pendingOffers, nextShift: nextShiftWithStatus });
  })
);

// GET /api/worker-portal/available-shifts — published shifts the worker hasn't applied to or been assigned to
router.get(
  '/available-shifts',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const [myApplications, assignedShifts] = await Promise.all([
      ShiftApplication.find({ tenantId: req.user!.tenantId, workerId: worker._id }).lean(),
      Shift.find({ tenantId: req.user!.tenantId, 'assignedWorkers.workerId': worker._id }).lean(),
    ]);

    const excludeIds = [
      ...myApplications.map((a) => a.shiftId.toString()),
      ...assignedShifts.map((s) => s._id.toString()),
    ];

    const now = new Date();
    const shifts = await Shift.find({
      tenantId: req.user!.tenantId,
      status: 'published',
      _id: { $nin: excludeIds },
      $or: [
        { startTime: { $gte: now } },                              // normal upcoming shifts
        { isInstantBooking: true, endTime: { $gte: now } },       // overdue shifts activated as instant booking (still within window)
      ],
    })
      .sort({ isInstantBooking: -1, startTime: 1 })               // instant bookings float to top
      .limit(100)
      .lean();

    res.json(shifts);
  })
);

// POST /api/worker-portal/shifts/:shiftId/apply
router.post(
  '/shifts/:shiftId/apply',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    if (worker.status !== 'active') {
      throw new AppError('Nur aktive Mitarbeiter können sich für Schichten bewerben.', 403);
    }

    const shift = await Shift.findOne({
      _id: req.params.shiftId,
      tenantId: req.user!.tenantId,
      status: 'published',
    }).lean();
    if (!shift) throw new AppError('Shift not found or not open for applications', 404);

    const alreadyAssigned = shift.assignedWorkers.some(
      (aw) => aw.workerId.toString() === worker._id.toString()
    );
    if (alreadyAssigned) throw new AppError('You are already assigned to this shift', 409);

    const existing = await ShiftApplication.findOne({
      shiftId: shift._id,
      workerId: worker._id,
    });
    if (existing) throw new AppError('You have already applied for this shift', 409);

    const conflictingShift = await Shift.findOne({
      tenantId: req.user!.tenantId,
      _id: { $ne: shift._id },
      status: { $in: ['draft', 'published'] },
      'assignedWorkers.workerId': worker._id,
      startTime: { $lt: shift.endTime },
      endTime: { $gt: shift.startTime },
    }).lean();
    if (conflictingShift) {
      throw new AppError(
        `Du bist für diesen Zeitraum bereits in einer anderen Schicht eingeplant (${conflictingShift.title}).`,
        409
      );
    }

    const application = await ShiftApplication.create({
      tenantId: req.user!.tenantId,
      shiftId: shift._id,
      workerId: worker._id,
      workerName: `${worker.firstName} ${worker.lastName}`,
    });

    notify({
      tenantId: req.user!.tenantId!,
      type: 'shift_application',
      title: 'Neue Bewerbung',
      body: `${worker.firstName} ${worker.lastName} hat sich für eine Schicht beworben.`,
      link: `/app/shifts/${shift._id}`,
      recipientRoles: ['agency_admin', 'disponent'],
    });

    res.status(201).json(application);
  })
);

// POST /api/worker-portal/shifts/:shiftId/instant-book — direct assignment for instant-booking shifts (no approval queue)
router.post(
  '/shifts/:shiftId/instant-book',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    if (worker.status !== 'active') {
      throw new AppError('Nur aktive Mitarbeiter können Schichten sofortbuchen.', 403);
    }

    const shift = await Shift.findOne({
      _id: req.params.shiftId,
      tenantId: req.user!.tenantId,
      status: 'published',
      isInstantBooking: true,
    });
    if (!shift) throw new AppError('Schicht nicht verfügbar oder keine Sofortbuchung aktiv.', 404);

    const alreadyAssigned = shift.assignedWorkers.some(
      (aw) => aw.workerId.toString() === worker._id.toString()
    );
    if (alreadyAssigned) throw new AppError('Du bist bereits dieser Schicht zugewiesen.', 409);

    const conflictingShift = await Shift.findOne({
      tenantId: req.user!.tenantId,
      _id: { $ne: shift._id },
      status: { $in: ['draft', 'published'] },
      'assignedWorkers.workerId': worker._id,
      startTime: { $lt: shift.endTime },
      endTime: { $gt: shift.startTime },
    }).lean();
    if (conflictingShift) {
      throw new AppError(
        `Du bist für diesen Zeitraum bereits in einer anderen Schicht eingeplant (${conflictingShift.title}).`,
        409
      );
    }

    const tenant = await Tenant.findById(req.user!.tenantId).lean();
    const cs = tenant?.complianceSettings;
    const workerName = `${worker.firstName} ${worker.lastName}`;

    await checkArbzg(
      worker._id.toString(),
      req.user!.tenantId!.toString(),
      shift.startTime,
      shift.endTime,
      shift._id.toString(),
      cs?.minRestHoursBetweenShifts
    );

    const workerFull = await Worker.findOne({ _id: worker._id, tenantId: req.user!.tenantId });
    if (!workerFull) throw new AppError('Worker not found', 404);

    const aueg = checkAueg(workerFull, shift.businessId.toString(), shift.startTime, {
      warnMonths: cs?.auegWarnMonths,
      blockMonths: cs?.auegBlockMonths,
    });
    if (aueg.status === 'blocked') {
      throw new AppError(
        `AÜG-Verstoß: ${workerName} hat bereits ${aueg.currentMonths} Monate bei ${aueg.businessName} gearbeitet`,
        400
      );
    }
    const auegWarning = aueg.status === 'warning'
      ? { months: aueg.projectedMonths, businessName: aueg.businessName }
      : null;

    // Directly assign worker
    shift.assignedWorkers.push({ workerId: worker._id, workerName, status: 'assigned' });
    if (shift.assignedWorkers.length >= shift.requiredWorkers) {
      shift.isInstantBooking = false;
    }
    shift.markModified('assignedWorkers');
    await shift.save();

    // Approved application for audit trail
    const existingApp = await ShiftApplication.findOne({ shiftId: shift._id, workerId: worker._id });
    if (!existingApp) {
      await ShiftApplication.create({
        tenantId: req.user!.tenantId,
        shiftId: shift._id,
        workerId: worker._id,
        workerName,
        status: 'approved',
        reviewedAt: new Date(),
      });
    }

    updateAuegTracking(workerFull, shift.businessId, shift.businessName, shift.startTime);
    await workerFull.save();

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
    const contractHtml = await resolveContractHtml(req.user!.tenantId!.toString(), placeholderData);

    const existingContract = await Contract.findOne({
      tenantId: req.user!.tenantId,
      shiftId: shift._id,
      workerId: worker._id,
    });
    let contract;
    if (!existingContract) {
      contract = await Contract.create({
        tenantId: req.user!.tenantId,
        shiftId: shift._id,
        workerId: worker._id,
        workerName,
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
      html: contractEmailHtml({ workerName, agencyName, shiftTitle: shift.title, startTime: shift.startTime, portalUrl }),
    }).then(() => {
      Contract.findByIdAndUpdate(contract!._id, { emailSentAt: new Date() }).exec();
    }).catch((err) => { console.error('[CONTRACT EMAIL]', err); });

    notify({
      tenantId: req.user!.tenantId!,
      type: 'shift_application',
      title: 'Sofortbuchung',
      body: `${workerName} hat die Schicht "${shift.title}" sofort gebucht.`,
      link: `/app/shifts/${shift._id}`,
      recipientRoles: ['agency_admin', 'disponent'],
    });

    res.status(201).json({ contractId: contract._id, auegWarning });
  })
);

// GET /api/worker-portal/applications
router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const applications = await ShiftApplication.find({
      tenantId: req.user!.tenantId,
      workerId: worker._id,
    })
      .sort({ appliedAt: -1 })
      .limit(100)
      .lean();

    // Populate shift info for each application
    const shiftIds = applications.map((a) => a.shiftId);
    const shifts = await Shift.find({ _id: { $in: shiftIds } }).lean();
    const shiftMap = Object.fromEntries(shifts.map((s) => [s._id.toString(), s]));

    const result = applications.map((app) => ({
      ...app,
      shift: shiftMap[app.shiftId.toString()] ?? null,
    }));

    res.json(result);
  })
);

// GET /api/worker-portal/shifts — my approved/assigned shifts (to confirm)
router.get(
  '/shifts',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const { tab = 'to-confirm' } = req.query as { tab?: string };

    const workerIdStr = worker._id.toString();

    if (tab === 'to-confirm') {
      const now = new Date();
      const shifts = await Shift.find({
        tenantId: req.user!.tenantId,
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: 'assigned' } },
        status: { $in: ['draft', 'published'] },
        $or: [
          { startTime: { $gte: now } },             // normal upcoming
          { endTime: { $gte: now } },               // overdue shift still in progress (includes instant bookings)
        ],
      })
        .sort({ startTime: 1 })
        .lean();

      const shiftIds = shifts.map((s) => s._id);
      const contracts = await Contract.find({
        tenantId: req.user!.tenantId,
        workerId: worker._id,
        shiftId: { $in: shiftIds },
      }).lean();
      const contractByShift = new Map(contracts.map((c) => [c.shiftId.toString(), c]));

      return res.json(
        shifts.map((s) => ({
          ...s,
          myStatus: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.status,
          myCompletedAt: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.completedAt ?? null,
          myContract: contractByShift.get(s._id.toString()) ?? null,
        }))
      );
    }

    if (tab === 'timeline') {
      const shifts = await Shift.find({
        tenantId: req.user!.tenantId,
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: 'confirmed' } },
      })
        .sort({ startTime: 1 })
        .lean();

      return res.json(
        shifts.map((s) => ({
          ...s,
          myStatus: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.status,
          myCompletedAt: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.completedAt ?? null,
        }))
      );
    }

    if (tab === 'upcoming') {
      const shifts = await Shift.find({
        tenantId: req.user!.tenantId,
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: { $in: ['assigned', 'confirmed'] } } },
        startTime: { $gte: new Date() },
      })
        .sort({ startTime: 1 })
        .lean();

      return res.json(
        shifts.map((s) => ({
          ...s,
          myStatus: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.status,
          myCompletedAt: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.completedAt ?? null,
        }))
      );
    }

    if (tab === 'completed') {
      const shifts = await Shift.find({
        tenantId: req.user!.tenantId,
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: 'completed' } },
      })
        .sort({ startTime: -1 })
        .lean();

      return res.json(
        shifts.map((s) => ({
          ...s,
          myStatus: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.status,
          myCompletedAt: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.completedAt ?? null,
        }))
      );
    }

    // 'all' fallback
    const shifts = await Shift.find({
      tenantId: req.user!.tenantId,
      'assignedWorkers.workerId': worker._id,
    })
      .sort({ startTime: -1 })
      .lean();

    res.json(
      shifts.map((s) => ({
        ...s,
        myStatus: s.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr)?.status,
      }))
    );
  })
);

// GET /api/worker-portal/shifts/:shiftId
router.get(
  '/shifts/:shiftId',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const shift = await Shift.findOne({
      _id: req.params.shiftId,
      tenantId: req.user!.tenantId,
    }).lean();
    if (!shift) throw new AppError('Shift not found', 404);

    const workerIdStr = worker._id.toString();
    const myAssignment = shift.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr);

    // Also check if worker has an application and a contract
    const [myApplication, myContract] = await Promise.all([
      ShiftApplication.findOne({ shiftId: shift._id, workerId: worker._id }).lean(),
      Contract.findOne({ shiftId: shift._id, workerId: worker._id, tenantId: req.user!.tenantId }).lean(),
    ]);

    res.json({
      ...shift,
      myStatus: myAssignment?.status ?? null,
      myCompletedAt: myAssignment?.completedAt ?? null,
      myCheckInTime: myAssignment?.checkInTime ?? null,
      myCheckOutTime: myAssignment?.checkOutTime ?? null,
      myApplication: myApplication ?? null,
      myContract: myContract ?? null,
    });
  })
);

// GET /api/worker-portal/contracts — all worker's contracts
router.get(
  '/contracts',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const tenantId = req.user!.tenantId!;

    // Auto-void any pending contracts that overlap with an already-signed contract
    const [signedContracts, pendingContracts] = await Promise.all([
      Contract.find({ tenantId, workerId: worker._id, status: 'signed' }).lean(),
      Contract.find({ tenantId, workerId: worker._id, status: 'pending_signature' }).lean(),
    ]);

    if (signedContracts.length > 0 && pendingContracts.length > 0) {
      // Load shifts for signed contracts to get time windows
      const signedShiftIds = signedContracts.map((c) => c.shiftId);
      const signedShifts = await Shift.find({ _id: { $in: signedShiftIds }, tenantId }).lean();

      for (const pending of pendingContracts) {
        const pendingShift = await Shift.findOne({ _id: pending.shiftId, tenantId }).lean();
        if (!pendingShift) continue;

        const overlaps = signedShifts.some(
          (ss) =>
            ss._id.toString() !== pendingShift._id.toString() &&
            ss.startTime < pendingShift.endTime &&
            ss.endTime > pendingShift.startTime
        );

        if (overlaps) {
          await Contract.findByIdAndUpdate(pending._id, { $set: { status: 'voided' } });

          // Remove worker from that shift and revert application
          const pendingShiftDoc = await Shift.findById(pendingShift._id);
          if (pendingShiftDoc) {
            pendingShiftDoc.assignedWorkers = pendingShiftDoc.assignedWorkers.filter(
              (aw) => aw.workerId.toString() !== worker._id.toString()
            );
            pendingShiftDoc.markModified('assignedWorkers');
            await pendingShiftDoc.save();
          }
          await ShiftApplication.updateOne(
            { shiftId: pending.shiftId, workerId: worker._id, status: 'approved' },
            { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
          );
        }
      }
    }

    const contracts = await Contract.find({ tenantId, workerId: worker._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(contracts);
  })
);

// GET /api/worker-portal/contracts/:contractId — view a specific contract
router.get(
  '/contracts/:contractId',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const contract = await Contract.findOne({
      _id: req.params.contractId,
      tenantId: req.user!.tenantId,
      workerId: worker._id,
    }).lean();
    if (!contract) throw new AppError('Contract not found', 404);
    res.json(contract);
  })
);

// POST /api/worker-portal/contracts/:contractId/sign
router.post(
  '/contracts/:contractId/sign',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const contract = await Contract.findOne({
      _id: req.params.contractId,
      tenantId: req.user!.tenantId,
      workerId: worker._id,
    });
    if (!contract) throw new AppError('Contract not found', 404);
    if (contract.status === 'signed') throw new AppError('Contract is already signed', 400);
    if (contract.status === 'voided') throw new AppError('This contract has been voided', 400);

    const { signatureData } = req.body as { signatureData: string };
    if (!signatureData || signatureData.trim().length < 2) {
      throw new AppError('A valid signature is required', 400);
    }

    // Reject if an already-signed contract covers an overlapping shift
    const thisShift = await Shift.findOne({ _id: contract.shiftId, tenantId: req.user!.tenantId }).lean();
    if (thisShift) {
      const conflictingSigned = await Contract.findOne({
        tenantId: req.user!.tenantId,
        workerId: worker._id,
        status: 'signed',
        _id: { $ne: contract._id },
      }).lean();
      if (conflictingSigned) {
        const conflictShift = await Shift.findOne({ _id: conflictingSigned.shiftId, tenantId: req.user!.tenantId }).lean();
        if (
          conflictShift &&
          conflictShift.startTime < thisShift.endTime &&
          conflictShift.endTime > thisShift.startTime
        ) {
          // Auto-void this contract before rejecting
          contract.status = 'voided';
          await contract.save();
          throw new AppError(
            `Dieser Vertrag überschneidet sich mit einer bereits bestätigten Schicht („${conflictShift.title}") und wurde automatisch storniert.`,
            409
          );
        }
      }
    }

    contract.status = 'signed';
    contract.signedAt = new Date();
    contract.signatureData = signatureData.trim();
    contract.signedIp = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    await contract.save();

    const tenantId = req.user!.tenantId!;
    const workerUserId = req.user!.userId;

    // Advance the worker's assignment to 'confirmed'
    const shift = await Shift.findOne({ _id: contract.shiftId, tenantId });
    if (shift) {
      const workerIdStr = worker._id.toString();
      const assignment = shift.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr);
      if (assignment && assignment.status === 'assigned') {
        assignment.status = 'confirmed';
        shift.markModified('assignedWorkers');
        await shift.save();
      }

      // ── 1. If shift is now fully staffed, void remaining 'assigned' (unsigned) workers ──
      const confirmedCount = shift.assignedWorkers.filter(
        (aw) => aw.status === 'confirmed' || aw.status === 'completed'
      ).length;
      if (confirmedCount >= shift.requiredWorkers) {
        const unsignedWorkerIds = shift.assignedWorkers
          .filter((aw) => aw.status === 'assigned')
          .map((aw) => aw.workerId);

        if (unsignedWorkerIds.length > 0) {
          // Void their contracts
          await Contract.updateMany(
            { tenantId, shiftId: shift._id, workerId: { $in: unsignedWorkerIds }, status: 'pending_signature' },
            { $set: { status: 'voided' } }
          );

          // Remove them from the shift
          shift.assignedWorkers = shift.assignedWorkers.filter((aw) => aw.status !== 'assigned');
          shift.markModified('assignedWorkers');
          await shift.save();

          // Revert their applications & notify each
          const unsignedWorkerDocs = await Worker.find({ _id: { $in: unsignedWorkerIds }, tenantId }).lean();
          for (const uw of unsignedWorkerDocs) {
            await ShiftApplication.updateOne(
              { shiftId: shift._id, workerId: uw._id, status: 'approved' },
              { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
            );
            if (uw.userId) {
              notify({
                tenantId,
                type: 'contract_signed',
                title: 'Schicht bereits besetzt',
                body: `Die Schicht „${shift.title}" wurde von einer anderen Person bestätigt. Ihr Vertrag wurde automatisch storniert.`,
                link: '/worker/contracts',
                recipientIds: [uw.userId.toString()],
              });
            }
          }
        }
      }

      // ── 2. Void contracts for other overlapping shifts this worker is assigned to ──
      const overlappingShifts = await Shift.find({
        tenantId,
        _id: { $ne: shift._id },
        'assignedWorkers': { $elemMatch: { workerId: worker._id, status: 'assigned' } },
        startTime: { $lt: shift.endTime },
        endTime: { $gt: shift.startTime },
      });

      for (const overlapShift of overlappingShifts) {
        await Contract.findOneAndUpdate(
          { tenantId, shiftId: overlapShift._id, workerId: worker._id, status: 'pending_signature' },
          { $set: { status: 'voided' } }
        );

        overlapShift.assignedWorkers = overlapShift.assignedWorkers.filter(
          (aw) => aw.workerId.toString() !== workerIdStr
        );
        overlapShift.markModified('assignedWorkers');
        await overlapShift.save();

        await ShiftApplication.updateOne(
          { shiftId: overlapShift._id, workerId: worker._id, status: 'approved' },
          { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
        );

        notify({
          tenantId,
          type: 'contract_signed',
          title: 'Überschneidender Vertrag storniert',
          body: `Ihr Vertrag für „${overlapShift.title}" wurde automatisch storniert, da er sich mit dem unterzeichneten Vertrag überschneidet.`,
          link: '/worker/contracts',
          recipientIds: [workerUserId],
        });
      }
    }

    notify({
      tenantId,
      type: 'contract_signed',
      title: 'Vertrag unterzeichnet',
      body: `${worker.firstName} ${worker.lastName} hat einen Vertrag unterzeichnet.`,
      link: `/app/contracts/${contract._id}`,
      recipientRoles: ['agency_admin', 'disponent'],
    });

    res.json({ success: true, signedAt: contract.signedAt });
  })
);

// GET /api/worker-portal/contracts/:contractId/pdf
router.get(
  '/contracts/:contractId/pdf',
  asyncHandler(async (req, res) => {
    const { htmlToPdf: toPdf, buildContractPdfHtml: buildHtml } = await import('../utils/pdf');
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const contract = await Contract.findOne({
      _id: req.params.contractId,
      workerId: worker._id,
      tenantId: req.user!.tenantId,
    }).lean();
    if (!contract) throw new AppError('Contract not found', 404);

    const fullHtml = buildHtml(contract.contractHtml, contract.signatureData, contract.signedAt);
    const pdf = await toPdf(fullHtml);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Vertrag_${contract.shiftTitle.replace(/\s+/g, '_')}.pdf"`);
    res.end(pdf);
  })
);

// PATCH /api/worker-portal/:shiftId/complete — worker self-completes after shift has started
router.patch(
  '/:shiftId/complete',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const shift = await Shift.findOne({
      _id: req.params.shiftId,
      tenantId: req.user!.tenantId,
    });
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status === 'cancelled') throw new AppError('Cannot complete a cancelled shift', 400);

    if (new Date() < new Date(shift.startTime)) {
      throw new AppError('Shift has not started yet', 400);
    }

    const workerIdStr = worker._id.toString();
    const assignment = shift.assignedWorkers.find(
      (aw) => aw.workerId.toString() === workerIdStr
    );
    if (!assignment) throw new AppError('You are not assigned to this shift', 403);
    if (assignment.status !== 'confirmed') {
      throw new AppError('You must confirm attendance before completing the shift', 400);
    }

    assignment.status = 'completed';
    assignment.completedAt = new Date();
    shift.markModified('assignedWorkers');
    await shift.save();

    // Auto-complete the shift when every non-no_show worker has completed
    const tenantId = req.user!.tenantId!;
    const activeWorkers = shift.assignedWorkers.filter((aw) => aw.status !== 'no_show');
    const allDone = activeWorkers.length > 0 && activeWorkers.every((aw) => aw.status === 'completed');
    if (allDone && shift.status !== 'completed') {
      shift.status = 'completed';
      shift.completedAt = new Date();
      await shift.save();
      await createTimesheetsForShift(tenantId, shift);
    }

    res.json({ success: true, completedAt: assignment.completedAt, shiftCompleted: allDone });
  })
);

// DELETE /api/worker-portal/shifts/:shiftId/application — withdraw a pending application
router.delete(
  '/shifts/:shiftId/application',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const application = await ShiftApplication.findOne({
      shiftId: req.params.shiftId,
      workerId: worker._id,
      tenantId: req.user!.tenantId,
    });
    if (!application) throw new AppError('Keine Bewerbung gefunden', 404);
    if (application.status !== 'pending') {
      throw new AppError('Nur ausstehende Bewerbungen können zurückgezogen werden', 400);
    }

    await application.deleteOne();
    res.json({ success: true });
  })
);

// POST /api/worker-portal/:shiftId/checkin
router.post(
  '/:shiftId/checkin',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const { lat, lng, accuracy } = req.body as { lat?: number; lng?: number; accuracy?: number };

    const shift = await Shift.findOne({ _id: req.params.shiftId, tenantId: req.user!.tenantId });
    if (!shift) throw new AppError('Shift not found', 404);
    if (shift.status === 'cancelled') throw new AppError('Cannot check in to a cancelled shift', 400);

    const workerIdStr = worker._id.toString();
    const assignment = shift.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr);
    if (!assignment) throw new AppError('You are not assigned to this shift', 403);
    if (assignment.checkInTime) throw new AppError('Already checked in', 400);

    const now = new Date();
    // Allow check-in up to 1 hour before the shift starts
    if (now < new Date(new Date(shift.startTime).getTime() - 3_600_000)) {
      throw new AppError('Check-in is not yet available for this shift', 400);
    }

    assignment.checkInTime = now;
    if (lat !== undefined && lng !== undefined) {
      assignment.checkInLocation = { lat, lng, accuracy };
    }
    if (assignment.status === 'assigned') {
      assignment.status = 'confirmed';
    }
    shift.markModified('assignedWorkers');
    await shift.save();
    res.json({ success: true, checkInTime: assignment.checkInTime });
  })
);

// POST /api/worker-portal/:shiftId/checkout
router.post(
  '/:shiftId/checkout',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const shift = await Shift.findOne({ _id: req.params.shiftId, tenantId: req.user!.tenantId });
    if (!shift) throw new AppError('Shift not found', 404);

    const workerIdStr = worker._id.toString();
    const assignment = shift.assignedWorkers.find((aw) => aw.workerId.toString() === workerIdStr);
    if (!assignment) throw new AppError('You are not assigned to this shift', 403);
    if (!assignment.checkInTime) throw new AppError('You have not checked in yet', 400);
    if (assignment.checkOutTime) throw new AppError('Already checked out', 400);

    const now = new Date();
    assignment.checkOutTime = now;
    assignment.status = 'completed';
    assignment.completedAt = now;
    shift.markModified('assignedWorkers');

    // Auto-complete the shift when every assigned worker has checked out
    const allCheckedOut = shift.assignedWorkers.every((aw) => aw.status === 'completed');
    const shouldComplete = allCheckedOut && shift.status !== 'completed';
    if (shouldComplete) {
      shift.status = 'completed';
      shift.completedAt = now;
    }

    await shift.save();

    if (shouldComplete) {
      await createTimesheetsForShift(req.user!.tenantId!, shift);
    }

    res.json({ success: true, checkOutTime: now });
  })
);

// GET /api/worker-portal/availability
router.get(
  '/availability',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    res.json(worker.availability);
  })
);

// PUT /api/worker-portal/availability
router.put(
  '/availability',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
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
    res.json(worker.availability);
  })
);

// GET /api/worker-portal/timesheets
router.get(
  '/timesheets',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const { status } = req.query as { status?: string };

    const query: Record<string, unknown> = {
      tenantId: req.user!.tenantId,
      workerId: worker._id,
    };
    if (status && status !== 'all') query.status = status;

    const timesheets = await Timesheet.find(query).sort({ shiftDate: -1 }).limit(100).lean();
    res.json(timesheets);
  })
);

// GET /api/worker-portal/timesheets/:id
router.get(
  '/timesheets/:id',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const ts = await Timesheet.findOne({ _id: req.params.id, tenantId: req.user!.tenantId, workerId: worker._id });
    if (!ts) throw new AppError('Timesheet not found', 404);
    res.json(ts);
  })
);

// POST /api/worker-portal/timesheets/:id/dispute
router.post(
  '/timesheets/:id/dispute',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const { reason } = req.body as { reason?: string };
    if (!reason || reason.trim().length < 5) throw new AppError('Dispute reason is required (min 5 characters)', 400);

    const ts = await Timesheet.findOne({ _id: req.params.id, tenantId: req.user!.tenantId, workerId: worker._id });
    if (!ts) throw new AppError('Timesheet not found', 404);
    if (ts.status === 'exported') throw new AppError('Cannot dispute an exported timesheet', 400);
    if (ts.status === 'disputed') throw new AppError('Timesheet is already disputed', 400);

    ts.status = 'disputed';
    ts.disputeReason = reason.trim();
    await ts.save();

    notify({
      tenantId: req.user!.tenantId!,
      type: 'timesheet_dispute',
      title: 'Stundenzettel bestritten',
      body: `${worker.firstName} ${worker.lastName} hat einen Stundenzettel bestritten: ${reason.trim().slice(0, 80)}`,
      link: `/app/timesheets/${ts._id}`,
      recipientRoles: ['agency_admin', 'disponent'],
    });

    res.json(ts);
  })
);

// POST /api/worker-portal/timesheets/:id/withdraw-dispute — worker withdraws their own dispute
router.post(
  '/timesheets/:id/withdraw-dispute',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const ts = await Timesheet.findOne({ _id: req.params.id, tenantId: req.user!.tenantId, workerId: worker._id });
    if (!ts) throw new AppError('Timesheet not found', 404);
    if (ts.status !== 'disputed') throw new AppError('Timesheet is not disputed', 400);

    ts.status = 'pending';
    ts.disputeReason = undefined;
    await ts.save();
    res.json(ts);
  })
);

// GET /api/worker-portal/profile
router.get(
  '/profile',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    res.json({
      firstName: worker.firstName,
      lastName: worker.lastName,
      dateOfBirth: worker.dateOfBirth,
      gender: worker.gender,
      nationality: worker.nationality,
      phone: worker.phone,
      email: worker.email,
      address: worker.address,
      steuerklasse: worker.steuerklasse,
      steuernummer: worker.steuernummerEncrypted ? decryptField(worker.steuernummerEncrypted) : undefined,
      sozialversicherungsnummer: worker.sozialversicherungsnummerEncrypted ? decryptField(worker.sozialversicherungsnummerEncrypted) : undefined,
      healthInsuranceProvider: worker.healthInsuranceProvider,
      iban: worker.ibanEncrypted ? decryptField(worker.ibanEncrypted) : undefined,
      bankName: worker.bankName,
      skills: worker.skills,
      languages: worker.languages,
    });
  })
);

// PATCH /api/worker-portal/profile
router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const {
      phone,
      address,
      steuerklasse,
      steuernummer,
      sozialversicherungsnummer,
      healthInsuranceProvider,
      iban,
      bankName,
    } = req.body as {
      phone?: string;
      address?: { street?: string; city?: string; postalCode?: string; country?: string };
      steuerklasse?: string;
      steuernummer?: string;
      sozialversicherungsnummer?: string;
      healthInsuranceProvider?: string;
      iban?: string;
      bankName?: string;
    };

    if (phone !== undefined) worker.phone = phone || undefined;
    if (address) Object.assign(worker.address, address);
    if (steuerklasse !== undefined) worker.steuerklasse = steuerklasse || undefined;
    if (steuernummer !== undefined) worker.steuernummerEncrypted = steuernummer ? encryptField(steuernummer) : undefined;
    if (sozialversicherungsnummer !== undefined) worker.sozialversicherungsnummerEncrypted = sozialversicherungsnummer ? encryptField(sozialversicherungsnummer) : undefined;
    if (healthInsuranceProvider !== undefined) worker.healthInsuranceProvider = healthInsuranceProvider || undefined;
    if (iban !== undefined) worker.ibanEncrypted = iban ? encryptField(iban) : undefined;
    if (bankName !== undefined) worker.bankName = bankName || undefined;

    await worker.save();
    res.json({ message: 'Profile updated' });
  })
);

// GET /api/worker-portal/documents
// Returns document metadata only — no sensitive fileUrls exposed to worker
router.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const docs = worker.documents.map((d) => ({
      _id: d._id,
      category: d.category,
      label: d.label,
      fileUrl: d.fileUrl || undefined,
      expiryDate: d.expiryDate,
      verified: d.verified,
      uploadedAt: d.uploadedAt,
      remark: d.remark || undefined,
      remarkAt: d.remarkAt || undefined,
    }));
    res.json(docs);
  })
);

// POST /api/worker-portal/documents  (multipart/form-data: file?, category, label, expiryDate?)
router.post(
  '/documents',
  (req, res, next) => uploadDocument(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  }),
  asyncHandler(async (req, res) => {
    const { category, label, expiryDate } = req.body as Record<string, string>;
    if (!category || !label) return res.status(400).json({ message: 'category and label are required' });
    const validCategories = ['identity', 'work_permit', 'health_certificate', 'contract', 'other'];
    if (!validCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });

    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
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
    const saved = worker.documents[worker.documents.length - 1];
    res.status(201).json({
      _id: saved._id,
      category: saved.category,
      label: saved.label,
      expiryDate: saved.expiryDate,
      verified: saved.verified,
      uploadedAt: saved.uploadedAt,
    });
  })
);

// DELETE /api/worker-portal/documents/:docId — worker removes their own document
router.delete(
  '/documents/:docId',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const doc = worker.documents.find((d) => d._id.toString() === req.params.docId);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    worker.documents = worker.documents.filter((d) => d._id.toString() !== req.params.docId) as never;
    await worker.save();
    res.json({ message: 'Deleted' });
  })
);

const messageSendSchema = z.object({ body: z.string().min(1).max(2000) });

// GET /api/worker-portal/messages — get my thread with the agency
router.get(
  '/messages',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const messages = await Message.find({
      tenantId: req.user!.tenantId,
      workerId: worker._id,
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    // Mark unread agency→worker messages as read
    const unreadIds = messages
      .filter((m) => m.senderRole === 'agency' && !m.readAt)
      .map((m) => m._id);
    if (unreadIds.length) {
      await Message.updateMany({ _id: { $in: unreadIds } }, { $set: { readAt: new Date() } });
    }

    res.json(messages);
  })
);

// POST /api/worker-portal/messages — send a message to the agency
router.post(
  '/messages',
  validate(messageSendSchema),
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const message = await Message.create({
      tenantId: req.user!.tenantId,
      workerId: worker._id,
      workerName: `${worker.firstName} ${worker.lastName}`,
      senderRole: 'worker',
      senderId: worker._id.toString(),
      senderName: `${worker.firstName} ${worker.lastName}`,
      body: req.body.body,
    });

    res.status(201).json(message);
  })
);

// GET /api/worker-portal/messages/unread-count
router.get(
  '/messages/unread-count',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const count = await Message.countDocuments({
      tenantId: req.user!.tenantId,
      workerId: worker._id,
      senderRole: 'agency',
      readAt: { $exists: false },
    });
    res.json({ count });
  })
);

// ─── Shift Offers (worker-facing) ────────────────────────────────────────────

// GET /api/worker-portal/offers — list pending + recent offers
router.get(
  '/offers',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const now = new Date();

    const offers = await ShiftOffer.find({
      tenantId: req.user!.tenantId,
      workerId: worker._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    // Enrich each offer with shift details
    const shiftIds = [...new Set(offers.map((o) => o.shiftId.toString()))];
    const shifts = await Shift.find({ _id: { $in: shiftIds } }).lean();
    const shiftMap = Object.fromEntries(shifts.map((s) => [s._id.toString(), s]));

    const enriched = offers.map((o) => ({
      ...o,
      shift: shiftMap[o.shiftId.toString()] ?? null,
      isExpired: o.status === 'pending' && o.expiresAt < now,
    }));

    res.json(enriched);
  })
);

// POST /api/worker-portal/offers/:offerId/accept
router.post(
  '/offers/:offerId/accept',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const tenantId = req.user!.tenantId!;
    const now = new Date();

    const offer = await ShiftOffer.findOne({
      _id: req.params.offerId,
      workerId: worker._id,
      tenantId,
    });
    if (!offer) throw new AppError('Angebot nicht gefunden', 404);
    if (offer.status !== 'pending') throw new AppError('Dieses Angebot ist nicht mehr aktiv', 400);
    if (offer.expiresAt < now) throw new AppError('Dieses Angebot ist abgelaufen', 400);

    const [shift, tenant] = await Promise.all([
      Shift.findOne({ _id: offer.shiftId, tenantId }),
      Tenant.findById(tenantId).lean(),
    ]);
    if (!shift) throw new AppError('Schicht nicht gefunden', 404);
    if (shift.status === 'cancelled') throw new AppError('Diese Schicht wurde abgesagt', 400);

    const alreadyAssigned = shift.assignedWorkers.some(
      (aw) => aw.workerId.toString() === worker._id.toString()
    );

    if (!alreadyAssigned) {
      const cs = tenant?.complianceSettings;

      // Compliance checks (same as application approval)
      await checkArbzg(
        worker._id.toString(),
        tenantId,
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
          `AÜG-Verstoß: Sie haben bereits ${aueg.currentMonths} Monate bei diesem Kunden gearbeitet.`,
          400
        );
      }

      shift.assignedWorkers.push({
        workerId: worker._id,
        workerName: `${worker.firstName} ${worker.lastName}`,
        status: 'assigned',
      });
      shift.markModified('assignedWorkers');
      await shift.save();

      updateAuegTracking(worker, shift.businessId, shift.businessName, shift.startTime);
      await worker.save();
    }

    // Mark this offer as accepted
    offer.status = 'accepted';
    offer.respondedAt = now;
    await offer.save();

    // Auto-cancel remaining pending offers if shift is now full
    if (shift.assignedWorkers.length >= shift.requiredWorkers) {
      await ShiftOffer.updateMany(
        { shiftId: shift._id, tenantId, status: 'pending', _id: { $ne: offer._id } },
        { $set: { status: 'cancelled' } }
      );
    }

    // Generate contract and send email
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
    }).catch((err) => {
      console.error('[CONTRACT EMAIL] Failed to send:', err);
    });

    res.json({ offer, contractId: contract._id });
  })
);

// POST /api/worker-portal/offers/:offerId/decline
router.post(
  '/offers/:offerId/decline',
  validate(z.object({ responseNote: z.string().max(300).optional() })),
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);

    const offer = await ShiftOffer.findOne({
      _id: req.params.offerId,
      workerId: worker._id,
      tenantId: req.user!.tenantId,
    });
    if (!offer) throw new AppError('Angebot nicht gefunden', 404);
    if (offer.status !== 'pending') throw new AppError('Dieses Angebot ist nicht mehr aktiv', 400);

    offer.status = 'declined';
    offer.respondedAt = new Date();
    offer.responseNote = req.body.responseNote;
    await offer.save();

    res.json(offer);
  })
);

// GET /api/worker-portal/shifts/history?from=&to=
router.get(
  '/shifts/history',
  asyncHandler(async (req, res) => {
    const worker = await resolveWorker(req.user!.userId, req.user!.tenantId!);
    const { from, to } = req.query as { from?: string; to?: string };

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(req.user!.tenantId!),
      'assignedWorkers.workerId': worker._id,
      status: 'completed',
    };
    if (from || to) {
      filter.startTime = {};
      if (from) (filter.startTime as Record<string, unknown>).$gte = new Date(from);
      if (to) (filter.startTime as Record<string, unknown>).$lte = new Date(to + 'T23:59:59Z');
    }

    const shifts = await Shift.find(filter)
      .select('title businessName locationName startTime endTime status payRatePerHour')
      .sort({ startTime: -1 })
      .lean();

    res.json(shifts);
  })
);

// ─────────────────────────────────────────────────────────────────────────────

export default router;

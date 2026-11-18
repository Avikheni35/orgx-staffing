import { Shift, IShift, ShiftStatus, WorkerAssignmentStatus } from '../models/Shift';
import { Worker } from '../models/Worker';
import { Business } from '../models/Business';
import { ShiftApplication } from '../models/ShiftApplication';
import { AppError } from '../utils/AppError';
import { createTimesheetsForShift } from './timesheet.service';
import { checkAueg, updateAuegTracking, checkArbzg, MINDESTLOHN, AUEG_BLOCK_MONTHS } from './compliance.service';
import { emitIntegrationEvent } from '../utils/integration';

export interface ShiftFilters {
  from?: Date;
  to?: Date;
  status?: ShiftStatus;
  businessId?: string;
  workerId?: string;
  page?: number;
  limit?: number;
}

export async function listShifts(tenantId: string, filters: ShiftFilters = {}) {
  const { from, to, status, businessId, workerId, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = { tenantId };

  if (from || to) {
    query.startTime = {};
    if (from) (query.startTime as Record<string, Date>).$gte = from;
    if (to) (query.startTime as Record<string, Date>).$lte = to;
  }
  if (status) query.status = status;
  if (businessId) query.businessId = businessId;
  if (workerId) query['assignedWorkers.workerId'] = workerId;

  const [shifts, total] = await Promise.all([
    Shift.find(query)
      .sort({ startTime: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Shift.countDocuments(query),
  ]);

  return { shifts, total, page, pages: Math.ceil(total / limit) };
}

export async function getShift(tenantId: string, shiftId: string): Promise<IShift> {
  const shift = await Shift.findOne({ _id: shiftId, tenantId });
  if (!shift) throw new AppError('Shift not found', 404);
  return shift;
}

export interface CreateShiftData {
  businessId: string;
  locationId?: string;
  title: string;
  startTime: Date;
  endTime: Date;
  breakMinutes?: number;
  requiredWorkers?: number;
  payRatePerHour: number;
  billingRatePerHour?: number;
  status?: ShiftStatus;
  notes?: string;
}

function validateShiftTimes(startTime: Date, endTime: Date, payRate: number, mindestlohnOverride?: number) {
  if (endTime <= startTime) throw new AppError('End time must be after start time', 400);
  const floor = mindestlohnOverride ?? MINDESTLOHN;
  if (payRate < floor) {
    throw new AppError(
      `Pay rate (€${payRate}/h) is below the Mindestlohn of €${floor}/h`,
      400
    );
  }
}

export async function createShift(
  tenantId: string,
  data: CreateShiftData,
  createdBy: string,
  mindestlohnOverride?: number
): Promise<IShift> {
  validateShiftTimes(data.startTime, data.endTime, data.payRatePerHour, mindestlohnOverride);

  const business = await Business.findOne({ _id: data.businessId, tenantId }).lean();
  if (!business) throw new AppError('Business not found', 404);

  let locationName: string | undefined;
  if (data.locationId) {
    const loc = business.locations.find((l) => l._id.toString() === data.locationId);
    locationName = loc?.name;
  }

  const shift = await Shift.create({
    tenantId,
    businessId: data.businessId,
    businessName: business.name,
    locationId: data.locationId,
    locationName,
    title: data.title,
    startTime: data.startTime,
    endTime: data.endTime,
    breakMinutes: data.breakMinutes ?? 0,
    requiredWorkers: data.requiredWorkers ?? 1,
    payRatePerHour: data.payRatePerHour,
    billingRatePerHour: data.billingRatePerHour,
    status: data.status ?? 'draft',
    notes: data.notes,
    createdBy,
  });

  emitIntegrationEvent({
    tenantId,
    eventType: 'shift.created',
    entityType: 'Shift',
    entityId: shift._id,
    payload: { title: shift.title, startTime: shift.startTime, endTime: shift.endTime, businessId: shift.businessId, businessName: shift.businessName },
  });

  return shift;
}

export async function updateShift(
  tenantId: string,
  shiftId: string,
  data: Partial<CreateShiftData>,
  mindestlohnOverride?: number
): Promise<IShift> {
  const shift = await Shift.findOne({ _id: shiftId, tenantId });
  if (!shift) throw new AppError('Shift not found', 404);

  const prevStatus: string = shift.status;
  if (prevStatus === 'completed' || prevStatus === 'cancelled') {
    throw new AppError('Cannot edit a completed or cancelled shift', 400);
  }

  const newStart = data.startTime ?? shift.startTime;
  const newEnd = data.endTime ?? shift.endTime;
  const newPay = data.payRatePerHour ?? shift.payRatePerHour;
  validateShiftTimes(newStart, newEnd, newPay, mindestlohnOverride);

  if (data.status === 'completed' && new Date() < new Date(shift.startTime)) {
    throw new AppError('Cannot mark a shift as completed before it has started', 400);
  }

  Object.assign(shift, data);
  await shift.save();

  if (prevStatus !== 'completed' && shift.status === 'completed') {
    shift.completedAt = new Date();
    await shift.save();
    await createTimesheetsForShift(tenantId, shift);
    emitIntegrationEvent({
      tenantId,
      eventType: 'shift.completed',
      entityType: 'Shift',
      entityId: shift._id,
      payload: { title: shift.title, businessId: shift.businessId, businessName: shift.businessName, workerIds: shift.assignedWorkers.map((a) => a.workerId) },
    });
  } else if (prevStatus !== 'cancelled' && shift.status === 'cancelled') {
    emitIntegrationEvent({
      tenantId,
      eventType: 'shift.cancelled',
      entityType: 'Shift',
      entityId: shift._id,
      payload: { title: shift.title, businessId: shift.businessId },
    });
  }

  return shift;
}

interface ComplianceOverrides {
  auegWarnMonths?: number;
  auegBlockMonths?: number;
  minRestHoursBetweenShifts?: number;
}

export async function assignWorker(
  tenantId: string,
  shiftId: string,
  workerId: string,
  overrides?: ComplianceOverrides
): Promise<{ shift: IShift; auegWarning: { months: number; businessName: string } | null }> {
  const [shift, worker] = await Promise.all([
    Shift.findOne({ _id: shiftId, tenantId }),
    Worker.findOne({ _id: workerId, tenantId }),
  ]);

  if (!shift) throw new AppError('Shift not found', 404);
  if (!worker) throw new AppError('Worker not found', 404);
  if (shift.status === 'completed' || shift.status === 'cancelled') {
    throw new AppError('Cannot assign workers to a completed or cancelled shift', 400);
  }
  if (shift.assignedWorkers.some((a) => a.workerId.toString() === workerId)) {
    throw new AppError('Worker is already assigned to this shift', 409);
  }
  if (shift.assignedWorkers.length >= shift.requiredWorkers) {
    throw new AppError('Shift is already fully staffed', 400);
  }
  if (worker.status !== 'active') {
    throw new AppError('Only active workers can be assigned to shifts', 400);
  }

  await checkArbzg(workerId, tenantId, shift.startTime, shift.endTime, shiftId, overrides?.minRestHoursBetweenShifts);

  let auegWarning: { months: number; businessName: string } | null = null;
  const aueg = checkAueg(worker, shift.businessId.toString(), shift.startTime, {
    warnMonths: overrides?.auegWarnMonths,
    blockMonths: overrides?.auegBlockMonths,
  });
  if (aueg.status === 'blocked') {
    throw new AppError(
      `AÜG-Verstoß: ${worker.firstName} ${worker.lastName} hat bereits ${aueg.currentMonths} Monate bei ${aueg.businessName} gearbeitet (Maximum: ${overrides?.auegBlockMonths ?? AUEG_BLOCK_MONTHS} Monate)`,
      400
    );
  }
  if (aueg.status === 'warning') {
    auegWarning = { months: aueg.projectedMonths, businessName: aueg.businessName };
  }

  shift.assignedWorkers.push({
    workerId: worker._id,
    workerName: `${worker.firstName} ${worker.lastName}`,
    status: 'assigned',
  });
  await shift.save();

  updateAuegTracking(worker, shift.businessId, shift.businessName, shift.startTime);
  await worker.save();

  emitIntegrationEvent({
    tenantId,
    eventType: 'shift.worker_assigned',
    entityType: 'Shift',
    entityId: shift._id,
    payload: { workerId: worker._id, workerName: `${worker.firstName} ${worker.lastName}`, shiftTitle: shift.title },
  });

  return { shift, auegWarning };
}

export async function removeWorker(
  tenantId: string,
  shiftId: string,
  workerId: string
): Promise<IShift> {
  const shift = await Shift.findOne({ _id: shiftId, tenantId });
  if (!shift) throw new AppError('Shift not found', 404);

  const idx = shift.assignedWorkers.findIndex((a) => a.workerId.toString() === workerId);
  if (idx === -1) throw new AppError('Worker not assigned to this shift', 404);

  shift.assignedWorkers.splice(idx, 1);
  await shift.save();

  // If the assignment came from an approved application, revert it to pending
  await ShiftApplication.updateOne(
    { shiftId: shift._id, workerId, status: 'approved' },
    { $set: { status: 'pending', reviewedBy: null, reviewedAt: null } }
  );

  return shift;
}

export async function updateWorkerStatus(
  tenantId: string,
  shiftId: string,
  workerId: string,
  status: WorkerAssignmentStatus
): Promise<IShift> {
  const shift = await Shift.findOne({ _id: shiftId, tenantId });
  if (!shift) throw new AppError('Shift not found', 404);

  const assignment = shift.assignedWorkers.find((a) => a.workerId.toString() === workerId);
  if (!assignment) throw new AppError('Worker not assigned to this shift', 404);

  assignment.status = status;
  await shift.save();
  return shift;
}

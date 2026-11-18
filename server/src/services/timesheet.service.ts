import { Timesheet, ITimesheet, TimesheetStatus } from '../models/Timesheet';
import { IShift } from '../models/Shift';
import { AppError } from '../utils/AppError';
import { peers } from '../utils/serviceClient';
import { enqueueOutbox } from '../utils/outbox';

function netHours(start: Date, end: Date, breakMinutes: number): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 3_600_000 - breakMinutes / 60);
}

export async function createTimesheetsForShift(
  tenantId: string,
  shift: IShift
): Promise<number> {
  // Scope existingSet to THIS tenant so a ghost timesheet from a stale/wrong-tenant write
  // doesn't silently block creation (the unique index is now tenantId+shiftId+workerId).
  const existingWorkerIds = await Timesheet.distinct('workerId', { tenantId, shiftId: shift._id });
  const existingSet = new Set(existingWorkerIds.map((id: unknown) => String(id)));

  const workers = shift.assignedWorkers.filter(
    (a) => a.status !== 'no_show' && !existingSet.has(a.workerId.toString())
  );
  if (workers.length === 0) return 0;

  const shiftDate = new Date(shift.startTime);
  shiftDate.setHours(0, 0, 0, 0);

  const hours = netHours(shift.startTime, shift.endTime, shift.breakMinutes);

  const docs = workers.map((a) => ({
    tenantId,
    shiftId: shift._id,
    workerId: a.workerId,
    workerName: a.workerName,
    businessId: shift.businessId,
    businessName: shift.businessName,
    shiftDate,
    plannedStart: shift.startTime,
    plannedEnd: shift.endTime,
    plannedBreakMinutes: shift.breakMinutes,
    actualStart: shift.startTime,
    actualEnd: shift.endTime,
    actualBreakMinutes: shift.breakMinutes,
    payRatePerHour: shift.payRatePerHour,
    billingRatePerHour: shift.billingRatePerHour,
    totalHours: parseFloat(hours.toFixed(2)),
    grossPay: parseFloat((hours * shift.payRatePerHour).toFixed(2)),
    status: 'pending' as const,
  }));

  try {
    const result = await Timesheet.insertMany(docs, { ordered: false });
    return result.length;
  } catch (err: unknown) {
    // ordered:false — some docs may have been inserted despite duplicate-key errors
    const mongoErr = err as { code?: number; insertedDocs?: unknown[] };
    if (mongoErr.code === 11000) {
      return Array.isArray(mongoErr.insertedDocs) ? mongoErr.insertedDocs.length : 0;
    }
    throw err;
  }
}

export interface TimesheetFilters {
  from?: Date;
  to?: Date;
  status?: TimesheetStatus;
  workerId?: string;
  businessId?: string;
  shiftId?: string;
  page?: number;
  limit?: number;
}

export async function listTimesheets(tenantId: string, filters: TimesheetFilters = {}) {
  const { from, to, status, workerId, businessId, shiftId, page = 1, limit = 50 } = filters;
  const query: Record<string, unknown> = { tenantId };

  if (from || to) {
    query.shiftDate = {};
    if (from) (query.shiftDate as Record<string, Date>).$gte = from;
    if (to) (query.shiftDate as Record<string, Date>).$lte = to;
  }
  if (status) query.status = status;
  if (workerId) query.workerId = workerId;
  if (businessId) query.businessId = businessId;
  if (shiftId) query.shiftId = shiftId;

  const [timesheets, total] = await Promise.all([
    Timesheet.find(query)
      .sort({ shiftDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Timesheet.countDocuments(query),
  ]);

  return { timesheets, total, page, pages: Math.ceil(total / limit) };
}

export async function getTimesheet(tenantId: string, id: string): Promise<ITimesheet> {
  const ts = await Timesheet.findOne({ _id: id, tenantId });
  if (!ts) throw new AppError('Timesheet not found', 404);
  return ts;
}

export interface UpdateTimesheetData {
  actualStart?: Date;
  actualEnd?: Date;
  actualBreakMinutes?: number;
  notes?: string;
  status?: TimesheetStatus;
}

export async function updateTimesheet(
  tenantId: string,
  id: string,
  data: UpdateTimesheetData
): Promise<ITimesheet> {
  const ts = await Timesheet.findOne({ _id: id, tenantId });
  if (!ts) throw new AppError('Timesheet not found', 404);
  if (ts.status === 'exported') throw new AppError('Cannot edit an exported timesheet', 400);

  const timesChanged =
    (data.actualStart && data.actualStart.toString() !== ts.actualStart.toString()) ||
    (data.actualEnd && data.actualEnd.toString() !== ts.actualEnd.toString()) ||
    (data.actualBreakMinutes !== undefined && data.actualBreakMinutes !== ts.actualBreakMinutes);

  if (data.actualStart) ts.actualStart = data.actualStart;
  if (data.actualEnd) ts.actualEnd = data.actualEnd;
  if (data.actualBreakMinutes !== undefined) ts.actualBreakMinutes = data.actualBreakMinutes;
  if (data.notes !== undefined) ts.notes = data.notes;
  if (data.status) ts.status = data.status;

  // Agency edited actual times on a disputed timesheet → reset to pending for re-review
  if (timesChanged && ts.status === 'disputed' && !data.status) {
    ts.status = 'pending';
    ts.disputeReason = undefined;
  }

  const hours = netHours(ts.actualStart, ts.actualEnd, ts.actualBreakMinutes);
  ts.totalHours = parseFloat(hours.toFixed(2));
  ts.grossPay = parseFloat((hours * ts.payRatePerHour).toFixed(2));

  await ts.save();
  return ts;
}

export async function approveTimesheet(
  tenantId: string,
  id: string,
  approverId: string
): Promise<ITimesheet> {
  const ts = await Timesheet.findOne({ _id: id, tenantId });
  if (!ts) throw new AppError('Timesheet not found', 404);
  if (ts.status !== 'pending' && ts.status !== 'disputed') {
    throw new AppError('Only pending or disputed timesheets can be approved', 400);
  }
  ts.status = 'approved';
  ts.approvedBy = approverId as never;
  ts.approvedAt = new Date();
  await ts.save();

  // Notify M3 ERP to add a payroll line
  const payrollPayload = {
    workerName:       ts.workerName,
    m1WorkerId:       ts.workerId.toString(),
    periodStart:      ts.actualStart.toISOString().split('T')[0],
    periodEnd:        ts.actualEnd.toISOString().split('T')[0],
    hoursWorked:      ts.totalHours,
    payRateCents:     Math.round(ts.payRatePerHour * 100),
    grossAmountCents: Math.round(ts.grossPay * 100),
    timesheetId:      ts._id.toString(),
  };
  const delivered = await peers.m3.addPayrollLine(tenantId, payrollPayload);
  if (!delivered) {
    await enqueueOutbox({
      tenantId,
      type: 'timesheet.approved',
      targetModule: 'm3',
      targetPath: '/api/internal/payroll-lines',
      payload: payrollPayload,
    });
  }

  return ts;
}

export async function bulkApprove(
  tenantId: string,
  ids: string[],
  approverId: string
): Promise<number> {
  const result = await Timesheet.updateMany(
    { _id: { $in: ids }, tenantId, status: { $in: ['pending', 'disputed'] } },
    { $set: { status: 'approved', approvedBy: approverId, approvedAt: new Date() } }
  );
  return result.modifiedCount;
}

export async function getTimesheetSummary(tenantId: string, from: Date, to: Date) {
  const result = await Timesheet.aggregate([
    { $match: { tenantId: { $toString: tenantId }, shiftDate: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalHours: { $sum: '$totalHours' },
        totalPay: { $sum: '$grossPay' },
      },
    },
  ]);
  return result;
}

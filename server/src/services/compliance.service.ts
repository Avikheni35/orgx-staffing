import { Types } from 'mongoose';
import { Shift } from '../models/Shift';
import { IWorker } from '../models/Worker';
import { AppError } from '../utils/AppError';

export const MINDESTLOHN = 12.82;
export const AUEG_WARN_MONTHS = 9;
export const AUEG_BLOCK_MONTHS = 18;
export const ARBZG_MIN_REST_HOURS = 11;

export interface AuegCheckResult {
  status: 'ok' | 'warning' | 'blocked';
  currentMonths: number;
  projectedMonths: number;
  businessName: string;
}

function wouldAddNewMonth(worker: IWorker, businessIdStr: string, shiftStartTime: Date): boolean {
  const entry = worker.auegTracking.find((e) => e.businessId.toString() === businessIdStr);
  if (!entry) return true;
  const lastDate = entry.lastAssignmentDate ?? entry.startDate;
  return (
    shiftStartTime.getFullYear() !== lastDate.getFullYear() ||
    shiftStartTime.getMonth() !== lastDate.getMonth()
  );
}

export function checkAueg(
  worker: IWorker,
  businessId: string,
  shiftStartTime: Date,
  opts?: { warnMonths?: number; blockMonths?: number }
): AuegCheckResult {
  const warnAt = opts?.warnMonths ?? AUEG_WARN_MONTHS;
  const blockAt = opts?.blockMonths ?? AUEG_BLOCK_MONTHS;

  const entry = worker.auegTracking.find((e) => e.businessId.toString() === businessId);
  const currentMonths = entry?.monthsWorked ?? 0;
  const newMonth = wouldAddNewMonth(worker, businessId, shiftStartTime);
  const projectedMonths = currentMonths + (newMonth ? 1 : 0);

  const status =
    projectedMonths > blockAt ? 'blocked' :
    projectedMonths >= warnAt ? 'warning' : 'ok';

  return { status, currentMonths, projectedMonths, businessName: entry?.businessName ?? '' };
}

export function updateAuegTracking(
  worker: IWorker,
  businessId: Types.ObjectId,
  businessName: string,
  shiftStartTime: Date
): void {
  const businessIdStr = businessId.toString();
  const entry = worker.auegTracking.find((e) => e.businessId.toString() === businessIdStr);

  if (!entry) {
    worker.auegTracking.push({
      businessId,
      businessName,
      startDate: shiftStartTime,
      monthsWorked: 1,
      lastAssignmentDate: shiftStartTime,
    });
  } else {
    const lastDate = entry.lastAssignmentDate ?? entry.startDate;
    const isNewMonth =
      shiftStartTime.getFullYear() !== lastDate.getFullYear() ||
      shiftStartTime.getMonth() !== lastDate.getMonth();

    if (isNewMonth) entry.monthsWorked += 1;
    if (shiftStartTime > lastDate) entry.lastAssignmentDate = shiftStartTime;
  }
  worker.markModified('auegTracking');
}

export async function checkArbzg(
  workerId: string,
  tenantId: string,
  shiftStartTime: Date,
  shiftEndTime: Date,
  excludeShiftId?: string,
  minRestHours?: number
): Promise<void> {
  const effectiveRestHours = minRestHours ?? ARBZG_MIN_REST_HOURS;
  const restMs = effectiveRestHours * 60 * 60 * 1000;

  const query: Record<string, unknown> = {
    tenantId,
    'assignedWorkers.workerId': workerId,
    status: { $nin: ['cancelled'] },
    $or: [
      { endTime: { $gt: new Date(shiftStartTime.getTime() - restMs), $lte: shiftStartTime } },
      { startTime: { $gte: shiftEndTime, $lt: new Date(shiftEndTime.getTime() + restMs) } },
    ],
  };
  if (excludeShiftId) query._id = { $ne: excludeShiftId };

  const conflicting = await Shift.findOne(query).lean();
  if (conflicting) {
    throw new AppError(
      `ArbZG-Verstoß: Mindestruhezeit von ${effectiveRestHours} Stunden zwischen den Schichten nicht eingehalten`,
      400
    );
  }
}

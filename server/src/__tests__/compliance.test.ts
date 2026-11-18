import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MINDESTLOHN,
  AUEG_WARN_MONTHS,
  AUEG_BLOCK_MONTHS,
  ARBZG_MIN_REST_HOURS,
  checkAueg,
  updateAuegTracking,
  checkArbzg,
} from '../services/compliance.service';
import type { IWorker } from '../models/Worker';
import { Types } from 'mongoose';

vi.mock('../models/Shift');

import { Shift } from '../models/Shift';

// ── Constants ────────────────────────────────────────────────────────────────

describe('compliance constants', () => {
  it('MINDESTLOHN equals the statutory minimum wage', () => {
    expect(MINDESTLOHN).toBe(12.82);
  });

  it('AUEG thresholds are 9 (warn) and 18 (block)', () => {
    expect(AUEG_WARN_MONTHS).toBe(9);
    expect(AUEG_BLOCK_MONTHS).toBe(18);
  });

  it('ArbZG minimum rest is 11 hours', () => {
    expect(ARBZG_MIN_REST_HOURS).toBe(11);
  });
});

// ── Helper ───────────────────────────────────────────────────────────────────

function makeWorker(tracking: IWorker['auegTracking'] = []): IWorker {
  return {
    auegTracking: tracking,
    markModified: vi.fn(),
  } as unknown as IWorker;
}

const BID = new Types.ObjectId().toString();

// ── checkAueg ────────────────────────────────────────────────────────────────

describe('checkAueg', () => {
  const date = new Date('2025-06-15');

  it('returns ok when worker has no prior assignment at this business', () => {
    const worker = makeWorker([]);
    const result = checkAueg(worker, BID, date);
    expect(result.status).toBe('ok');
    expect(result.currentMonths).toBe(0);
    expect(result.projectedMonths).toBe(1);
  });

  it('returns ok when projected months < 9', () => {
    const worker = makeWorker([{
      businessId: new Types.ObjectId(BID),
      businessName: 'ACME',
      startDate: new Date('2024-10-01'),
      monthsWorked: 7,
      lastAssignmentDate: new Date('2025-04-01'),
    }]);
    const result = checkAueg(worker, BID, date);
    expect(result.status).toBe('ok');
    expect(result.projectedMonths).toBe(8);
  });

  it('returns warning when projected months reaches 9', () => {
    const worker = makeWorker([{
      businessId: new Types.ObjectId(BID),
      businessName: 'ACME',
      startDate: new Date('2024-09-01'),
      monthsWorked: 8,
      lastAssignmentDate: new Date('2025-04-01'),
    }]);
    const result = checkAueg(worker, BID, date);
    expect(result.status).toBe('warning');
    expect(result.projectedMonths).toBe(9);
  });

  it('returns warning at 17 months projected (not yet blocked)', () => {
    const worker = makeWorker([{
      businessId: new Types.ObjectId(BID),
      businessName: 'ACME',
      startDate: new Date('2023-03-01'),
      monthsWorked: 16,
      lastAssignmentDate: new Date('2025-04-01'),
    }]);
    const result = checkAueg(worker, BID, date);
    expect(result.status).toBe('warning');
    expect(result.projectedMonths).toBe(17);
  });

  it('returns blocked when projected months exceeds 18', () => {
    const worker = makeWorker([{
      businessId: new Types.ObjectId(BID),
      businessName: 'ACME',
      startDate: new Date('2023-12-01'),
      monthsWorked: 18,
      lastAssignmentDate: new Date('2025-04-01'),
    }]);
    const result = checkAueg(worker, BID, date);
    expect(result.status).toBe('blocked');
    expect(result.projectedMonths).toBe(19);
  });

  it('does NOT increment when shift is in the same calendar month as last assignment', () => {
    const sameMonthDate = new Date('2025-04-20');
    const worker = makeWorker([{
      businessId: new Types.ObjectId(BID),
      businessName: 'ACME',
      startDate: new Date('2024-10-01'),
      monthsWorked: 6,
      lastAssignmentDate: new Date('2025-04-01'),
    }]);
    const result = checkAueg(worker, BID, sameMonthDate);
    // Same month — no new month added
    expect(result.projectedMonths).toBe(6);
    expect(result.status).toBe('ok');
  });

  it('respects custom warn/block thresholds when supplied', () => {
    const worker = makeWorker([{
      businessId: new Types.ObjectId(BID),
      businessName: 'ACME',
      startDate: new Date('2024-01-01'),
      monthsWorked: 4,
      lastAssignmentDate: new Date('2025-04-01'),
    }]);
    const result = checkAueg(worker, BID, date, { warnMonths: 5, blockMonths: 6 });
    expect(result.status).toBe('warning');
    expect(result.projectedMonths).toBe(5);
  });
});

// ── updateAuegTracking ───────────────────────────────────────────────────────

describe('updateAuegTracking', () => {
  const bid = new Types.ObjectId();

  it('creates a new entry with monthsWorked=1 when business not yet tracked', () => {
    const worker = makeWorker([]);
    updateAuegTracking(worker, bid, 'NewCo', new Date('2025-06-15'));
    expect(worker.auegTracking).toHaveLength(1);
    expect(worker.auegTracking[0].businessName).toBe('NewCo');
    expect(worker.auegTracking[0].monthsWorked).toBe(1);
  });

  it('increments monthsWorked when shift is in a new calendar month', () => {
    const worker = makeWorker([{
      businessId: bid,
      businessName: 'ExistingCo',
      startDate: new Date('2025-01-01'),
      monthsWorked: 3,
      lastAssignmentDate: new Date('2025-03-15'),
    }]);
    updateAuegTracking(worker, bid, 'ExistingCo', new Date('2025-04-01'));
    expect(worker.auegTracking[0].monthsWorked).toBe(4);
  });

  it('does NOT increment monthsWorked for same calendar month', () => {
    const worker = makeWorker([{
      businessId: bid,
      businessName: 'ExistingCo',
      startDate: new Date('2025-01-01'),
      monthsWorked: 3,
      lastAssignmentDate: new Date('2025-03-01'),
    }]);
    updateAuegTracking(worker, bid, 'ExistingCo', new Date('2025-03-20'));
    expect(worker.auegTracking[0].monthsWorked).toBe(3);
  });

  it('updates lastAssignmentDate when new shift is later', () => {
    const worker = makeWorker([{
      businessId: bid,
      businessName: 'ExistingCo',
      startDate: new Date('2025-01-01'),
      monthsWorked: 2,
      lastAssignmentDate: new Date('2025-02-15'),
    }]);
    const later = new Date('2025-03-10');
    updateAuegTracking(worker, bid, 'ExistingCo', later);
    expect(worker.auegTracking[0].lastAssignmentDate).toEqual(later);
  });

  it('calls markModified after any update', () => {
    const worker = makeWorker([]);
    updateAuegTracking(worker, bid, 'Co', new Date());
    expect(worker.markModified).toHaveBeenCalledWith('auegTracking');
  });
});

// ── checkArbzg ───────────────────────────────────────────────────────────────

describe('checkArbzg', () => {
  const WORKER = 'worker-id-1';
  const TENANT = 'tenant-1';
  const shift1Start = new Date('2025-06-15T06:00:00Z');
  const shift1End   = new Date('2025-06-15T14:00:00Z');

  beforeEach(() => { vi.clearAllMocks(); });

  it('passes when no conflicting shift exists', async () => {
    vi.mocked(Shift).findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(checkArbzg(WORKER, TENANT, shift1Start, shift1End)).resolves.toBeUndefined();
  });

  it('throws 400 when preceding shift ends within the 11-hour rest window', async () => {
    // Previous shift ended at 00:00 — only 6 hours before shift1Start at 06:00
    const conflicting = { _id: 'prev-shift', endTime: new Date('2025-06-15T00:00:00Z') };
    vi.mocked(Shift).findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(conflicting) });

    await expect(checkArbzg(WORKER, TENANT, shift1Start, shift1End))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('ArbZG') });
  });

  it('throws 400 when following shift starts within the 11-hour rest window', async () => {
    // Next shift starts at 20:00 — only 6 hours after shift1End at 14:00
    const conflicting = { _id: 'next-shift', startTime: new Date('2025-06-15T20:00:00Z') };
    vi.mocked(Shift).findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(conflicting) });

    await expect(checkArbzg(WORKER, TENANT, shift1Start, shift1End))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('ArbZG') });
  });

  it('respects custom minimum rest hours', async () => {
    // Shift ends 7 hours before next — violates a custom 8-hour rest requirement
    const conflicting = { _id: 'next-shift' };
    vi.mocked(Shift).findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(conflicting) });

    await expect(checkArbzg(WORKER, TENANT, shift1Start, shift1End, undefined, 8))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('8') });
  });

  it('excludes the shift being updated from the rest check', async () => {
    // Shift.findOne returns null when excludeShiftId is used
    vi.mocked(Shift).findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(checkArbzg(WORKER, TENANT, shift1Start, shift1End, 'shift-being-edited')).resolves.toBeUndefined();

    // The query must contain $ne: 'shift-being-edited'
    const callArg = (vi.mocked(Shift).findOne as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArg._id).toMatchObject({ $ne: 'shift-being-edited' });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MINDESTLOHN, AUEG_BLOCK_MONTHS } from '../services/compliance.service';

// ── Module mocks ─────────────────────────────────────────────────────────────
vi.mock('../models/Shift');
vi.mock('../models/Worker');
vi.mock('../models/Business');
vi.mock('../models/ShiftApplication');
vi.mock('../models/Timesheet');
vi.mock('../utils/integration', () => ({ emitIntegrationEvent: vi.fn() }));
vi.mock('../utils/serviceClient', () => ({
  peers: { m3: { addPayrollLine: vi.fn().mockResolvedValue(true) } },
}));
vi.mock('../utils/outbox', () => ({ enqueueOutbox: vi.fn() }));
vi.mock('../services/compliance.service', async (importActual) => {
  const actual = await importActual<typeof import('../services/compliance.service')>();
  return {
    ...actual,                          // keep MINDESTLOHN, AUEG_BLOCK_MONTHS constants
    checkArbzg: vi.fn().mockResolvedValue(undefined),
    checkAueg:  vi.fn().mockReturnValue({ status: 'ok', currentMonths: 2, projectedMonths: 3, businessName: 'Demo GmbH' }),
    updateAuegTracking: vi.fn(),
  };
});

import { Shift }    from '../models/Shift';
import { Worker }   from '../models/Worker';
import { Business } from '../models/Business';
import { Timesheet } from '../models/Timesheet';
import { checkAueg, checkArbzg } from '../services/compliance.service';
import { peers } from '../utils/serviceClient';
import {
  createShift,
  assignWorker,
  updateShift,
} from '../services/shift.service';
import {
  createTimesheetsForShift,
  updateTimesheet,
  approveTimesheet,
} from '../services/timesheet.service';

const mockShift   = vi.mocked(Shift);
const mockWorker  = vi.mocked(Worker);
const mockBusiness = vi.mocked(Business);
const mockTimesheet = vi.mocked(Timesheet);
const mockCheckAueg = vi.mocked(checkAueg);
const mockCheckArbzg = vi.mocked(checkArbzg);

// ── Helpers ───────────────────────────────────────────────────────────────────
const TENANT = 'tenant-1';
const NOW    = new Date('2025-06-15T08:00:00Z');
const LATER  = new Date('2025-06-15T16:00:00Z');

function makeShiftDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:              { toString: () => 'shift-id-1' },
    tenantId:         TENANT,
    businessId:       { toString: () => 'biz-id-1' },
    businessName:     'Demo GmbH',
    title:            'Lagerhelfer',
    startTime:        NOW,
    endTime:          LATER,
    breakMinutes:     30,
    requiredWorkers:  2,
    payRatePerHour:   MINDESTLOHN,
    status:           'draft',
    assignedWorkers:  [] as Array<{ workerId: { toString(): string }; workerName: string; status: string }>,
    save:             vi.fn().mockResolvedValue(undefined),
    completedAt:      undefined,
    ...overrides,
  };
}

function makeWorkerDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:         { toString: () => 'worker-id-1' },
    tenantId:    TENANT,
    firstName:   'Hans',
    lastName:    'Müller',
    status:      'active',
    auegTracking: [],
    save:        vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeTimesheetDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id:              { toString: () => 'ts-id-1' },
    tenantId:         TENANT,
    shiftId:          'shift-id-1',
    workerId:         'worker-id-1',
    workerName:       'Hans Müller',
    businessId:       'biz-id-1',
    businessName:     'Demo GmbH',
    actualStart:      NOW,
    actualEnd:        LATER,
    actualBreakMinutes: 30,
    payRatePerHour:   MINDESTLOHN,
    totalHours:       7.5,
    grossPay:         96.15,
    status:           'pending',
    disputeReason:    undefined,
    approvedBy:       undefined,
    approvedAt:       undefined,
    save:             vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ── createShift ───────────────────────────────────────────────────────────────
describe('createShift', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a shift for a known business', async () => {
    mockBusiness.findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ name: 'Demo GmbH', locations: [] }) });
    mockShift.create = vi.fn().mockResolvedValue(makeShiftDoc());

    const result = await createShift(TENANT, {
      businessId: 'biz-id-1',
      title: 'Lagerhelfer',
      startTime: NOW,
      endTime: LATER,
      payRatePerHour: MINDESTLOHN,
    }, 'user-1');

    expect(result.title).toBe('Lagerhelfer');
    expect(mockShift.create).toHaveBeenCalledOnce();
  });

  it('throws 400 when end time is not after start time', async () => {
    await expect(createShift(TENANT, {
      businessId: 'biz-id-1',
      title: 'Nachtschicht',
      startTime: LATER,
      endTime: NOW,       // wrong order
      payRatePerHour: MINDESTLOHN,
    }, 'user-1')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('End time') });
  });

  it('throws 400 when pay rate is below Mindestlohn', async () => {
    await expect(createShift(TENANT, {
      businessId: 'biz-id-1',
      title: 'Schicht',
      startTime: NOW,
      endTime: LATER,
      payRatePerHour: MINDESTLOHN - 1,
    }, 'user-1')).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Mindestlohn') });
  });

  it('throws 404 when business is not found', async () => {
    mockBusiness.findOne = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(createShift(TENANT, {
      businessId: 'unknown-biz',
      title: 'Schicht',
      startTime: NOW,
      endTime: LATER,
      payRatePerHour: MINDESTLOHN,
    }, 'user-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── assignWorker ──────────────────────────────────────────────────────────────
describe('assignWorker', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns an active worker to a shift with no AÜG warning', async () => {
    const shift  = makeShiftDoc();
    const worker = makeWorkerDoc();
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);

    const { auegWarning } = await assignWorker(TENANT, 'shift-id-1', 'worker-id-1');

    expect(auegWarning).toBeNull();
    expect(shift.assignedWorkers).toHaveLength(1);
    expect(shift.save).toHaveBeenCalled();
  });

  it('returns an AÜG warning when near the equal-pay threshold', async () => {
    const shift  = makeShiftDoc();
    const worker = makeWorkerDoc();
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);
    mockCheckAueg.mockReturnValueOnce({ status: 'warning', currentMonths: 8, projectedMonths: 9, businessName: 'Demo GmbH' });

    const { auegWarning } = await assignWorker(TENANT, 'shift-id-1', 'worker-id-1');

    expect(auegWarning).not.toBeNull();
    expect(auegWarning?.months).toBe(9);
  });

  it('throws 400 when the AÜG hard limit is exceeded', async () => {
    const shift  = makeShiftDoc();
    const worker = makeWorkerDoc();
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);
    mockCheckAueg.mockReturnValueOnce({
      status: 'blocked',
      currentMonths: AUEG_BLOCK_MONTHS,
      projectedMonths: AUEG_BLOCK_MONTHS + 1,
      businessName: 'Demo GmbH',
    });

    await expect(assignWorker(TENANT, 'shift-id-1', 'worker-id-1'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('AÜG') });
  });

  it('throws 409 when worker is already assigned', async () => {
    const shift = makeShiftDoc({
      assignedWorkers: [{ workerId: { toString: () => 'worker-id-1' }, workerName: 'Hans Müller', status: 'assigned' }],
    });
    const worker = makeWorkerDoc();
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);

    await expect(assignWorker(TENANT, 'shift-id-1', 'worker-id-1'))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  it('throws 400 when shift is already fully staffed', async () => {
    const shift = makeShiftDoc({
      requiredWorkers: 1,
      assignedWorkers: [{ workerId: { toString: () => 'worker-id-2' }, workerName: 'Other', status: 'assigned' }],
    });
    const worker = makeWorkerDoc();
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);

    await expect(assignWorker(TENANT, 'shift-id-1', 'worker-id-1'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('fully staffed') });
  });

  it('throws 400 when worker is inactive', async () => {
    const shift  = makeShiftDoc();
    const worker = makeWorkerDoc({ status: 'inactive' });
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);

    await expect(assignWorker(TENANT, 'shift-id-1', 'worker-id-1'))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('active') });
  });

  it('enforces ArbZG rest check', async () => {
    mockCheckArbzg.mockRejectedValueOnce({ statusCode: 400, message: '11-hour rest' });
    const shift  = makeShiftDoc();
    const worker = makeWorkerDoc();
    mockShift.findOne  = vi.fn().mockResolvedValue(shift);
    mockWorker.findOne = vi.fn().mockResolvedValue(worker);

    await expect(assignWorker(TENANT, 'shift-id-1', 'worker-id-1'))
      .rejects.toMatchObject({ message: expect.stringContaining('rest') });
  });
});

// ── updateShift (completing triggers timesheet creation) ─────────────────────
describe('updateShift', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws 400 when trying to complete a shift before it has started', async () => {
    const futureStart = new Date(Date.now() + 3_600_000);
    const futureEnd   = new Date(Date.now() + 7_200_000);
    const shift = makeShiftDoc({ startTime: futureStart, endTime: futureEnd, status: 'open' });
    mockShift.findOne = vi.fn().mockResolvedValue(shift);

    await expect(updateShift(TENANT, 'shift-id-1', { status: 'completed' }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('completed before it has started') });
  });

  it('throws 400 when editing a completed shift', async () => {
    const shift = makeShiftDoc({ status: 'completed' });
    mockShift.findOne = vi.fn().mockResolvedValue(shift);

    await expect(updateShift(TENANT, 'shift-id-1', { title: 'New Title' }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when shift does not exist', async () => {
    mockShift.findOne = vi.fn().mockResolvedValue(null);

    await expect(updateShift(TENANT, 'no-shift', { title: 'x' }))
      .rejects.toMatchObject({ statusCode: 404 });
  });
});

// ── createTimesheetsForShift ──────────────────────────────────────────────────
describe('createTimesheetsForShift', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates timesheets for all non-no_show workers', async () => {
    const shift = {
      ...makeShiftDoc(),
      assignedWorkers: [
        { workerId: { toString: () => 'w1' }, workerName: 'Alice', status: 'assigned' },
        { workerId: { toString: () => 'w2' }, workerName: 'Bob',   status: 'confirmed' },
      ],
      _id: { toString: () => 'shift-id-1' },
    };
    mockTimesheet.distinct  = vi.fn().mockResolvedValue([]);
    mockTimesheet.insertMany = vi.fn().mockResolvedValue([{}, {}]);

    const count = await createTimesheetsForShift(TENANT, shift as never);

    expect(count).toBe(2);
    expect(mockTimesheet.insertMany).toHaveBeenCalledOnce();
  });

  it('skips no_show workers', async () => {
    const shift = {
      ...makeShiftDoc(),
      assignedWorkers: [
        { workerId: { toString: () => 'w1' }, workerName: 'Alice', status: 'no_show' },
        { workerId: { toString: () => 'w2' }, workerName: 'Bob',   status: 'assigned' },
      ],
      _id: { toString: () => 'shift-id-1' },
    };
    mockTimesheet.distinct  = vi.fn().mockResolvedValue([]);
    mockTimesheet.insertMany = vi.fn().mockResolvedValue([{}]);

    const count = await createTimesheetsForShift(TENANT, shift as never);

    expect(count).toBe(1);
    const docs = (mockTimesheet.insertMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(docs).toHaveLength(1);
    expect(docs[0].workerName).toBe('Bob');
  });

  it('skips workers who already have timesheets', async () => {
    const shift = {
      ...makeShiftDoc(),
      assignedWorkers: [
        { workerId: { toString: () => 'w1' }, workerName: 'Alice', status: 'assigned' },
      ],
      _id: { toString: () => 'shift-id-1' },
    };
    mockTimesheet.distinct   = vi.fn().mockResolvedValue(['w1']); // already has one
    mockTimesheet.insertMany = vi.fn().mockResolvedValue([]);

    const count = await createTimesheetsForShift(TENANT, shift as never);

    expect(count).toBe(0);
  });
});

// ── updateTimesheet (dispute flow) ────────────────────────────────────────────
describe('updateTimesheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks a pending timesheet as disputed with a reason', async () => {
    const ts = makeTimesheetDoc({ status: 'pending' });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);

    const result = await updateTimesheet(TENANT, 'ts-id-1', { status: 'disputed', notes: 'Wrong hours' });

    expect(result.status).toBe('disputed');
    expect(ts.save).toHaveBeenCalled();
  });

  it('resets a disputed timesheet to pending when agency corrects actual times', async () => {
    const ts = makeTimesheetDoc({
      status:      'disputed',
      actualStart: NOW,
      actualEnd:   LATER,
    });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);

    const correctedEnd = new Date(LATER.getTime() - 30 * 60 * 1000);
    const result = await updateTimesheet(TENANT, 'ts-id-1', { actualEnd: correctedEnd });

    expect(result.status).toBe('pending');
  });

  it('throws 400 when editing an exported timesheet', async () => {
    const ts = makeTimesheetDoc({ status: 'exported' });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);

    await expect(updateTimesheet(TENANT, 'ts-id-1', { notes: 'edit attempt' }))
      .rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('exported') });
  });
});

// ── approveTimesheet ──────────────────────────────────────────────────────────
describe('approveTimesheet', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves a pending timesheet and records approver and timestamp', async () => {
    const ts = makeTimesheetDoc({ status: 'pending' });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);
    vi.mocked(peers.m3.addPayrollLine).mockResolvedValue(true);

    const result = await approveTimesheet(TENANT, 'ts-id-1', 'approver-user');

    expect(result.status).toBe('approved');
    expect(ts.approvedBy).toBeDefined();
    expect(ts.approvedAt).toBeDefined();
    expect(ts.save).toHaveBeenCalled();
  });

  it('approves a disputed timesheet', async () => {
    const ts = makeTimesheetDoc({ status: 'disputed' });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);
    vi.mocked(peers.m3.addPayrollLine).mockResolvedValue(true);

    const result = await approveTimesheet(TENANT, 'ts-id-1', 'approver-user');

    expect(result.status).toBe('approved');
  });

  it('throws 400 when trying to approve an already-approved timesheet', async () => {
    const ts = makeTimesheetDoc({ status: 'approved' });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);

    await expect(approveTimesheet(TENANT, 'ts-id-1', 'approver-user'))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('enqueues outbox event when M3 peer is unreachable', async () => {
    const ts = makeTimesheetDoc({ status: 'pending' });
    mockTimesheet.findOne = vi.fn().mockResolvedValue(ts);
    vi.mocked(peers.m3.addPayrollLine).mockResolvedValue(false);

    const { enqueueOutbox } = await import('../utils/outbox');
    await approveTimesheet(TENANT, 'ts-id-1', 'approver-user');

    expect(enqueueOutbox).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'timesheet.approved', targetModule: 'm3' })
    );
  });
});

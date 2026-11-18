import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { Worker } from '../models/Worker';
import { Timesheet } from '../models/Timesheet';
import { Invoice } from '../models/Invoice';
import { Shift } from '../models/Shift';

const router = Router();
router.use(requireAuth);
router.use(requireRole('agency_admin', 'disponent'));

// Minimal CSV serialiser — escapes quotes, wraps fields with commas/quotes
function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  return '﻿' + lines.join('\r\n'); // BOM for Excel UTF-8 detection
}

function sendCsv(res: import('express').Response, filename: string, rows: Record<string, unknown>[]) {
  res
    .setHeader('Content-Type', 'text/csv; charset=utf-8')
    .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    .send(toCsv(rows));
}

// GET /api/reports/documents?days=60
// Returns all workers with at least one document that expires within `days` or is already expired.
// Scoped to the requesting agency's tenantId — no cross-tenant data.
router.get(
  '/documents',
  asyncHandler(async (req, res) => {
    const days = Math.min(Number(req.query.days) || 60, 365);
    const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const now = new Date();

    const workers = await Worker.find(
      {
        tenantId: req.user!.tenantId,
        'documents.expiryDate': { $exists: true, $ne: null },
        status: { $in: ['active', 'pending_review'] },
      },
      {
        firstName: 1,
        lastName: 1,
        status: 1,
        nationality: 1,
        documents: 1,
      }
    ).lean();

    const rows = workers
      .map((w) => {
        const relevantDocs = w.documents
          .filter((d) => d.expiryDate && new Date(d.expiryDate) <= horizon)
          .map((d) => ({
            _id: d._id,
            category: d.category,
            label: d.label,
            expiryDate: d.expiryDate,
            verified: d.verified,
            expired: new Date(d.expiryDate!) < now,
            daysLeft: Math.ceil(
              (new Date(d.expiryDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            ),
          }))
          .sort((a, b) => a.daysLeft - b.daysLeft);

        return relevantDocs.length > 0
          ? {
              workerId: w._id,
              firstName: w.firstName,
              lastName: w.lastName,
              status: w.status,
              nationality: w.nationality,
              documents: relevantDocs,
              // Most urgent doc drives the row priority
              minDaysLeft: relevantDocs[0].daysLeft,
              hasExpired: relevantDocs.some((d) => d.expired),
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a!.minDaysLeft - b!.minDaysLeft);

    res.json({ days, horizon, total: rows.length, rows });
  })
);

// GET /api/reports/worker-utilization?from=YYYY-MM-DD&to=YYYY-MM-DD
// Aggregates approved timesheets by worker for the given period.
router.get(
  '/worker-utilization',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(now.getFullYear(), 0, 1);
    const toDate = req.query.to
      ? new Date(req.query.to as string)
      : now;

    const rows = await Timesheet.aggregate([
      {
        $match: {
          tenantId: req.user!.tenantId,
          shiftDate: { $gte: fromDate, $lte: toDate },
          status: 'approved',
        },
      },
      {
        $group: {
          _id: {
            workerId: '$workerId',
            month: { $dateToString: { format: '%Y-%m', date: '$shiftDate' } },
          },
          workerName: { $first: '$workerName' },
          hours: { $sum: '$totalHours' },
          grossPay: { $sum: '$grossPay' },
          shiftCount: { $sum: 1 },
        },
      },
      { $sort: { '_id.month': 1 } },
      {
        $group: {
          _id: '$_id.workerId',
          workerName: { $first: '$workerName' },
          totalHours: { $sum: '$hours' },
          totalGrossPay: { $sum: '$grossPay' },
          shiftCount: { $sum: '$shiftCount' },
          monthly: {
            $push: {
              month: '$_id.month',
              hours: '$hours',
              grossPay: '$grossPay',
              shiftCount: '$shiftCount',
            },
          },
        },
      },
      { $sort: { totalHours: -1 } },
    ]);

    const workerIds = rows.map((r) => r._id);
    const workers = await Worker.find({ _id: { $in: workerIds } }, { status: 1 }).lean();
    const statusMap = Object.fromEntries(workers.map((w) => [w._id.toString(), w.status]));

    const result = rows.map((r) => ({
      workerId: r._id.toString(),
      workerName: r.workerName as string,
      workerStatus: statusMap[r._id.toString()] ?? 'inactive',
      totalHours: Math.round((r.totalHours as number) * 10) / 10,
      totalGrossPay: Math.round((r.totalGrossPay as number) * 100) / 100,
      shiftCount: r.shiftCount as number,
      monthly: r.monthly as Array<{ month: string; hours: number; grossPay: number; shiftCount: number }>,
    }));

    if (req.query.format === 'csv') {
      const csvRows = result.map((r) => ({
        Mitarbeiter: r.workerName,
        Status: r.workerStatus,
        Stunden: r.totalHours,
        Brutto: r.totalGrossPay,
        Einsätze: r.shiftCount,
      }));
      const fname = `auslastung-${fromDate.toISOString().slice(0, 10)}-${toDate.toISOString().slice(0, 10)}.csv`;
      return sendCsv(res, fname, csvRows);
    }

    res.json({ from: fromDate, to: toDate, total: result.length, rows: result });
  })
);

// GET /api/reports/client-revenue?from=YYYY-MM-DD&to=YYYY-MM-DD
// Aggregates non-cancelled invoices by business for the given period.
router.get(
  '/client-revenue',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(now.getFullYear(), 0, 1);
    const toDate = req.query.to
      ? new Date(req.query.to as string)
      : now;

    const rows = await Invoice.aggregate([
      {
        $match: {
          tenantId: req.user!.tenantId,
          invoiceDate: { $gte: fromDate, $lte: toDate },
          status: { $ne: 'cancelled' },
        },
      },
      {
        $group: {
          _id: '$businessId',
          businessName: { $first: '$businessName' },
          invoiceCount: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          outstandingAmount: {
            $sum: {
              $cond: [{ $in: ['$status', ['sent', 'overdue']] }, '$total', 0],
            },
          },
          totalHours: { $sum: { $sum: '$lineItems.hours' } },
        },
      },
      { $sort: { totalRevenue: -1 } },
    ]);

    const grandTotal = rows.reduce((s, r) => s + (r.totalRevenue as number), 0);
    const grandOutstanding = rows.reduce((s, r) => s + (r.outstandingAmount as number), 0);

    res.json({
      from: fromDate,
      to: toDate,
      total: rows.length,
      grandTotal: Math.round(grandTotal * 100) / 100,
      grandOutstanding: Math.round(grandOutstanding * 100) / 100,
      rows: rows.map((r) => ({
        businessId: r._id.toString(),
        businessName: r.businessName as string,
        invoiceCount: r.invoiceCount as number,
        totalRevenue: Math.round((r.totalRevenue as number) * 100) / 100,
        outstandingAmount: Math.round((r.outstandingAmount as number) * 100) / 100,
        totalHours: Math.round((r.totalHours as number) * 10) / 10,
      })),
    });
  })
);

// GET /api/reports/shift-details?from=YYYY-MM-DD&to=YYYY-MM-DD&workerId=&businessId=&status=
// Returns a paginated list of timesheets for the given period, optionally filtered.
router.get(
  '/shift-details',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = req.query.to
      ? new Date(req.query.to as string)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const filter: Record<string, unknown> = {
      tenantId: req.user!.tenantId,
      shiftDate: { $gte: fromDate, $lte: toDate },
    };
    if (req.query.workerId)   filter.workerId   = req.query.workerId;
    if (req.query.businessId) filter.businessId = req.query.businessId;
    if (req.query.status)     filter.status     = req.query.status;

    const page  = Math.max(1, Number(req.query.page  || 1));
    const limit = Math.min(200, Number(req.query.limit || 100));
    const skip  = (page - 1) * limit;

    const [rows, total] = await Promise.all([
      Timesheet.find(filter)
        .sort({ shiftDate: 1, workerName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Timesheet.countDocuments(filter),
    ]);

    const summary = rows.reduce(
      (acc, r) => {
        acc.totalHours    += r.totalHours;
        acc.totalGrossPay += r.grossPay;
        return acc;
      },
      { totalHours: 0, totalGrossPay: 0 }
    );

    const mapped = rows.map((r) => ({
      _id:                  r._id.toString(),
      workerName:           r.workerName,
      workerId:             r.workerId.toString(),
      businessName:         r.businessName,
      businessId:           r.businessId.toString(),
      shiftDate:            r.shiftDate ? new Date(r.shiftDate).toLocaleDateString('de-DE') : '',
      actualStart:          r.actualStart ? new Date(r.actualStart).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
      actualEnd:            r.actualEnd ? new Date(r.actualEnd).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
      actualBreakMinutes:   r.actualBreakMinutes,
      totalHours:           r.totalHours,
      payRatePerHour:       r.payRatePerHour,
      billingRatePerHour:   r.billingRatePerHour,
      grossPay:             r.grossPay,
      status:               r.status,
    }));

    if (req.query.format === 'csv') {
      const fname = `schichtbericht-${fromDate.toISOString().slice(0, 10)}-${toDate.toISOString().slice(0, 10)}.csv`;
      return sendCsv(res, fname, mapped);
    }

    res.json({
      from: fromDate,
      to:   toDate,
      page,
      limit,
      total,
      totalHours:    Math.round(summary.totalHours    * 100) / 100,
      totalGrossPay: Math.round(summary.totalGrossPay * 100) / 100,
      rows: mapped,
    });
  })
);

// GET /api/reports/open-shifts?from=YYYY-MM-DD&to=YYYY-MM-DD&businessId=
// Returns published shifts with unfilled worker slots, optionally filtered by date range / business.
router.get(
  '/open-shifts',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const now = new Date();
    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : now;
    const toDate = req.query.to
      ? new Date(req.query.to as string)
      : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const filter: Record<string, unknown> = {
      tenantId,
      status: 'published',
      startTime: { $gte: fromDate, $lte: toDate },
    };
    if (req.query.businessId) filter.businessId = req.query.businessId;

    const shifts = await Shift.find(filter)
      .select('title businessId businessName locationName startTime endTime requiredWorkers assignedWorkers payRatePerHour')
      .sort({ startTime: 1 })
      .lean();

    // Only keep shifts that have at least one open slot
    const URGENT_MS = 48 * 60 * 60 * 1000;

    const rows = shifts
      .map((s) => {
        const filledCount = s.assignedWorkers.filter(
          (w) => w.status !== 'no_show'
        ).length;
        const openSlots = s.requiredWorkers - filledCount;
        return { s, filledCount, openSlots };
      })
      .filter(({ openSlots }) => openSlots > 0)
      .map(({ s, filledCount, openSlots }) => ({
        _id: s._id.toString(),
        title: s.title,
        businessId: s.businessId.toString(),
        businessName: s.businessName,
        locationName: s.locationName,
        startTime: s.startTime,
        endTime: s.endTime,
        requiredWorkers: s.requiredWorkers,
        filledCount,
        openSlots,
        payRatePerHour: s.payRatePerHour,
        urgent: new Date(s.startTime).getTime() - now.getTime() <= URGENT_MS,
        hoursUntilStart: Math.max(0, Math.round((new Date(s.startTime).getTime() - now.getTime()) / 3_600_000)),
      }));

    // Per-business summary
    const byBusiness: Record<string, { businessName: string; shiftCount: number; openSlots: number }> = {};
    for (const row of rows) {
      if (!byBusiness[row.businessId]) {
        byBusiness[row.businessId] = { businessName: row.businessName, shiftCount: 0, openSlots: 0 };
      }
      byBusiness[row.businessId].shiftCount++;
      byBusiness[row.businessId].openSlots += row.openSlots;
    }

    res.json({
      asOf: now,
      from: fromDate,
      to: toDate,
      total: rows.length,
      totalOpenSlots: rows.reduce((s, r) => s + r.openSlots, 0),
      urgentCount: rows.filter((r) => r.urgent).length,
      byBusiness: Object.entries(byBusiness).map(([businessId, d]) => ({ businessId, ...d })),
      rows,
    });
  })
);

// GET /api/reports/invoice-aging
// Buckets open invoices (sent + overdue) by days past due into 0-30, 31-60, 61-90, 91+ bands.
// Restricted to agency_admin; disponents may not see invoice financials.
router.get(
  '/invoice-aging',
  requireRole('agency_admin'),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId;
    const now = new Date();

    const openInvoices = await Invoice.find({
      tenantId,
      status: { $in: ['sent', 'overdue'] },
    })
      .select('invoiceNumber businessId businessName invoiceDate dueDate total status')
      .sort({ dueDate: 1 })
      .lean();

    type AgingBucket = '0_30' | '31_60' | '61_90' | '91_plus';

    interface AgingRow {
      _id: string;
      invoiceNumber: string;
      businessId: string;
      businessName: string;
      invoiceDate: Date;
      dueDate: Date;
      total: number;
      status: string;
      daysPastDue: number;
      bucket: AgingBucket;
    }

    const rows: AgingRow[] = openInvoices.map((inv) => {
      const daysPastDue = Math.max(
        0,
        Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24))
      );
      let bucket: AgingBucket;
      if (daysPastDue <= 30)      bucket = '0_30';
      else if (daysPastDue <= 60) bucket = '31_60';
      else if (daysPastDue <= 90) bucket = '61_90';
      else                        bucket = '91_plus';

      return {
        _id: inv._id.toString(),
        invoiceNumber: inv.invoiceNumber,
        businessId: inv.businessId.toString(),
        businessName: inv.businessName,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total: inv.total,
        status: inv.status,
        daysPastDue,
        bucket,
      };
    });

    // Summary totals per bucket
    const buckets: Record<AgingBucket, { count: number; total: number }> = {
      '0_30':   { count: 0, total: 0 },
      '31_60':  { count: 0, total: 0 },
      '61_90':  { count: 0, total: 0 },
      '91_plus': { count: 0, total: 0 },
    };
    for (const row of rows) {
      buckets[row.bucket].count++;
      buckets[row.bucket].total = Math.round((buckets[row.bucket].total + row.total) * 100) / 100;
    }

    // Per-business summary
    const byBusiness: Record<string, { businessName: string; buckets: typeof buckets }> = {};
    for (const row of rows) {
      if (!byBusiness[row.businessId]) {
        byBusiness[row.businessId] = {
          businessName: row.businessName,
          buckets: {
            '0_30':   { count: 0, total: 0 },
            '31_60':  { count: 0, total: 0 },
            '61_90':  { count: 0, total: 0 },
            '91_plus': { count: 0, total: 0 },
          },
        };
      }
      byBusiness[row.businessId].buckets[row.bucket].count++;
      byBusiness[row.businessId].buckets[row.bucket].total = Math.round(
        (byBusiness[row.businessId].buckets[row.bucket].total + row.total) * 100
      ) / 100;
    }

    const grandTotal = rows.reduce((s, r) => s + r.total, 0);

    res.json({
      asOf: now,
      total: rows.length,
      grandTotal: Math.round(grandTotal * 100) / 100,
      buckets,
      byBusiness: Object.entries(byBusiness).map(([businessId, data]) => ({
        businessId,
        businessName: data.businessName,
        buckets: data.buckets,
      })),
      rows,
    });
  })
);

export default router;

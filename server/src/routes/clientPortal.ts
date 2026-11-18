import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Business } from '../models/Business';
import { Shift } from '../models/Shift';
import { Invoice } from '../models/Invoice';
import type { Types } from 'mongoose';
import { generateInvoicePdf } from '../utils/invoicePdf';

const router = Router();
router.use(requireAuth);
router.use(requireRole('business_contact'));

// Attach the business document to every request
async function resolveBusiness(req: Request, _res: Response, next: NextFunction) {
  const userId = req.user!.userId;
  const tenantId = req.user!.tenantId!;

  const business = await Business.findOne({
    tenantId,
    'contacts.userId': userId,
  });

  if (!business) {
    return next(new AppError('No linked business found for this account', 403));
  }

  (req as Request & { business: typeof business }).business = business;
  next();
}

router.use(asyncHandler(resolveBusiness));

function getBusiness(req: Request) {
  return (req as Request & { business: InstanceType<typeof Business> }).business;
}

// GET /api/client-portal/me
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const userId = req.user!.userId;
    const contact = business.contacts.find(
      (c) => c.userId?.toString() === userId
    );
    res.json({ business, contact });
  })
);

// GET /api/client-portal/dashboard
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const now = new Date();

    const [upcomingShifts, openInvoices, totalInvoiced] = await Promise.all([
      Shift.find({
        tenantId,
        businessId: business._id,
        status: { $in: ['published', 'completed'] },
        startTime: { $gte: now },
      })
        .sort({ startTime: 1 })
        .limit(5)
        .lean(),

      Invoice.countDocuments({
        tenantId,
        businessId: business._id,
        status: { $in: ['sent', 'overdue'] },
      }),

      Invoice.aggregate([
        {
          $match: {
            tenantId: business.tenantId as Types.ObjectId,
            businessId: business._id as Types.ObjectId,
            status: { $in: ['sent', 'paid', 'overdue'] },
          },
        },
        { $group: { _id: null, total: { $sum: '$total' } } },
      ]),
    ]);

    res.json({
      businessName: business.name,
      upcomingShifts,
      upcomingShiftsCount: upcomingShifts.length,
      openInvoicesCount: openInvoices,
      totalInvoiced: totalInvoiced[0]?.total ?? 0,
    });
  })
);

// GET /api/client-portal/shifts?status=upcoming|past|all
router.get(
  '/shifts',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const { status = 'upcoming' } = req.query as { status?: string };
    const now = new Date();

    const baseFilter = {
      tenantId,
      businessId: business._id,
      status: { $ne: 'draft' } as Record<string, unknown>,
    };

    if (status === 'upcoming') {
      Object.assign(baseFilter, { startTime: { $gte: now } });
    } else if (status === 'past') {
      Object.assign(baseFilter, { startTime: { $lt: now } });
    }

    const shifts = await Shift.find(baseFilter).sort({ startTime: status === 'past' ? -1 : 1 }).lean();
    res.json(shifts);
  })
);

// GET /api/client-portal/shifts/:id
router.get(
  '/shifts/:id',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const shift = await Shift.findOne({
      _id: req.params.id,
      tenantId,
      businessId: business._id,
    }).lean();
    if (!shift) throw new AppError('Shift not found', 404);
    res.json(shift);
  })
);

// GET /api/client-portal/shifts/:id/attendance
router.get(
  '/shifts/:id/attendance',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const shift = await Shift.findOne({
      _id: req.params.id,
      tenantId,
      businessId: business._id,
    }).lean();
    if (!shift) throw new AppError('Shift not found', 404);

    // Return attendance data without private location details
    const attendance = shift.assignedWorkers.map((aw) => ({
      workerName: aw.workerName,
      status: aw.status,
      checkInTime: aw.checkInTime,
      checkOutTime: aw.checkOutTime,
    }));

    res.json({
      shiftId: shift._id,
      title: shift.title,
      startTime: shift.startTime,
      endTime: shift.endTime,
      attendance,
    });
  })
);

// GET /api/client-portal/invoices?status=open|paid|all
router.get(
  '/invoices',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const { status = 'all' } = req.query as { status?: string };

    const filter: Record<string, unknown> = { tenantId, businessId: business._id };
    if (status === 'open') filter.status = { $in: ['sent', 'overdue'] };
    else if (status === 'paid') filter.status = 'paid';

    const invoices = await Invoice.find(filter).sort({ invoiceDate: -1 }).lean();
    res.json(invoices);
  })
);

// GET /api/client-portal/invoices/:id
router.get(
  '/invoices/:id',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId,
      businessId: business._id,
    }).lean();
    if (!invoice) throw new AppError('Invoice not found', 404);
    res.json(invoice);
  })
);

// GET /api/client-portal/invoices/:id/pdf
router.get(
  '/invoices/:id/pdf',
  asyncHandler(async (req, res) => {
    const business = getBusiness(req);
    const tenantId = req.user!.tenantId!;
    const invoice = await Invoice.findOne({
      _id: req.params.id,
      tenantId,
      businessId: business._id,
    });
    if (!invoice) throw new AppError('Invoice not found', 404);
    const pdf = await generateInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.end(pdf);
  })
);

export default router;

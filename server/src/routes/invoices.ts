import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import * as invoiceService from '../services/invoice.service';
import { generateInvoicePdf } from '../utils/invoicePdf';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

// GET /api/invoices
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { status, businessId, from, to, page, limit } = req.query as Record<string, string>;
    const result = await invoiceService.listInvoices(tenantId, {
      status: status as invoiceService.InvoiceFilters['status'],
      businessId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
    res.json(result);
  })
);

// GET /api/invoices/invoiceable-timesheets?businessId=xxx
router.get(
  '/invoiceable-timesheets',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { businessId } = req.query as { businessId: string };
    if (!businessId) { res.status(400).json({ message: 'businessId required' }); return; }
    const timesheets = await invoiceService.getInvoiceableTimesheets(tenantId, businessId);
    res.json(timesheets);
  })
);

// GET /api/invoices/datev-export?from=&to=
router.get(
  '/datev-export',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { from, to } = req.query as Record<string, string>;
    const result = await invoiceService.listInvoices(tenantId, {
      status: undefined,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: 5000,
    });

    const BOM = '﻿';
    const header = 'Belegdatum;Buchungstext;Betrag;Konto;GegKonto;Belegnummer;Kostenstelle';
    const rows = result.invoices
      .filter((inv) => inv.status === 'sent' || inv.status === 'paid')
      .map((inv) => {
        const date = new Date(inv.invoiceDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const amount = Number(inv.total).toFixed(2).replace('.', ',');
        return `${date};${inv.businessName};${amount};1400;4400;${inv.invoiceNumber};`;
      });

    const csv = BOM + [header, ...rows].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="datev_export.csv"');
    res.send(csv);
  })
);

// GET /api/invoices/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const invoice = await invoiceService.getInvoice(tenantId, req.params.id);
    res.json(invoice);
  })
);

// POST /api/invoices
router.post(
  '/',
  validate(
    z.object({
      businessId: z.string().min(1),
      timesheetIds: z.array(z.string()).min(1),
      invoiceDate: z.coerce.date(),
      dueDate: z.coerce.date(),
      periodFrom: z.coerce.date(),
      periodTo: z.coerce.date(),
      notes: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const invoice = await invoiceService.createInvoice(tenantId, req.body, req.user!.userId);
    res.status(201).json(invoice);
  })
);

// GET /api/invoices/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const invoice = await invoiceService.getInvoice(tenantId, req.params.id);
    const pdf = await generateInvoicePdf(invoice);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
    res.end(pdf);
  })
);

// PATCH /api/invoices/:id/status
router.patch(
  '/:id/status',
  validate(z.object({ status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']) })),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const invoice = await invoiceService.updateInvoiceStatus(tenantId, req.params.id, req.body.status);
    res.json(invoice);
  })
);

export default router;

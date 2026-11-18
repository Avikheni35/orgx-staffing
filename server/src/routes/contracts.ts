import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Contract } from '../models/Contract';
import { htmlToPdf, buildContractPdfHtml } from '../utils/pdf';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

// GET /api/contracts — list with optional status filter
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { status, shiftId } = req.query as Record<string, string>;

    const query: Record<string, unknown> = { tenantId };
    if (status && status !== 'all') query.status = status;
    if (shiftId) query.shiftId = shiftId;

    const contracts = await Contract.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json(contracts);
  })
);

// GET /api/contracts/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const contract = await Contract.findOne({ _id: req.params.id, tenantId }).lean();
    if (!contract) throw new AppError('Contract not found', 404);
    res.json(contract);
  })
);

// GET /api/contracts/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const contract = await Contract.findOne({ _id: req.params.id, tenantId }).lean();
    if (!contract) throw new AppError('Contract not found', 404);

    const fullHtml = buildContractPdfHtml(
      contract.contractHtml,
      contract.signatureData,
      contract.signedAt,
    );
    const pdf = await htmlToPdf(fullHtml);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Vertrag_${contract.workerName.replace(/\s+/g, '_')}.pdf"`);
    res.end(pdf);
  })
);

export default router;

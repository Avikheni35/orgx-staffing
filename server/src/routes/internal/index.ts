import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { requireServiceToken } from '../../middleware/requireServiceToken';
import { notify } from '../../utils/notify';
import { NotificationType } from '../../models/Notification';

const router = Router();
router.use(asyncHandler(requireServiceToken));

// GET /api/internal/health — liveness ping for Test Connection
router.get(
  '/health',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, module: 'm1' });
  })
);

// POST /api/internal/notifications — push a cross-module notification to M1
router.post(
  '/notifications',
  asyncHandler(async (req, res) => {
    const tenantId = req.internalTenantId!;
    const { type, title, body, recipientRoles } = req.body as {
      type: NotificationType;
      title: string;
      body: string;
      recipientRoles?: string[];
    };

    if (!type || !title || !body) {
      res.status(400).json({ message: 'type, title, and body are required' });
      return;
    }

    await notify({
      tenantId,
      type,
      title,
      body,
      recipientRoles: recipientRoles ?? ['agency_admin'],
    });

    res.json({ ok: true });
  })
);


export default router;

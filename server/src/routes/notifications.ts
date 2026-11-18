import { Router } from 'express';
import { Types } from 'mongoose';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { asyncHandler } from '../utils/asyncHandler';
import { Notification } from '../models/Notification';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

// GET /api/notifications?limit=20&skip=0
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = new Types.ObjectId(req.user!.userId);
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const skip = Number(req.query.skip) || 0;

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ tenantId, recipientUserId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ tenantId, recipientUserId: userId, readAt: null }),
    ]);

    res.json({ notifications, unreadCount });
  })
);

// PATCH /api/notifications/read-all
router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    const userId = new Types.ObjectId(req.user!.userId);
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    await Notification.updateMany(
      { tenantId, recipientUserId: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  })
);

// PATCH /api/notifications/:id/read
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const userId = new Types.ObjectId(req.user!.userId);
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    await Notification.updateOne(
      { _id: req.params.id, tenantId, recipientUserId: userId },
      { $set: { readAt: new Date() } }
    );
    res.json({ ok: true });
  })
);

export default router;

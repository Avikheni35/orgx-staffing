import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { Message } from '../models/Message';
import { Worker } from '../models/Worker';
import { User } from '../models/User';

const router = Router();
router.use(requireAuth);
router.use(requireRole('super_admin', 'agency_admin', 'disponent'));

const sendSchema = z.object({
  body: z.string().min(1).max(2000),
});

// GET /api/messages — list threads (one per worker, with latest message + unread count)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;

    // Aggregate: for each workerId, get latest message and count of unread (agency hasn't read = senderRole=worker, no readAt)
    const threads = await Message.aggregate([
      { $match: { tenantId: new Types.ObjectId(tenantId) } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: '$workerId',
          workerName: { $first: '$workerName' },
          latestBody: { $first: '$body' },
          latestAt: { $first: '$createdAt' },
          latestSenderRole: { $first: '$senderRole' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$senderRole', 'worker'] }, { $eq: ['$readAt', null] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { latestAt: -1 } },
    ]);

    res.json(threads);
  })
);

// GET /api/messages/:workerId — get thread messages + mark worker→agency as read
router.get(
  '/:workerId',
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { workerId } = req.params;

    const worker = await Worker.findOne({ _id: workerId, tenantId }).lean();
    if (!worker) throw new AppError('Worker not found', 404);

    const messages = await Message.find({ tenantId, workerId })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    // Mark unread worker→agency messages as read
    const unreadIds = messages
      .filter((m) => m.senderRole === 'worker' && !m.readAt)
      .map((m) => m._id);
    if (unreadIds.length) {
      await Message.updateMany({ _id: { $in: unreadIds } }, { $set: { readAt: new Date() } });
    }

    res.json({ worker, messages });
  })
);

// POST /api/messages/:workerId — send message to worker
router.post(
  '/:workerId',
  validate(sendSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { workerId } = req.params;

    const [worker, sender] = await Promise.all([
      Worker.findOne({ _id: workerId, tenantId }).lean(),
      User.findById(req.user!.userId).select('firstName lastName').lean(),
    ]);
    if (!worker) throw new AppError('Worker not found', 404);

    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`.trim()
      : 'Agentur';

    const message = await Message.create({
      tenantId,
      workerId: worker._id,
      workerName: `${worker.firstName} ${worker.lastName}`,
      senderRole: 'agency',
      senderId: req.user!.userId,
      senderName,
      body: req.body.body,
    });

    res.status(201).json(message);
  })
);

const broadcastSchema = z.object({
  body: z.string().min(1).max(2000),
  subject: z.string().min(1).max(200),
  workerStatus: z.enum(['active', 'inactive', 'pending_review', 'suspended', 'blacklisted', 'all']).optional(),
  workerIds: z.array(z.string()).optional(),
});

// POST /api/messages/broadcast
router.post(
  '/broadcast',
  validate(broadcastSchema),
  asyncHandler(async (req, res) => {
    const tenantId = req.user!.tenantId ?? req.tenantId!;
    const { body: msgBody, subject, workerStatus, workerIds } = req.body as z.infer<typeof broadcastSchema>;

    const workerFilter: Record<string, unknown> = { tenantId: new Types.ObjectId(tenantId) };
    if (workerIds && workerIds.length > 0) {
      workerFilter._id = { $in: workerIds.map((id) => new Types.ObjectId(id)) };
    } else if (workerStatus && workerStatus !== 'all') {
      workerFilter.status = workerStatus;
    }

    const workers = await Worker.find(workerFilter).select('_id firstName lastName').lean();
    if (workers.length === 0) {
      return res.json({ sent: 0 });
    }

    const sender = await User.findById(req.user!.userId).lean();
    const senderName = sender ? `${sender.firstName} ${sender.lastName}`.trim() : 'Agentur';

    const docs = workers.map((w) => ({
      tenantId,
      workerId: w._id,
      workerName: `${w.firstName} ${w.lastName}`,
      senderRole: 'agency' as const,
      senderId: req.user!.userId,
      senderName,
      body: `**${subject}**\n\n${msgBody}`,
    }));

    await Message.insertMany(docs);
    res.json({ sent: workers.length });
  })
);

export default router;

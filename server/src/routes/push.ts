import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/asyncHandler';
import { AppError } from '../utils/AppError';
import { PushSubscription } from '../models/PushSubscription';
import { env } from '../config/env';
import { Types } from 'mongoose';

const router = Router();

router.get('/vapid-public-key', asyncHandler(async (_req, res) => {
  res.json({ publicKey: env.PUSH_VAPID_PUBLIC_KEY || null });
}));

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth:   z.string().min(1),
  }),
});

router.post('/subscribe', requireAuth, validate(subscribeSchema), asyncHandler(async (req, res) => {
  if (!req.user || !req.tenantId) throw new AppError('Auth required', 401);
  const { endpoint, keys } = req.body as z.infer<typeof subscribeSchema>;
  await PushSubscription.findOneAndUpdate(
    { endpoint },
    { userId: new Types.ObjectId(req.user.userId), tenantId: req.tenantId, endpoint, keys },
    { upsert: true, new: true }
  );
  res.json({ message: 'Subscribed' });
}));

router.delete('/unsubscribe', requireAuth, asyncHandler(async (req, res) => {
  if (!req.user) throw new AppError('Auth required', 401);
  const { endpoint } = req.body as { endpoint?: string };
  if (endpoint) {
    await PushSubscription.deleteOne({ userId: req.user.userId, endpoint });
  } else {
    await PushSubscription.deleteMany({ userId: req.user.userId });
  }
  res.json({ message: 'Unsubscribed' });
}));

export default router;

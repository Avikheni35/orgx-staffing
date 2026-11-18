import { Types } from 'mongoose';
import { env } from '../config/env';
import { PushSubscription } from '../models/PushSubscription';

interface WebPushLib {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (sub: object, payload: string) => Promise<unknown>;
}

function getWebPush(): WebPushLib | null {
  if (!env.PUSH_VAPID_PUBLIC_KEY || !env.PUSH_VAPID_PRIVATE_KEY) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wp = require('web-push') as WebPushLib;
    wp.setVapidDetails(env.PUSH_VAPID_SUBJECT, env.PUSH_VAPID_PUBLIC_KEY, env.PUSH_VAPID_PRIVATE_KEY);
    return wp;
  } catch {
    return null;
  }
}

export async function sendPushToUser(userId: Types.ObjectId | string, payload: { title: string; body: string; url?: string }): Promise<void> {
  const wp = getWebPush();
  if (!wp) return;
  const subs = await PushSubscription.find({ userId });
  const json = JSON.stringify(payload);
  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await wp.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, json);
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}

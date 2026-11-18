import { Types } from 'mongoose';
import { Notification, NotificationType } from '../models/Notification';
import { User } from '../models/User';
import { sendPushToUser } from './push';

interface NotifyOpts {
  tenantId: string | Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  /** Notify these specific user IDs */
  recipientIds?: (string | Types.ObjectId)[];
  /** Or notify all users with these roles in the tenant */
  recipientRoles?: string[];
}

export async function notify(opts: NotifyOpts): Promise<void> {
  try {
    const { tenantId, type, title, body, link, recipientIds, recipientRoles } = opts;

    let ids: Types.ObjectId[] = [];

    if (recipientIds?.length) {
      ids = recipientIds.map((id) => new Types.ObjectId(id.toString()));
    } else if (recipientRoles?.length) {
      const users = await User.find({
        tenantId: new Types.ObjectId(tenantId.toString()),
        role: { $in: recipientRoles },
        accountStatus: 'active',
      })
        .select('_id')
        .lean();
      ids = users.map((u) => u._id as Types.ObjectId);
    }

    if (!ids.length) return;

    await Notification.insertMany(
      ids.map((recipientUserId) => ({
        tenantId: new Types.ObjectId(tenantId.toString()),
        recipientUserId,
        type,
        title,
        body,
        link,
        readAt: null,
      }))
    );

    // Best-effort push notifications (no-op if VAPID keys not configured)
    await Promise.allSettled(ids.map(id => sendPushToUser(id, { title, body, url: link })));
  } catch {
    // fire-and-forget — never throw
  }
}

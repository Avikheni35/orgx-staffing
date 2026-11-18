import { OutboxEvent } from '../models/OutboxEvent';
import { IntegrationSettings } from '../models/IntegrationSettings';

const MAX_ATTEMPTS = 10;
const INTERVAL_MS  = 60_000;

async function runRetry(): Promise<void> {
  const pending = await OutboxEvent.find({
    status: 'pending',
    attempts: { $lt: MAX_ATTEMPTS },
  }).limit(50);

  for (const evt of pending) {
    const settings = await IntegrationSettings
      .findOne({ tenantId: evt.tenantId })
      .lean();

    const peer = settings?.connectedServices?.[evt.targetModule as 'm2' | 'm3'];

    evt.attempts++;
    evt.lastAttemptAt = new Date();

    if (!peer?.enabled || !peer.url || !peer.token) {
      if (evt.attempts >= MAX_ATTEMPTS) evt.status = 'failed';
      await evt.save();
      continue;
    }

    try {
      const res = await fetch(`${peer.url}${evt.targetPath}`, {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'x-service-token': peer.token,
          'x-caller-module': 'm1',
        },
        body: JSON.stringify(evt.payload),
        signal: AbortSignal.timeout(3000),
      });

      if (res.ok) {
        evt.status = 'delivered';
      } else if (evt.attempts >= MAX_ATTEMPTS) {
        evt.status = 'failed';
      }
    } catch {
      if (evt.attempts >= MAX_ATTEMPTS) evt.status = 'failed';
    }

    await evt.save();
  }
}

export function startOutboxRetry(): void {
  setInterval(() => {
    runRetry().catch((err) => console.error('[outboxRetry]', err));
  }, INTERVAL_MS);
}

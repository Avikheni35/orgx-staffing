import { IntegrationSettings } from '../models/IntegrationSettings';

type Peer = 'm2' | 'm3';

async function callPeer(
  tenantId: string,
  target: Peer,
  path: string,
  body: object
): Promise<boolean> {
  const settings = await IntegrationSettings
    .findOne({ tenantId })
    .select(`connectedServices.${target}`)
    .lean();

  const peer = settings?.connectedServices?.[target];
  if (!peer?.enabled || !peer.url || !peer.token) return false;

  try {
    const res = await fetch(`${peer.url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-service-token': peer.token,
        'x-caller-module': 'm1',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function pingPeer(tenantId: string, target: Peer): Promise<boolean> {
  const settings = await IntegrationSettings
    .findOne({ tenantId })
    .select(`connectedServices.${target}`)
    .lean();

  const peer = settings?.connectedServices?.[target];
  if (!peer?.enabled || !peer.url || !peer.token) return false;

  try {
    const res = await fetch(`${peer.url}/api/internal/health`, {
      method: 'GET',
      headers: {
        'x-service-token': peer.token,
        'x-caller-module': 'm1',
      },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const peers = {
  m3: {
    postJournalEntry: (tenantId: string, data: object) =>
      callPeer(tenantId, 'm3', '/api/internal/journal-entries', data),
    syncCustomer: (tenantId: string, data: object) =>
      callPeer(tenantId, 'm3', '/api/internal/customers', data),
    addPayrollLine: (tenantId: string, data: object) =>
      callPeer(tenantId, 'm3', '/api/internal/payroll-lines', data),
    ping: (tenantId: string) => pingPeer(tenantId, 'm3'),
  },
  m2: {
    workerOnboarded: (tenantId: string, data: object) =>
      callPeer(tenantId, 'm2', '/api/internal/worker-pool', data),
    ping: (tenantId: string) => pingPeer(tenantId, 'm2'),
  },
};

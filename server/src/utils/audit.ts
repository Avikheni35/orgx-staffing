import { Request } from 'express';
import { Types } from 'mongoose';
import { AuditLog, AuditAction } from '../models/AuditLog';

interface AuditParams {
  req: Request;
  action: AuditAction;
  targetType: string;
  targetId?: string;
  targetName?: string;
  details?: Record<string, unknown>;
}

/**
 * Fire-and-forget audit log write. Never throws — audit failures must not
 * block the primary operation. Call after the primary mutation succeeds.
 */
export function logAudit(params: AuditParams): void {
  const { req, action, targetType, targetId, targetName, details } = params;
  const user = req.user!;
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
    req.socket.remoteAddress;

  AuditLog.create({
    tenantId: user.tenantId ? new Types.ObjectId(user.tenantId as unknown as string) : null,
    actorId: new Types.ObjectId(user.userId as unknown as string),
    actorName: `${(req as unknown as { _actorName?: string })._actorName ?? user.userId}`,
    actorRole: user.role,
    action,
    targetType,
    targetId,
    targetName,
    details,
    ip,
  }).catch((err) => {
    console.error('[audit] write failed:', err?.message);
  });
}

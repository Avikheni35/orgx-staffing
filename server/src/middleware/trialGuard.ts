import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';

/**
 * Blocks requests from tenants whose trial period has expired.
 *
 * Rules:
 *   - super_admin (tenantId = null) always bypasses.
 *   - status !== 'trial' → not a trial, pass through (active/suspended handled elsewhere).
 *   - status === 'trial' AND trialEndsAt < now → 402 TRIAL_EXPIRED.
 *   - status === 'suspended' → 403 TENANT_SUSPENDED.
 *   - Fails open on DB error to avoid breaking legitimate tenants.
 */
export async function trialGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.tenantId) { next(); return; } // super_admin bypass

  try {
    const tenant = await Tenant.findById(req.tenantId).select('status trialEndsAt plan').lean();
    if (!tenant) { next(); return; }

    const t = tenant as { status: string; trialEndsAt?: Date; plan?: string };

    if (t.status === 'suspended') {
      res.status(403).json({
        message: 'Ihr Konto wurde gesperrt. Bitte kontaktieren Sie den Support.',
        code: 'TENANT_SUSPENDED',
      });
      return;
    }

    if (t.status === 'trial' && t.trialEndsAt && t.trialEndsAt < new Date()) {
      res.status(402).json({
        message: 'Ihre kostenlose Testphase ist abgelaufen. Bitte wählen Sie einen Plan, um fortzufahren.',
        code: 'TRIAL_EXPIRED',
        trialEndsAt: t.trialEndsAt,
      });
      return;
    }

    next();
  } catch {
    next(); // fail-open on DB error
  }
}

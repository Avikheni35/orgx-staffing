import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';

/**
 * Ensures the tenant for this request has the given module enabled.
 *
 * Privacy guarantee: a tenant that subscribed only to M2 cannot hit M1 data
 * endpoints, and vice versa — even with a valid JWT.
 *
 * Rules:
 *   - super_admin (tenantId = null) always bypasses — platform-level access.
 *   - If the tenant has NO enabledModules set, all modules are allowed
 *     (backward-compatible: existing tenants see no change).
 *   - If enabledModules is set but doesn't include this module → 403.
 */
export function requireModule(module: 'm1' | 'm2') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // super_admin bypasses module gating
    if (!req.tenantId) { next(); return; }

    try {
      const tenant = await Tenant.findById(req.tenantId).select('enabledModules').lean();
      if (!tenant) { res.status(403).json({ message: 'Tenant not found' }); return; }

      const enabled: string[] = (tenant as { enabledModules?: string[] }).enabledModules ?? [];
      // Empty array = field not set = backward-compat: allow everything
      if (enabled.length > 0 && !enabled.includes(module)) {
        res.status(403).json({
          message: `Dieses Modul (${module}) ist für Ihren Tenant nicht freigeschaltet.`,
          code: 'MODULE_NOT_ENABLED',
        });
        return;
      }
      next();
    } catch {
      next(); // fail-open on DB error to avoid breaking existing tenants
    }
  };
}

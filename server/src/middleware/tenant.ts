import { Request, Response, NextFunction } from 'express';
import { Tenant } from '../models/Tenant';
import { AppError } from '../utils/AppError';

function extractSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  return parts.length >= 3 ? parts[0] : null;
}

export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const code =
      (req.headers['x-tenant-code'] as string | undefined) ||
      extractSubdomain(req.hostname);

    if (!code) {
      next();
      return;
    }

    const tenant = await Tenant.findOne({
      $or: [{ subdomain: code }, { loginCode: code }],
      status: { $ne: 'suspended' },
    }).lean();

    if (!tenant) {
      next(new AppError('Tenant not found or suspended', 404));
      return;
    }

    req.tenantId = tenant._id.toString();
    next();
  } catch (err) {
    next(err);
  }
}

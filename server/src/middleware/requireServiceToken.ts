import { Request, Response, NextFunction } from 'express';
import { IntegrationSettings } from '../models/IntegrationSettings';

declare global {
  namespace Express {
    interface Request {
      internalTenantId?: string;
      callerModule?: 'm1' | 'm2' | 'm3';
    }
  }
}

export async function requireServiceToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.headers['x-service-token'] as string | undefined;
  if (!token) {
    res.status(403).json({ message: 'Missing x-service-token header' });
    return;
  }

  const settings = await IntegrationSettings.findOne({ ownServiceToken: token })
    .select('tenantId')
    .lean();

  if (!settings) {
    res.status(403).json({ message: 'Invalid service token' });
    return;
  }

  req.internalTenantId = settings.tenantId.toString();
  req.callerModule     = req.headers['x-caller-module'] as typeof req.callerModule;
  next();
}

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import type { UserRole } from '../types';

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('Insufficient permissions', 403));
      return;
    }
    next();
  };
}

export function requireSameTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError('Authentication required', 401));
    return;
  }
  if (req.user.role === 'super_admin') {
    next();
    return;
  }
  if (req.tenantId && req.user.tenantId !== req.tenantId) {
    next(new AppError('Access denied to this tenant', 403));
    return;
  }
  next();
}

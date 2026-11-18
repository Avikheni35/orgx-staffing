export type UserRole =
  | 'super_admin'
  | 'agency_admin'
  | 'disponent'
  | 'worker'
  | 'business_contact';

export interface JwtAccessPayload {
  userId: string;
  tenantId: string | null;
  role: UserRole;
  impersonatedBy?: string;
}

export interface JwtRefreshPayload {
  userId: string;
  tokenFamily: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtAccessPayload;
      tenantId?: string;
    }
  }
}

export type UserRole =
  | 'super_admin'
  | 'agency_admin'
  | 'disponent'
  | 'worker'
  | 'business_contact';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  language: 'de' | 'en';
}

export type PortalPath =
  | '/superadmin/dashboard'
  | '/app/dashboard'
  | '/worker/home'
  | '/client/dashboard';

export function portalHome(role: UserRole): PortalPath {
  switch (role) {
    case 'super_admin':       return '/superadmin/dashboard';
    case 'agency_admin':      return '/app/dashboard';
    case 'disponent':         return '/app/dashboard';
    case 'worker':            return '/worker/home';
    case 'business_contact':  return '/client/dashboard';
  }
}

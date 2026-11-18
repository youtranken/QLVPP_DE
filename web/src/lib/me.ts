import { createContext, useContext } from 'react';

export type Role = 'member' | 'admin' | 'sa';

export interface Me {
  sub: string;
  role: Role;
  csrfToken: string | null;
  fullName: string | null;
  email: string | null;
  department: string | null;
  employeeCode: string | null;
  // Claim `locale` của tài khoản PMH ID; null = phiên không có PMH ID (SA local, tài khoản thử, dev)
  locale: 'vi' | 'en' | null;
  localeUpdatedAt?: number | null;
  serverTime?: number;
  devMode?: boolean;
  config: {
    registration_last_day: number;
    default_max_qty: number;
  };
}

export const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe() called outside MeContext');
  return me;
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'sa';
}

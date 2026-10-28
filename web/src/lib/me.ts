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
  locale: 'vi' | 'en' | null;
  devMode?: boolean;
  config: {
    registration_last_day: number;
    default_max_qty: number;
    admin_contact: string;
  };
}

export const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe() ngoài MeContext');
  return me;
}

export function isAdminRole(role: Role): boolean {
  return role === 'admin' || role === 'sa';
}

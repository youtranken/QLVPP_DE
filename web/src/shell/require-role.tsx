import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAdminRole, useMe, type Role } from '@/lib/me';

// Chỉ ẩn giao diện; quyền thật do server kiểm (RolesGuard)
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useMe();
  if (!roles.includes(me.role)) return <Navigate to="/" replace />;
  return children;
}

export function RequireMember({ children }: { children: ReactNode }) {
  const me = useMe();
  if (isAdminRole(me.role)) return <Navigate to="/admin" replace />;
  return children;
}

import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMe, type Role } from '@/lib/me';

// Chỉ ẩn giao diện; quyền thật do server kiểm (RolesGuard)
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const me = useMe();
  if (!roles.includes(me.role)) return <Navigate to="/" replace />;
  return children;
}

import type { Role } from '@vpp/shared';

export interface Identity {
  role: Role;
  department: string | null;
}

/**
 * Map danh sách group PMH ID → vai trò + phòng ban.
 * - có `adminGroup` ⇒ role 'admin', ngược lại 'member'.
 * - phòng ban = group đầu tiên khác `adminGroup` (null nếu chỉ có group admin).
 */
export function mapGroups(groups: string[], adminGroup: string): Identity {
  const role: Role = groups.includes(adminGroup) ? 'admin' : 'member';
  const department = groups.find((group) => group !== adminGroup) ?? null;
  return { role, department };
}

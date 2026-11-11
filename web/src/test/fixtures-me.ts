import type { Me, Role } from '@/lib/me';

export function makeMe(role: Role, over: Partial<Me> = {}): Me {
  return {
    sub: `u-${role}`,
    role,
    csrfToken: 'csrf-1',
    fullName: 'Nguyễn Văn An',
    email: 'an.nguyen@pmh.com.vn',
    department: 'Phòng Công trình',
    employeeCode: 'NV0231',
    locale: null,
    config: { registration_last_day: 10, default_max_qty: 20, admin_contact: 'chị Bình — Adm D&E' },
    ...over,
  };
}

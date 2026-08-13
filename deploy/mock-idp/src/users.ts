/**
 * Người dùng demo — đúng bảng ở SSO-INTEGRATION §9.
 * `groups` là thứ quyết định vai trò & phòng ban phía DE-VPP:
 * có `VPP-Admin` ⇒ admin, group còn lại ⇒ phòng ban.
 */
export interface DemoUser {
  sub: string;
  email: string;
  full_name: string;
  employee_code: string;
  groups: string[];
}

export const DEMO_USERS: DemoUser[] = [
  {
    sub: 'usr_admin',
    email: 'admin@pmh.com.vn',
    full_name: 'Quản trị VPP',
    employee_code: 'NV000',
    groups: ['VPP-Admin', 'Hành chính'],
  },
  {
    sub: 'usr_an',
    email: 'an@pmh.com.vn',
    full_name: 'Nguyễn Văn An',
    employee_code: 'NV001',
    groups: ['Kinh doanh'],
  },
  {
    sub: 'usr_binh',
    email: 'binh@pmh.com.vn',
    full_name: 'Trần Thị Bình',
    employee_code: 'NV002',
    groups: ['Kế toán'],
  },
  {
    sub: 'usr_chi',
    email: 'chi@pmh.com.vn',
    full_name: 'Lê Văn Chí',
    employee_code: 'NV003',
    groups: ['Kỹ thuật'],
  },
  {
    sub: 'usr_dung',
    email: 'dung@pmh.com.vn',
    full_name: 'Phạm Thị Dung',
    employee_code: 'NV004',
    groups: ['Nhân sự'],
  },
  {
    sub: 'usr_em',
    email: 'em@pmh.com.vn',
    full_name: 'Hoàng Văn Em',
    employee_code: 'NV005',
    groups: ['Kinh doanh'],
  },
];

export function findDemoUser(sub: string): DemoUser | undefined {
  return DEMO_USERS.find((user) => user.sub === sub);
}

/** Mọi group xuất hiện trong danh bạ demo (phục vụ `GET /api/v1/groups`). */
export const DEMO_GROUPS = [...new Set(DEMO_USERS.flatMap((user) => user.groups))];

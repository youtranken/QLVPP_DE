import { vi } from 'vitest';
import { jsonResponse, screen } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminUser } from './directory.api';

// Dữ liệu mẫu + stub fetch dùng chung cho các test màn Người dùng (users-page, users-sync)

export const AN: AdminUser = {
  sub: 'u-an',
  email: 'an.nguyen@pmh.com.vn',
  employeeCode: 'NV0231',
  fullName: 'Phạm Minh Đức',
  department: 'Phòng Công trình',
  team: 'QS',
  role: 'admin',
  status: 'active',
  lastLoginAt: '2026-10-27T02:30:00.000Z',
};
export const BINH: AdminUser = { ...AN, sub: 'u-binh', fullName: 'Lê Thị Bình', employeeCode: 'NV0007', department: 'Phòng Kế toán', team: null, role: 'member', status: 'locked', lastLoginAt: null };
export const CHI: AdminUser = { ...AN, sub: 'u-chi', fullName: 'Trần Chi', employeeCode: 'NV0100', department: 'Phòng Công trình', team: null, role: 'member', lastLoginAt: null };
export const DUNG: AdminUser = { ...CHI, sub: 'u-dung', fullName: 'Vũ Dũng', employeeCode: 'NV0300', team: 'QS', status: 'no_access' };

type SyncRoute = () => Response;
type RegRoute = () => Response;

export const REG_URL = '/api/admin/periods/2026-11/unregistered';
export const regOf = (unregistered: AdminUser[], registered: string[]) => () =>
  jsonResponse(200, { items: unregistered.map((u) => ({ sub: u.sub, full_name: u.fullName, email: u.email, department: u.department })), registered_subs: registered });

export type SyncStatus = { last_at: string | null; last_total: number | null; last_error: { at: string; code: string; message: string } | null };
export const NEVER: SyncStatus = { last_at: null, last_total: null, last_error: null };

export function stubUsers(
  users: AdminUser[],
  sync: SyncRoute = () => jsonResponse(200, { created: 0, updated: 0, no_access: 0, reconcile: 'ok' }),
  reg: RegRoute = regOf([CHI], ['u-an']),
  status: () => SyncStatus = () => NEVER,
) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/directory/status') return Promise.resolve(jsonResponse(200, status()));
    if (url === REG_URL) return Promise.resolve(reg());
    if (url === '/api/admin/directory/sync' && init?.method === 'POST') return Promise.resolve(sync());
    if (url.startsWith('/api/admin/users')) {
      const params = new URL(url, 'http://x').searchParams;
      const search = params.get('search') ?? '';
      const from = Number(params.get('cursor') ?? 0);
      const size = Number(params.get('limit') ?? 50);
      const wantDeleted = params.get('status') === 'deleted';
      const rows = users.filter((u) => (u.status === 'deleted') === wantDeleted && (u.fullName ?? '').includes(search));
      const items = rows.slice(from, from + size);
      const next = from + size < rows.length ? String(from + size) : null;
      return Promise.resolve(jsonResponse(200, { items, next_cursor: next }));
    }
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 4, previous: null, owed: [] }));
    if (url.startsWith('/api/me/notifications')) return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

export async function openUsers(path = '/admin/users') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
  await screen.findByText('Phạm Minh Đức');
}



export const DEL: AdminUser = { ...CHI, sub: 'u-del', fullName: 'Hà Đã Xoá', employeeCode: 'NV0999', status: 'deleted' };
export const OK_AT = '2026-11-09T07:05:00.000Z'; // 14:05 giờ VN
export const ERR_AT = '2026-11-09T08:05:00.000Z'; // 15:05 giờ VN

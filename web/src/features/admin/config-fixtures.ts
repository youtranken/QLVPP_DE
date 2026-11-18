import { vi } from 'vitest';
import { jsonResponse, screen } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { Me } from '@/lib/me';

export const CONFIG = {
  registration_last_day: 10,
  default_max_qty: 20,
  reminder_days_left: 3,
  signature_boxes: [
    { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: '' },
    { title: 'Người yêu cầu', title_en: 'Applicant', name: 'Lê Thị Bình' },
  ],
};

export const PERIOD = { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 9, previous: null, owed: [] };

const user = (sub: string, fullName: string, role: 'admin' | 'member', team: string | null) => ({
  sub,
  fullName,
  email: `${sub}@pmh.com.vn`,
  department: 'Phòng Công trình',
  status: 'active',
  employeeCode: null,
  team,
  role,
  lastLoginAt: null,
});

export const USERS = [
  user('u-admin', 'Nguyễn Văn An', 'admin', 'Admin'),
  user('u-ha', 'Phạm Thu Hà', 'member', 'QS'),
  user('u-minh', 'Lê Minh', 'member', null),
];

export const RECENT = [
  { id: '9', actor: 'u-admin', actorName: 'Nguyễn Văn An', action: 'config.updated', objectType: 'config', objectId: 'admin_contact', detail: {}, createdAt: '2026-10-31T02:05:00.000Z' },
  {
    id: '8',
    actor: 'u-admin',
    actorName: 'Nguyễn Văn An',
    action: 'config.updated',
    objectType: 'config',
    objectId: 'registration_last_day,reminder_days_left',
    detail: { before: { registration_last_day: 10, reminder_days_left: 3 }, after: { registration_last_day: 12, reminder_days_left: 3 } },
    createdAt: '2026-10-30T02:05:00.000Z',
  },
];

type Body = Record<string, unknown>;
type Route = (url: string, init?: RequestInit) => Response | undefined;

export function stubConfigApi(put: (body: Body) => Response = () => jsonResponse(200, CONFIG), override?: Route) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const custom = override?.(url, init);
    if (custom) return Promise.resolve(custom);
    if (url === '/api/admin/config' && init?.method === 'PUT') return Promise.resolve(put(JSON.parse(init.body as string) as Body));
    if (url === '/api/admin/config') return Promise.resolve(jsonResponse(200, CONFIG));
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/admin/users?')) return Promise.resolve(jsonResponse(200, { items: USERS, next_cursor: null }));
    if (url === '/api/admin/stock/low') return Promise.resolve(jsonResponse(200, [{ id: 'i1' }, { id: 'i2' }]));
    if (url.startsWith('/api/admin/audit?')) return Promise.resolve(jsonResponse(200, { items: RECENT, next_cursor: null }));
    return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const putBodies = (m: ReturnType<typeof stubConfigApi>) =>
  m.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    .map(([, init]) => JSON.parse((init as RequestInit).body as string) as Body);

export const putHeaders = (m: ReturnType<typeof stubConfigApi>) =>
  m.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT')
    .map(([, init]) => (init as RequestInit).headers as Record<string, string>);

export const configInvalid = (field: string) => jsonResponse(400, { code: 'CONFIG_INVALID', message: `Giá trị cấu hình không hợp lệ: ${field}.`, field });

export async function openConfig(me: Me = makeMe('admin'), width = 1280) {
  mockViewport(width);
  const view = renderApp(me, '/admin/config');
  await screen.findAllByRole('form');
  return view;
}

export const block = (name: string) => screen.getByRole('form', { name });

import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import { PERIOD } from '@/test/request-api-stub';
import { adminRequest } from '@/features/summary/adjust-fixtures';
import { REGISTRATIONS, registrationRoute, registrationView } from '@/features/summary/registration-fixtures';
import { person } from '@/features/summary/summary-fixtures';
import type { PeriodSummary, PersonRow } from '@/features/summary/summary.api';

export const LOCKED: PeriodSummary = {
  ym: '2026-10',
  deadline: '2026-10-10T17:00:00.000Z',
  is_open: false,
  registered: 4,
  headcount: 5,
  headcount_source: 'snapshot',
  unregistered: 1,
  outside: 0,
  lines_pending_delivery: 12,
  custom_pending: 0,
  low_stock: 0,
  receipts: 0,
};
export const OPEN: PeriodSummary = { ...LOCKED, ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, registered: 3, headcount: 5 };

const A = person({ request_id: 'r-a', user_sub: 'u-a', full_name: 'Nhân viên A', department: 'Phòng Test', team: 'Team Test', line_count: 8, total_qty: 36, over_max: true, saved_at: '2026-10-07T04:06:00.000Z' });
const B = person({ request_id: 'r-b', user_sub: 'u-b', full_name: 'Nhân viên B', department: 'Phòng Test', team: 'Team Test', line_count: 6, total_qty: 6, delivered_qty: 2, cancelled_qty: 0, adjusted: true });
const C = person({ request_id: 'r-c', user_sub: 'u-c', full_name: 'Nhân viên C', department: 'Phòng Test', team: 'Team Test', line_count: 6, total_qty: 24, over_max: true });
const D = person({ request_id: 'r-d', user_sub: 'u-d', full_name: 'Nguyễn Văn An', department: null, team: 'Kỹ thuật', line_count: 1, total_qty: 0, custom_pending: 1 });
// A đã giao đủ để chip "Chưa giao xong" có ca loại trừ
const E = person({ request_id: 'r-e', user_sub: 'u-e', full_name: 'Nhân viên E', department: 'Phòng Test', team: null, line_count: 2, total_qty: 4, delivered_qty: 4 });
export const PEOPLE: PersonRow[] = [A, B, C, E, D];

const plan = {
  snapshot: { id: 's1', kind: 'print', created_at: '2026-10-11T04:50:00Z' },
  no_order: null,
  batches: [],
  rows: [...Array(19).fill(0).map((_, i) => ({ item_id: `i${i}`, remaining: 0, adm_out: false })), { item_id: 'x1', remaining: 3, adm_out: false }, { item_id: 'x2', remaining: 1, adm_out: false }],
  custom: [],
  makeup: [],
};
export const SENT_STATE = {
  state: 'sent',
  no_order_at: null,
  no_order_by_name: null,
  sent: { id: 's-1', kind: 'print', created_at: '2026-11-08T04:50:00.000Z', items_count: 21, units_total: 143, replaces: null, data: {} },
  changed_after: false,
  changed_at: null,
  settled_since: {},
};

type Route = (url: string) => Response | undefined;

export function stubMonthApi(override?: Route, people: PersonRow[] = PEOPLE) {
  const f = vi.fn((url: string) => {
    const custom = override?.(url);
    if (custom) return Promise.resolve(custom);
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/admin/requests/')) return Promise.resolve(jsonResponse(200, adminRequest({ id: url.split('/').pop()!, full_name: 'Nhân viên A' })));
    const one = /^\/api\/admin\/periods\/\d{4}-\d{2}\/registrations\/([\w-]+)$/.exec(url);
    if (one) return Promise.resolve(jsonResponse(200, { ...registrationView('q-a'), id: one[1] }));
    const reg = registrationRoute(REGISTRATIONS)(url);
    if (reg) return Promise.resolve(reg);
    if (url === '/api/admin/items' || url.startsWith('/api/item-categories')) return Promise.resolve(jsonResponse(200, []));
    const m = /^\/api\/admin\/periods\/(\d{4}-\d{2})\/([\w-]+)/.exec(url);
    if (m?.[2] === 'summary') return Promise.resolve(jsonResponse(200, m[1] === '2026-11' ? OPEN : { ...LOCKED, ym: m[1] }));
    if (m?.[2] === 'send-state') return Promise.resolve(jsonResponse(200, SENT_STATE));
    if (m?.[2] === 'arrivals-plan') return Promise.resolve(jsonResponse(200, plan));
    if (m?.[2] === 'requests') {
      const q = new URL(url, 'http://x').searchParams.get('q')?.toLowerCase();
      const items = q ? people.filter((p) => `${p.full_name} ${p.department ?? ''}`.toLowerCase().includes(q)) : people;
      return Promise.resolve(jsonResponse(200, { items, next_cursor: null }));
    }
    if (url.startsWith('/api/admin/backlog')) return Promise.resolve(jsonResponse(200, { groups: [], totals: {} }));
    return Promise.resolve(jsonResponse(200, { items: [] }));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

export const calledUrls = (f: ReturnType<typeof stubMonthApi>) => f.mock.calls.map((c) => String(c[0]));

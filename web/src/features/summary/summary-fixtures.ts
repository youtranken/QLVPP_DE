import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import { PERIOD } from '@/test/request-api-stub';
import type { Category } from '@/features/catalog/catalog.api';
import { adminItem, adminRequest } from './adjust-fixtures';
import type { ItemSummaryRow, PeriodSummary, PersonRow, UnregisteredUser } from './summary.api';

export const OPEN: PeriodSummary = {
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  registered: 32,
  headcount: 40,
  headcount_source: 'live',
  unregistered: 8,
  outside: 0,
  lines_pending_delivery: null,
  custom_pending: null,
  low_stock: 4,
  receipts: 0,
};
export const LOCKED: PeriodSummary = {
  ...OPEN,
  ym: '2026-10',
  deadline: '2026-10-10T17:00:00.000Z',
  is_open: false,
  headcount_source: 'snapshot',
  registered: 30,
  headcount: 38,
  lines_pending_delivery: 12,
  custom_pending: 3,
};

export const person = (over: Partial<PersonRow>): PersonRow => ({
  request_id: 'r-x',
  user_sub: 'u-x',
  full_name: 'Người',
  email: 'x@pmh.com.vn',
  department: 'Phòng Công trình',
  user_status: 'active',
  line_count: 3,
  total_qty: 7,
  delivered_qty: 0,
  cancelled_qty: 0,
  custom_pending: 0,
  over_max: false,
  updated_at: '2026-11-05T07:20:00.000Z',
  ...over,
});

export const PEOPLE = [
  person({ request_id: 'r-3', full_name: 'Trần Bình', department: null, line_count: 1, total_qty: 2 }),
  person({ request_id: 'r-1', full_name: 'Phạm Văn Đức', delivered_qty: 4, custom_pending: 1 }),
  person({ request_id: 'r-2', full_name: 'Võ Thị Lan', user_status: 'locked', line_count: 2, total_qty: 4, over_max: true }),
];

export const CATEGORIES: Category[] = [
  { id: 'c-paper', name: 'Giấy', name_en: 'Paper', sort_order: 2, active: true },
  { id: 'c-pen', name: 'Bút & viết', name_en: 'Pens', sort_order: 1, active: true },
];

export const SUMMARY_ITEMS = [
  adminItem({ id: 'i-a4', name: 'Giấy A4', unit: 'ram', category_id: 'c-paper', stock_qty: 3, stock_state: 'low', admin_only: true }),
  adminItem({ id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', category_id: 'c-pen', stock_qty: 0, stock_state: 'out' }),
  adminItem({ id: 'i-note', name: 'Giấy note', unit: 'loc', category_id: 'c-paper', stock_qty: 50, stock_state: 'ok' }),
];

export const ITEM_ROWS: ItemSummaryRow[] = [
  { key: 'c:tape', item_id: null, name: 'Băng keo 2 mặt', unit: 'cuon', requested_qty: 2, people: 1, max_qty: null, over_max: false },
  { key: 'i-a4', item_id: 'i-a4', name: 'Giấy A4', unit: 'ram', requested_qty: 25, people: 9, max_qty: 20, over_max: false },
  { key: 'i-pen', item_id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', requested_qty: 40, people: 12, max_qty: 4, over_max: true },
  { key: 'i-note', item_id: 'i-note', name: 'Giấy note', unit: 'loc', requested_qty: 6, people: 3, max_qty: 20, over_max: false },
];

export const UNREGISTERED: UnregisteredUser[] = [
  { sub: 'u-ha', full_name: 'Phạm Thu Hà', email: 'ha@pmh.com.vn', department: 'Phòng Công trình' },
  { sub: 'u-minh', full_name: 'Lê Minh', email: 'minh@pmh.com.vn', department: null },
];

type Route = (url: string) => Response | Promise<Response> | undefined;

export function stubSummaryApi(override?: Route) {
  const fetchMock = vi.fn((url: string) => {
    const custom = override?.(url);
    if (custom) return Promise.resolve(custom);
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url === '/api/admin/requests/r-2') return Promise.resolve(jsonResponse(200, adminRequest({ id: 'r-2', full_name: 'Võ Thị Lan' })));
    if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, SUMMARY_ITEMS));
    if (url === '/api/item-categories?all=1') return Promise.resolve(jsonResponse(200, CATEGORIES));
    if (url === '/api/admin/stock/low') return Promise.resolve(jsonResponse(200, [SUMMARY_ITEMS[0]]));
    const m = /^\/api\/admin\/periods\/(\d{4}-\d{2})\/(\w+)/.exec(url);
    if (m?.[2] === 'summary') return Promise.resolve(jsonResponse(200, m[1] === '2026-11' ? OPEN : { ...LOCKED, ym: m[1] }));
    if (m?.[2] === 'unregistered') return Promise.resolve(jsonResponse(200, { items: UNREGISTERED }));
    if (m?.[2] === 'requests') {
      const body = url.includes('by=item') ? { items: ITEM_ROWS } : { items: PEOPLE, next_cursor: null };
      return Promise.resolve(jsonResponse(200, body));
    }
    return Promise.resolve(jsonResponse(200, { items: [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const calledUrls = (f: ReturnType<typeof stubSummaryApi>) => f.mock.calls.map((c) => String(c[0]));

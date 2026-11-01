import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';

export function item(over: Partial<AdminItem>): AdminItem {
  return {
    id: 'i-x',
    code: null,
    name: 'Món',
    name_en: null,
    unit: 'cai',
    pack_note: null,
    category_id: 'c-1',
    image_file_id: 'f-1',
    admin_only: false,
    max_qty: 20,
    stock_qty: 10,
    restock_level: 30,
    stock_state: 'ok',
    active: true,
    usable: over.active ?? true,
    sort_order: 0,
    missing_image: false,
    ...over,
  };
}

export const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Giấy', name_en: null, sort_order: 0, active: true },
  { id: 'c-2', name: 'Bút', name_en: null, sort_order: 1, active: true },
];

export const LOW = item({ id: 'i-1', name: 'Giấy A4', unit: 'ram', stock_qty: 6, stock_state: 'low' });
export const OUT = item({ id: 'i-4', name: 'Kẹp giấy', category_id: 'c-2', stock_qty: 0, stock_state: 'out' });
export const NEVER = item({ id: 'i-5', name: 'Ghim bấm', category_id: 'c-2', stock_qty: 0, restock_level: null, stock_state: 'untracked' });
export const OK = item({ id: 'i-2', name: 'Bút bi xanh', category_id: 'c-2' });
export const ITEMS = [LOW, OK, item({ id: 'i-3', name: 'Bút xóa cũ', active: false }), OUT, NEVER];

export const BACKLOG = {
  groups: [
    { key: 'i-1', label: { item_id: 'i-1', name: 'Giấy A4', unit: 'ram' }, remaining_qty: 4, lines: [] },
    { key: 'i-2', label: { item_id: 'i-2', name: 'Bút bi xanh', unit: 'cai' }, remaining_qty: 3, lines: [] },
    { key: 'custom:x', label: { item_id: null, name: 'Băng keo' }, remaining_qty: 9, lines: [] },
  ],
};

export const move = (id: string, over: Record<string, unknown>) => ({
  id,
  delta: 1,
  reason: 'purchase',
  note: null,
  actor_sub: 'u-hc',
  recipient_sub: null,
  created_at: '2026-10-28T03:15:00.000Z',
  ...over,
});

export const USERS = {
  items: [
    { sub: 'u-hc', fullName: 'Phạm Hành Chính', email: null, department: null, status: 'active' },
    { sub: 'u-binh', fullName: 'Trần Thị Bình', email: 'binh@pmh.com.vn', department: 'Giám sát', status: 'active' },
    { sub: 'u-cuong', fullName: 'Lê Văn Cường', email: 'cuong@pmh.com.vn', department: null, status: 'locked' },
  ],
  next_cursor: null,
};

type Handler = (url: string, init?: RequestInit) => Response | undefined;

export function stubStockApi(extra?: Handler) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const hit = extra?.(url, init);
    if (hit) return Promise.resolve(hit);
    const path = url.split('?')[0];
    if (path === '/api/admin/items') return Promise.resolve(jsonResponse(200, ITEMS));
    if (path === '/api/item-categories') return Promise.resolve(jsonResponse(200, CATEGORIES));
    if (path === '/api/admin/backlog') return Promise.resolve(jsonResponse(200, BACKLOG));
    if (path === '/api/admin/users') return Promise.resolve(jsonResponse(200, USERS));
    if (path.startsWith('/api/me/notifications')) return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
    return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const callsTo = (f: ReturnType<typeof stubStockApi>, url: string) => f.mock.calls.filter((c) => c[0] === url);

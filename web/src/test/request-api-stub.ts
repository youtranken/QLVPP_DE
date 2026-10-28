import { vi } from 'vitest';
import type { Category } from '@/features/catalog/catalog.api';
import type { CurrentPeriod, MemberItem, RequestView } from '@/features/request/request.api';
import { jsonResponse } from '@/test/test-utils';
import { memberItem } from '@/test/fixtures-request';

export const PERIOD: CurrentPeriod = {
  ym: '2026-11',
  deadline: '2026-11-10T17:00:00.000Z',
  is_open: true,
  days_left: 4,
  previous: null,
};
export const PEN = memberItem({ id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', max_qty: 20, category_id: 'c-1' });
export const NOTE = memberItem({ id: 'i-note', name: 'Giấy note vàng', unit: 'loc', max_qty: 10, category_id: 'c-2' });
export const CLIP = memberItem({ id: 'i-clip', name: 'Kẹp giấy', unit: 'hop', max_qty: 10 });
export const A4 = memberItem({ id: 'i-a4', name: 'Giấy A4', unit: 'ram', max_qty: 5, admin_only: true });
export const CATEGORIES: Category[] = [
  { id: 'c-1', name: 'Bút & viết', name_en: null, sort_order: 0, active: true },
  { id: 'c-2', name: 'Giấy & sổ', name_en: null, sort_order: 1, active: true },
];
export const facts = (i: MemberItem) => ({ ...i });

export function view(over: Partial<RequestView> = {}): RequestView {
  return {
    id: 'r-1',
    period_ym: '2026-11',
    user_sub: 'u-member',
    full_name: 'Nguyễn Văn An',
    department: 'Phòng Công trình',
    updated_at: '2026-11-03T07:20:00.000Z',
    is_open: true,
    lines: [],
    ...over,
  };
}

type Handler = (init?: RequestInit) => Response;

export interface StubOptions {
  request?: RequestView | null;
  // Phiếu các kỳ khác (vd kỳ trước đang giao) theo ym
  others?: Record<string, RequestView>;
  period?: CurrentPeriod;
  put?: Handler;
  copy?: Handler;
  upload?: Handler;
}

// fetch giả cho trang Đăng ký: mỗi URL một câu trả lời, còn lại 500
export function stubRequestApi(opts: StubOptions = {}) {
  let current = opts.request ?? null;
  let period = opts.period ?? PERIOD;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const res = (r: Response) => Promise.resolve(r);
    if (url === '/api/periods/current') return res(jsonResponse(200, period));
    if (url.startsWith('/api/me/request?ym=')) {
      const ym = url.slice('/api/me/request?ym='.length);
      const found = current?.period_ym === ym ? current : opts.others?.[ym];
      return res(found ? jsonResponse(200, found) : jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
    }
    if (url.startsWith('/api/items')) return res(jsonResponse(200, [PEN, NOTE, CLIP, A4]));
    if (url === '/api/item-categories') return res(jsonResponse(200, CATEGORIES));
    if (url === '/api/me/request/lines' && method === 'PUT' && opts.put) return res(opts.put(init));
    if (url === '/api/me/request/copy-previous' && method === 'POST') {
      return res(opts.copy ? opts.copy(init) : jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
    }
    if (url === '/api/files' && method === 'POST' && opts.upload) return res(opts.upload(init));
    return res(jsonResponse(500, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    fetchMock,
    setServer: (v: RequestView | null) => {
      current = v;
    },
    setPeriod: (p: CurrentPeriod) => {
      period = p;
    },
    putBody: (nth = 0) => {
      const calls = fetchMock.mock.calls.filter(([u, i]) => u === '/api/me/request/lines' && i?.method === 'PUT');
      return JSON.parse(String(calls[nth]?.[1]?.body));
    },
  };
}

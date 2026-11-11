import { vi } from 'vitest';
import type { HistoryItem, MyIssue } from '@/features/request/history.api';
import { PERIOD, view } from '@/test/request-api-stub';
import { jsonResponse } from '@/test/test-utils';

// catalog mặc định suy từ các số tổng (coi như không có món ngoài DM hiệu lực); test cần tách thì truyền catalog riêng
export const historyItem = (over: Partial<HistoryItem>): HistoryItem => {
  const base = {
    period_ym: '2026-10',
    line_count: 3,
    total_qty: 10,
    delivered_qty: 0,
    remaining_qty: 10,
    cancelled_qty: 0,
    owed_line_count: 0,
    custom: { pending: 0, accepted: 0, converted: 0, rejected: 0 },
    ...over,
  };
  const customLines = base.custom.pending + base.custom.accepted + base.custom.converted + base.custom.rejected;
  return {
    catalog: {
      line_count: Math.max(0, base.line_count - customLines),
      qty: base.total_qty,
      delivered_qty: base.delivered_qty,
      remaining_qty: base.remaining_qty,
      owed_line_count: base.owed_line_count,
    },
    ...base,
  };
};

export const issue = (over: Partial<MyIssue>): MyIssue => ({
  id: 'm-1',
  item_id: 'i-1',
  item_name: 'Bút bi',
  item_name_en: 'Ballpoint pen',
  unit: 'cai',
  qty: 2,
  note: 'Người mới vào',
  created_at: '2026-10-20T03:30:00Z',
  ...over,
});

export function stubHistory(
  pages: { items: HistoryItem[]; next_cursor: string | null }[],
  issuePages: { items: MyIssue[]; next_cursor: string | null }[] = [],
  requests: Record<string, ReturnType<typeof view>> = {},
  period: typeof PERIOD = PERIOD,
) {
  let at = 0;
  let issueAt = 0;
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, period));
    if (url.startsWith('/api/me/request?ym=')) {
      const found = requests[url.slice('/api/me/request?ym='.length)];
      return Promise.resolve(found ? jsonResponse(200, found) : jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
    }
    if (url.startsWith('/api/me/issues')) return Promise.resolve(jsonResponse(200, issuePages[issueAt++] ?? { items: [], next_cursor: null }));
    if (url.startsWith('/api/me/requests')) return Promise.resolve(jsonResponse(200, pages[Math.min(at++, pages.length - 1)] ?? { items: [], next_cursor: null }));
    return Promise.resolve(jsonResponse(500, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

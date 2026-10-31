import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import { PERIOD } from '@/test/request-api-stub';
import type { AdminItem } from '@/features/catalog/catalog.api';
import type { MonthReport } from '@/features/reports/reports.api';
import type { AdminRequestView, PeriodSummary, PersonRow } from '@/features/summary/summary.api';
import { LOCKED_SUMMARY, deliveryItems, deliveryRequest, personRow } from './delivery-fixtures';

type Reply = Response | Promise<Response>;

export interface DeliveryStub {
  rows?: PersonRow[] | (() => PersonRow[]);
  allRows?: PersonRow[];
  views?: AdminRequestView[];
  others?: Record<string, AdminRequestView>;
  items?: AdminItem[] | (() => AdminItem[]);
  summary?: PeriodSummary;
  report?: Partial<MonthReport>;
  deliver?: (url: string, body: { qty: number; expected_delivered_qty: number }) => Reply;
  deliverAll?: () => Reply;
}

const REPORT: MonthReport = { ym: '2026-10', byItem: [], custom: [], byDepartment: [], issues: [], pending_custom_count: 0 };
const valueOf = <T>(v: T | (() => T)) => (typeof v === 'function' ? (v as () => T)() : v);

export function stubDelivery(s: DeliveryStub = {}) {
  const views = s.views ?? [deliveryRequest()];
  let loads = 0;
  const fetchMock = vi.fn((url: string, init?: RequestInit): Promise<Response> => {
    const res = (r: Reply) => Promise.resolve(r);
    if (url === '/api/periods/current') return res(jsonResponse(200, PERIOD));
    if (url === '/api/admin/periods/2026-10/summary') return res(jsonResponse(200, s.summary ?? LOCKED_SUMMARY));
    if (url.startsWith('/api/admin/periods/2026-10/requests?by=person&filter=all'))
      return res(jsonResponse(200, { items: s.allRows ?? valueOf(s.rows ?? [personRow()]), next_cursor: null }));
    if (url.startsWith('/api/admin/periods/2026-10/requests?by=person&filter=pending_delivery'))
      return res(jsonResponse(200, { items: valueOf(s.rows ?? [personRow()]), next_cursor: null }));
    if (url === '/api/admin/requests/r-1') return res(jsonResponse(200, views[Math.min(loads++, views.length - 1)]));
    const other = s.others?.[url.slice('/api/admin/requests/'.length)];
    if (other) return res(jsonResponse(200, other));
    if (url === '/api/admin/items') return res(jsonResponse(200, valueOf(s.items ?? deliveryItems())));
    if (url === '/api/item-categories?all=1') return res(jsonResponse(200, []));
    if (url === '/api/admin/reports/2026-10') return res(jsonResponse(200, { ...REPORT, ...s.report }));
    if (url === '/api/admin/requests/r-1/deliver-all' && s.deliverAll) return res(s.deliverAll());
    if (url.endsWith('/deliver') && s.deliver) return res(s.deliver(url, JSON.parse(String(init?.body))));
    return res(jsonResponse(200, { items: [] }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export type DeliveryFetch = ReturnType<typeof stubDelivery>;
export const urlsOf = (f: DeliveryFetch) => f.mock.calls.map((c) => String(c[0]));
export const countOf = (f: DeliveryFetch, url: string) => urlsOf(f).filter((u) => u === url).length;

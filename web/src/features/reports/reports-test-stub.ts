import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import type { MonthReport, SnapshotRow } from './reports.api';
import { NEW_SNAPSHOT_BY, reportFixture, snapshotRow } from './reports-fixtures';

export const OPEN_YM = '2026-11';

interface Options {
  reports?: Record<string, MonthReport>;
  snapshots?: SnapshotRow[];
  post?: (body: { kind: string; order_qty: Record<string, number> }) => Response | Promise<Response>;
}

// Server giả giữ danh sách bản chốt: POST thành công thì lần tải lại danh sách có thêm bản mới
export function stubReports(opts: Options = {}) {
  const snapshots = [...(opts.snapshots ?? [])];
  let seq = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === '/api/periods/current') return jsonResponse(200, { ym: OPEN_YM, deadline: '2026-11-10T17:00:00Z', is_open: true, days_left: 5, previous: null });
    const m = /^\/api\/admin\/reports\/(\d{4}-\d{2})(\/snapshots)?$/.exec(url);
    if (m && !m[2]) return jsonResponse(200, opts.reports?.[m[1]] ?? reportFixture({ ym: m[1] }));
    if (m && method === 'GET') return jsonResponse(200, { items: snapshots });
    if (m && method === 'POST') {
      const body = JSON.parse(String(init?.body));
      const res = opts.post ? await opts.post(body) : jsonResponse(201, { id: `snap-${++seq}` });
      if (res.ok) {
        const { id } = (await res.json()) as { id: string };
        snapshots.unshift(snapshotRow({ id, kind: body.kind, created_at: '2026-10-29T03:00:00Z', created_by_name: NEW_SNAPSHOT_BY }));
        return jsonResponse(201, { id });
      }
      return res;
    }
    return jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const postsOf = (f: ReturnType<typeof stubReports>) =>
  f.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method === 'POST')
    .map((c) => ({ url: String(c[0]), body: JSON.parse(String((c[1] as RequestInit).body)) }));

// jsdom không tải tệp: ghi lại href của thẻ <a> được bấm thay cho trình duyệt
export function captureDownloads() {
  const hrefs: string[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    hrefs.push(this.getAttribute('href') ?? '');
  });
  return hrefs;
}

import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import { SHELL_PERIOD } from '@/test/admin-shell-stub';
import type { BacklogLine } from './backlog.api';
import { itemGroup, personGroup } from './backlog-fixtures';

interface Handlers {
  deliver?: (line: BacklogLine, qty: number) => Response | Promise<Response>;
  cancel?: (line: BacklogLine) => Response | Promise<Response>;
  // Đổi ở nơi khác (hủy nợ/sửa qty) xảy ra trước khi request bị từ chối
  elsewhere?: (line: BacklogLine) => BacklogLine;
}

// Server giả giữ trạng thái: giao/hủy đổi phần còn lại, lần tải lại bỏ dòng hết nợ như GET admin/backlog
export function stubBacklog(initial: BacklogLine[], handlers: Handlers = {}) {
  let lines = initial.map((l) => ({ ...l }));
  const update = (id: string, change: (l: BacklogLine) => BacklogLine) => {
    lines = lines.map((l) => (l.line_id === id ? change(l) : l)).filter((l) => l.remaining_qty > 0);
  };
  const groups = (by: string | null) => {
    const keyOf = (l: BacklogLine) => (by === 'person' ? l.user_sub : (l.item_id ?? l.name));
    const keys = [...new Set(lines.map(keyOf))];
    return keys.map((k) => {
      const ls = lines.filter((l) => keyOf(l) === k);
      return by === 'person' ? personGroup(ls) : itemGroup(ls);
    });
  };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url, 'http://x');
    const lineId = u.pathname.split('/')[4];
    const line = lines.find((l) => l.line_id === lineId);
    if (u.pathname === '/api/periods/current') return jsonResponse(200, SHELL_PERIOD);
    if (u.pathname === '/api/admin/backlog') return jsonResponse(200, { groups: groups(u.searchParams.get('by')) });
    if (u.pathname.endsWith('/deliver') && line) {
      const qty = JSON.parse(String(init?.body)).qty as number;
      const res = handlers.deliver ? await handlers.deliver(line, qty) : jsonResponse(200, {});
      if (res.ok) update(line.line_id, (l) => ({ ...l, delivered_qty: l.delivered_qty + qty, remaining_qty: l.remaining_qty - qty }));
      else if (handlers.elsewhere) update(line.line_id, handlers.elsewhere);
      return res;
    }
    if (u.pathname.endsWith('/cancel-remaining') && line) {
      const res = handlers.cancel ? await handlers.cancel(line) : jsonResponse(200, { cancelled_now: line.remaining_qty });
      if (res.ok) update(line.line_id, (l) => ({ ...l, cancelled_qty: l.cancelled_qty + l.remaining_qty, remaining_qty: 0 }));
      return res;
    }
    if (u.pathname.endsWith('/deliveries')) return jsonResponse(200, { line: { id: lineId, qty: 5, delivered_qty: 2, cancelled_qty: 0, cancel_note: null }, items: [] });
    if (u.pathname === '/api/admin/items' || u.pathname === '/api/item-categories') return jsonResponse(200, []);
    return jsonResponse(200, { items: [] });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const callsTo = (f: ReturnType<typeof stubBacklog>, path: string) =>
  f.mock.calls.filter((c) => String(c[0]) === path) as unknown as [string, RequestInit | undefined][];

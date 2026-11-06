import { vi } from 'vitest';
import { jsonResponse } from '@/test/test-utils';
import { adminItem } from '@/features/summary/adjust-fixtures';
import type { MonthReport, SnapshotData } from '@/features/reports/reports.api';
import { reportFixture } from '@/features/reports/reports-fixtures';
import { stubReports } from '@/features/reports/reports-test-stub';
import type { SendStateDto } from './send-adm.api';
import type { OrderRow } from './send-adm-rows';

// Hàng Gửi ADM tối thiểu cho test: số gộp, cần và gợi ý tự tính như toOrderRows
export function orderRow(o: Partial<OrderRow> = {}): OrderRow {
  const requested = o.requested ?? 0;
  const backlog = o.backlog ?? 0;
  const left = o.left ?? 0;
  const admOwed = o.admOwed ?? 0;
  const usable = o.usable ?? true;
  const need = requested + backlog - left;
  return {
    key: 'k1', code: null, name: 'Bút bi', name_en: null, unit: 'cay', image_file_id: null, custom: false,
    registered: requested, delivered: 0, requested, backlog, want: requested + backlog, need,
    suggested: usable ? Math.max(0, need - admOwed) : 0, admOwed, admMonths: [], left, usable, stock: 0,
    ...o,
  };
}

export const YM = '2026-10';
const PAST = '2026-10-10T17:00:00.000Z';
export const SENT_AT = '2026-12-12T02:02:00.000Z';
const BOXES = [{ title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Ngô Văn Bảo' }];

type ItemRow = MonthReport['byItem'][number];
export const itemRow = (o: Partial<ItemRow> & { key: string }): ItemRow => ({ item_id: o.key, code: null, name: o.key, name_en: null, unit: 'cay', requested: 0, backlog_prev: 0, stock: 0, need: 0, adm_owed: 0, left_excluded: 0, usable: true, ...o });

export const sendReport = (byItem: ItemRow[], over: Partial<MonthReport> = {}) => reportFixture({ ym: YM, byItem, custom: [], ...over });

export function sentData(report: MonthReport, order_qty: Record<string, number>, over: Partial<SnapshotData> = {}): SnapshotData {
  return { ...report, id: 'snap-old', kind: 'print', period_ym: YM, order_qty, created_by: { sub: 'u', name: 'An' }, created_at: SENT_AT, ...over };
}

export const UNSENT: SendStateDto = { state: 'unsent', no_order_at: null, no_order_by_name: null, sent: null, changed_after: false, changed_at: null, delivered_since: {} };

export function sentState(data: SnapshotData, over: Partial<SendStateDto> = {}): SendStateDto {
  const qty = Object.values(data.order_qty).filter((n) => n > 0);
  const sent = { id: data.id, kind: data.kind, created_at: data.created_at, items_count: qty.length, units_total: qty.reduce((a, b) => a + b, 0), replaces: data.replaces ?? null, data };
  return { ...UNSENT, state: 'sent', sent, ...over };
}

interface Setup {
  report: MonthReport;
  state?: SendStateDto;
  afterPost?: SendStateDto;
  makeup?: { ym: string; rows: { key: string; adm_owed: number }[] }[];
  summary?: object;
}

// Server giả cho Gửi ADM: báo cáo + trạng thái gửi (đổi sau POST bản chốt / no-order)
export function setupSendAdm({ report, state = UNSENT, afterPost, makeup = [], summary }: Setup) {
  let current = state;
  const items = report.byItem.map((r) => adminItem({ id: r.item_id, name: r.name }));
  const base = stubReports({ reports: { [YM]: report }, items });
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    if (url === `/api/admin/periods/${YM}/summary`) return jsonResponse(200, { ym: YM, deadline: PAST, unregistered: 0, custom_pending: 0, lines_pending_delivery: 0, ...summary });
    if (url === '/api/admin/config') return jsonResponse(200, { signature_boxes: BOXES });
    if (url === `/api/admin/periods/${YM}/send-state`) return jsonResponse(200, current);
    if (url === `/api/admin/periods/${YM}/arrivals-plan`) return jsonResponse(200, { makeup });
    if (url === `/api/admin/periods/${YM}/no-order` && method === 'POST') {
      current = { ...UNSENT, state: 'no_order', no_order_at: SENT_AT, no_order_by_name: 'An' };
      return jsonResponse(200, { no_order_at: SENT_AT, no_order_by: 'u' });
    }
    if (url === `/api/admin/periods/${YM}/no-order` && method === 'DELETE') {
      current = UNSENT;
      return jsonResponse(204, null);
    }
    const res = await base(url, init);
    if (method === 'POST' && res.ok && afterPost) current = afterPost;
    return res;
  });
  vi.stubGlobal('fetch', f);
  return f;
}

export const callsTo = (f: ReturnType<typeof setupSendAdm>, method: string, path: string) =>
  f.mock.calls.filter((c) => ((c[1] as RequestInit | undefined)?.method ?? 'GET') === method && String(c[0]).includes(path)).map((c) => ({ url: String(c[0]), body: c[1]?.body ? JSON.parse(String(c[1].body)) : null }));
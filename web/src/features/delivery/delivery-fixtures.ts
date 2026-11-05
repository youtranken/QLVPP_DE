import { lineView } from '@/test/fixtures-request';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { adminItem } from '@/features/summary/adjust-fixtures';
import type { AdminRequestView, PeriodSummary, PersonRow } from '@/features/summary/summary.api';

const item = (name: string, unit: string) => ({
  name,
  name_en: null,
  unit,
  pack_note: null,
  image_file_id: null,
  active: true,
  admin_only: false,
});

export const PEN_LINE = lineView({ id: 'l-pen', item_id: 'i-pen', item: item('Bút bi xanh', 'cay'), qty: 5, delivered_qty: 3 });
export const NOTE_LINE = lineView({ id: 'l-note', item_id: 'i-note', item: item('Giấy note vàng', 'bich'), qty: 3 });
export const TAPE_LINE = lineView({ id: 'l-tape', custom_name: 'Băng keo 2 mặt', custom_unit: 'cai', qty: 2, review_status: 'pending' });
export const SCISSORS_LINE = lineView({ id: 'l-cut', custom_name: 'Kéo cắt giấy', custom_unit: 'cai', qty: 1, review_status: 'rejected' });

export function deliveryRequest(over: Partial<AdminRequestView> = {}): AdminRequestView {
  return {
    id: 'r-1',
    period_ym: '2026-10',
    user_sub: 'u-duc',
    full_name: 'Phạm Văn Đức',
    department: 'Tổ Giám sát',
    updated_at: '2026-10-05T07:20:00.000Z',
    is_open: false,
    user_status: 'active',
    lines: [PEN_LINE, NOTE_LINE, TAPE_LINE, SCISSORS_LINE],
    ...over,
  };
}

export function personRow(over: Partial<PersonRow> = {}): PersonRow {
  return {
    request_id: 'r-1',
    user_sub: 'u-duc',
    full_name: 'Phạm Văn Đức',
    email: 'duc@pmh.com.vn',
    department: 'Tổ Giám sát',
    user_status: 'active',
    line_count: 4,
    total_qty: 8,
    delivered_qty: 3,
    cancelled_qty: 0,
    custom_pending: 1,
    updated_at: '2026-10-05T07:20:00.000Z',
    ...over,
  };
}

export const deliveryItems = (stock: Record<string, number> = {}): AdminItem[] => [
  adminItem({ id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', stock_qty: stock['i-pen'] ?? 10, stock_state: 'ok' }),
  adminItem({ id: 'i-note', name: 'Giấy note vàng', unit: 'bich', stock_qty: stock['i-note'] ?? 10, stock_state: 'ok' }),
];

export const LOCKED_SUMMARY: PeriodSummary = {
  ym: '2026-10',
  deadline: '2026-10-10T17:00:00.000Z',
  is_open: false,
  registered: 18,
  headcount: 20,
  headcount_source: 'snapshot',
  unregistered: 2,
  lines_pending_delivery: 5,
  custom_pending: 1,
  low_stock: 0,
  receipts: 0,
};

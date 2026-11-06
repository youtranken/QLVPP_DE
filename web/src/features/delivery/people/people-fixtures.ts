import type { DeliveryPerson, DeliveryPersonLine } from './delivery-people.api';

export function pLine(over: Partial<DeliveryPersonLine> = {}): DeliveryPersonLine {
  return {
    line_id: 'l-1',
    request_id: 'r-1',
    period_ym: '2026-10',
    is_debt: false,
    item_id: 'i-pen',
    name: 'Bút bi xanh',
    name_en: null,
    unit: 'cay',
    image_file_id: null,
    qty: 3,
    delivered_qty: 0,
    cancelled_qty: 0,
    remaining_qty: 3,
    stock_qty: 7,
    review_status: 'n/a',
    ...over,
  };
}

export function person(over: Partial<DeliveryPerson> = {}): DeliveryPerson {
  const lines = over.lines ?? [pLine()];
  const owed = lines.filter((l) => l.is_debt && l.remaining_qty > 0).length;
  const open = lines.filter((l) => !l.is_debt && l.remaining_qty > 0).length;
  return {
    user_sub: 'u-a',
    full_name: 'Nguyễn Văn An',
    department: 'Tổ Giám sát',
    user_status: 'active',
    request_id: 'r-1',
    status: 'pending',
    owed_lines: owed,
    open_lines: open,
    has_pending: open > 0,
    has_debt: owed > 0,
    deliverable_now: false,
    ...over,
    lines,
  };
}

// Kịch bản chuẩn: A cần 3 bút, B cần 10 bút (tủ 7) và còn nợ 2 giấy kỳ 9 (có cả hai), C chỉ có nợ, D đã nhận đủ
export const A = person({ user_sub: 'u-a', full_name: 'Nguyễn Văn An', request_id: 'r-a', lines: [pLine({ line_id: 'la', request_id: 'r-a' })] });
export const B = person({
  user_sub: 'u-b',
  full_name: 'Lê Thị Bình',
  department: 'Kết cấu',
  request_id: 'r-b',
  lines: [
    pLine({ line_id: 'lb-debt', request_id: 'r-b0', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', unit: 'ream', qty: 2, remaining_qty: 2, stock_qty: 5 }),
    pLine({ line_id: 'lb', request_id: 'r-b', qty: 10, remaining_qty: 10 }),
  ],
});
export const C = person({
  user_sub: 'u-c',
  full_name: 'Trần Minh Khoa',
  department: 'Kiến trúc',
  request_id: null,
  status: 'debt',
  lines: [pLine({ line_id: 'lc', request_id: 'r-c0', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', unit: 'ream', qty: 1, remaining_qty: 1, stock_qty: 5 })],
});
export const D = person({
  user_sub: 'u-d',
  full_name: 'Đỗ Mai Linh',
  department: 'QS',
  request_id: 'r-d',
  status: 'done',
  lines: [pLine({ line_id: 'ld', request_id: 'r-d', qty: 2, delivered_qty: 2, remaining_qty: 0 })],
});
export const PEOPLE = [A, B, C, D];

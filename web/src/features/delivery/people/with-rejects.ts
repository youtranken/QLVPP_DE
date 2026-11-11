import type { DeliveryPersonLine } from './delivery-people.api';

export interface RejectEntry {
  request_id: string;
  reject_line_ids?: string[];
}

// Server không giao lại được nên không có mã lỗi: món chờ bị bỏ không ghi Không mua vì người đó vừa có món giao lỗi
export const REJECT_SKIPPED = 'REJECT_SKIPPED';

// Gắn món chờ duyệt vào mục của đúng phiếu, tại chỗ — thứ tự giao (nợ trước, kỳ cũ trước) giữ nguyên.
// Phiếu chỉ có món chờ thành mục mới đặt ngay sau mục cuối của cùng người, để chỉ gửi khi mọi món của người đó đã giao xong
export function withRejects<E extends RejectEntry>(entries: E[], pending: DeliveryPersonLine[], make: (requestId: string) => E, ownerOf: (requestId: string) => string | undefined): E[] {
  const out = entries.map((e) => ({ ...e }));
  for (const l of pending) {
    let entry = out.find((e) => e.request_id === l.request_id);
    if (!entry) {
      entry = make(l.request_id);
      const owner = ownerOf(l.request_id);
      const last = out.findLastIndex((e) => ownerOf(e.request_id) === owner);
      out.splice(last < 0 ? out.length : last + 1, 0, entry);
    }
    entry.reject_line_ids = [...(entry.reject_line_ids ?? []), l.line_id];
  }
  return out;
}

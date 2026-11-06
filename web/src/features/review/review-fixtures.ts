import type { ReviewResult, ReviewRow } from './review.api';
import type { LineView } from '@/features/request/request.api';

export function reviewRow(over: Partial<ReviewRow> = {}): ReviewRow {
  return {
    line_id: 'l-1',
    request_id: 'r-1',
    period_ym: '2026-11',
    user_sub: 'u-1',
    full_name: 'Phạm Văn Đức',
    department: 'Tổ Giám sát',
    custom_name: 'Băng keo 2 mặt',
    custom_unit: 'cai',
    custom_note: 'Loại 2 cm, dán bản vẽ',
    image_file_id: 'f-line',
    qty: 2,
    review_status: 'pending',
    review_note: null,
    previously_accepted: false,
    item_id: null,
    created_at: '2026-11-03T07:20:00.000Z',
    in_sent_snapshot: null,
    in_sent_snapshot_qty: null,
    in_sent_snapshot_at: null,
    ...over,
  };
}

export function reviewResult(status: LineView['review_status'], over: Partial<LineView> = {}, extra: Partial<ReviewResult> = {}): ReviewResult {
  return {
    line: {
      id: 'l-1',
      item_id: null,
      item: null,
      custom_name: 'Băng keo 2 mặt',
      custom_unit: 'cai',
      custom_note: null,
      image_file_id: 'f-line',
      qty: 2,
      delivered_qty: 0,
      cancelled_qty: 0,
      cancel_note: null,
      review_status: status,
      review_note: null,
      added_by_admin: false,
      readonly_for_member: false,
      max_qty: null,
      ...over,
    },
    request_updated_at: '2026-11-05T08:00:00.000Z',
    ...extra,
  };
}

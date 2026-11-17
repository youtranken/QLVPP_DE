import type { LineView, MemberItem } from '@/features/request/request.api';

export function memberItem(over: Partial<MemberItem>): MemberItem {
  return {
    id: 'i-x',
    name: 'Món',
    name_en: null,
    unit: 'cai',
    pack_note: null,
    category_id: null,
    image_file_id: null,
    max_qty: 20,
    active: true,
    usable: over.active ?? true,
    ...over,
  };
}

export function lineView(over: Partial<LineView>): LineView {
  return {
    id: 'l-x',
    item_id: null,
    item: null,
    custom_name: null,
    custom_unit: null,
    custom_note: null,
    image_file_id: null,
    qty: 1,
    delivered_qty: 0,
    cancelled_qty: 0,
    cancel_note: null,
    review_status: 'n/a',
    review_note: null,
    added_by_admin: false,
    readonly_for_member: false,
    max_qty: null,
    last_delivered_at: null,
    ...over,
  };
}

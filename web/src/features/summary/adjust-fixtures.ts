import type { AdminItem } from '@/features/catalog/catalog.api';
import { lineView } from '@/test/fixtures-request';
import type { AdminRequestView } from './summary.api';

export function adminItem(over: Partial<AdminItem>): AdminItem {
  return {
    id: 'i-x',
    code: null,
    name: 'Món',
    name_en: null,
    unit: 'cai',
    pack_note: null,
    category_id: 'c-1',
    image_file_id: null,
    admin_only: false,
    max_qty: 20,
    stock_qty: 0,
    restock_level: null,
    stock_state: 'out',
    active: true,
    usable: over.active ?? true,
    inactive_reason: over.active === false ? 'item' : null,
    sort_order: 0,
    missing_image: false,
    ...over,
  };
}

export const ADMIN_ITEMS: AdminItem[] = [
  adminItem({ id: 'i-pen', name: 'Bút bi xanh', unit: 'cay', max_qty: 20 }),
  adminItem({ id: 'i-note', name: 'Giấy note vàng', unit: 'bich', max_qty: 20 }),
  adminItem({ id: 'i-a4', name: 'Giấy A4 Double A', unit: 'ram', admin_only: true, max_qty: 20 }),
  adminItem({ id: 'i-clip', name: 'Kẹp giấy 33 mm', unit: 'hop', max_qty: 10 }),
  adminItem({ id: 'i-old', name: 'Giấy cũ', active: false }),
];

const facts = (i: AdminItem) => ({
  name: i.name,
  name_en: i.name_en,
  unit: i.unit,
  pack_note: i.pack_note,
  image_file_id: i.image_file_id,
  active: i.active,
  admin_only: i.admin_only,
});

export function adminRequest(over: Partial<AdminRequestView> = {}): AdminRequestView {
  return {
    id: 'r-1',
    period_ym: '2026-10',
    user_sub: 'u-an',
    full_name: 'Nguyễn Văn An',
    department: 'Tổ Giám sát',
    updated_at: '2026-10-05T07:20:00.000Z',
    saved_at: '2026-10-05T07:20:00.000Z',
    is_open: false,
    user_status: 'active',
    lines: [
      lineView({ id: 'l-pen', item_id: 'i-pen', item: facts(ADMIN_ITEMS[0]), qty: 10, delivered_qty: 3 }),
      lineView({ id: 'l-note', item_id: 'i-note', item: facts(ADMIN_ITEMS[1]), qty: 3 }),
      lineView({
        id: 'l-tape',
        custom_name: 'Băng keo 2 mặt',
        custom_unit: 'cai',
        custom_note: 'Loại 2 cm',
        image_file_id: 'f-tape',
        qty: 2,
        review_status: 'pending',
      }),
    ],
    ...over,
  };
}

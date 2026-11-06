import type { AdminItem, Category } from '@/features/catalog/catalog.api';

export const CATEGORIES: Category[] = [
  { id: 'c-pen', name: 'Bút & viết', name_en: 'Pens', sort_order: 20, active: true },
  { id: 'c-paper', name: 'Giấy & sổ', name_en: 'Paper', sort_order: 10, active: true },
  { id: 'c-old', name: 'Nhóm cũ', name_en: null, sort_order: 30, active: false },
];

export function adminItem(over: Partial<AdminItem> = {}): AdminItem {
  return {
    id: 'i-x',
    code: null,
    name: 'Món',
    name_en: null,
    unit: 'cai',
    pack_note: null,
    category_id: 'c-paper',
    image_file_id: 'f-1',
    admin_only: false,
    max_qty: 20,
    stock_qty: 10,
    restock_level: 10,
    stock_state: 'ok',
    active: true,
    usable: over.active ?? true,
    inactive_reason: over.active === false ? 'item' : null,
    sort_order: 0,
    missing_image: false,
    ...over,
  };
}

export const PAPER = adminItem({ id: 'i-paper', code: 'VPP-001', name: 'Giấy A4', unit: 'ram', admin_only: true, image_file_id: null, missing_image: true, stock_state: 'low', stock_qty: 2 });
export const PEN = adminItem({ id: 'i-pen', code: 'VPP-010', name: 'Bút bi xanh', unit: 'cay', pack_note: 'hộp 20 cây', category_id: 'c-pen', image_file_id: 'f-2', max_qty: 10 });
export const PENCIL = adminItem({ id: 'i-pencil', name: 'Bút chì 2B', category_id: 'c-pen', stock_state: 'out', stock_qty: 0, sort_order: 1 });
export const OLD = adminItem({ id: 'i-old', name: 'Bút xóa cũ', category_id: 'c-pen', active: false, sort_order: 2 });
export const STRAY = adminItem({ id: 'i-stray', name: 'Kẹp lạ', category_id: 'c-gone' });

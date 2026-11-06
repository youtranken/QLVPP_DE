import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

export interface Category {
  id: string;
  name: string;
  name_en: string | null;
  sort_order: number;
  active: boolean;
}

export type StockState = 'ok' | 'low' | 'out' | 'untracked';

export interface AdminItem {
  id: string;
  code: string | null;
  name: string;
  name_en: string | null;
  unit: string;
  pack_note: string | null;
  category_id: string | null;
  image_file_id: string | null;
  admin_only: boolean;
  max_qty: number;
  stock_qty: number;
  // Tồn ngay sau lần nhập mua gần nhất; null = chưa nhập lần nào (FR-50)
  restock_level: number | null;
  stock_state: StockState;
  active: boolean;
  // active và nhóm (nếu có) đang dùng — server tính
  usable: boolean;
  // 'item' = ngừng riêng (thắng nhóm), 'group' = món còn active nhưng nhóm ngừng
  inactive_reason: 'item' | 'group' | null;
  sort_order: number;
  missing_image: boolean;
}

export type ItemPayload = Partial<
  Pick<
    AdminItem,
    | 'code'
    | 'name'
    | 'name_en'
    | 'unit'
    | 'pack_note'
    | 'category_id'
    | 'image_file_id'
    | 'admin_only'
    | 'max_qty'
    | 'active'
  >
>;

export type CategoryPayload = Partial<Pick<Category, 'name' | 'name_en' | 'sort_order' | 'active'>>;

const CATALOG_KEY = ['catalog'] as const;
const ITEMS_KEY = [...CATALOG_KEY, 'items'] as const;
const CATEGORIES_KEY = [...CATALOG_KEY, 'categories'] as const;

export const categoryLabel = (c: Pick<Category, 'name' | 'name_en'>, lang: string) => (lang === 'en' && c.name_en ? c.name_en : c.name);

export const fileUrl = (id: string) => `/api/files/${id}`;

// Admin nhận mọi món (kể cả đã ngừng) từ một endpoint; lọc "đã ngừng" làm ở trang
export function useAdminItems() {
  return useQuery({ queryKey: ITEMS_KEY, queryFn: () => apiFetch<AdminItem[]>('/api/admin/items') });
}

// ?all=1 để món thuộc nhóm đã ngừng vẫn hiện đúng tên nhóm
export function useAllCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: () => apiFetch<Category[]>('/api/item-categories?all=1'),
  });
}

export function useRefreshCatalog() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: CATALOG_KEY }), [qc]);
}

function send<T>(method: 'POST' | 'PATCH', path: string, body: unknown, csrfToken: string | null) {
  return apiFetch<T>(path, { method, body: JSON.stringify(body), csrfToken });
}

export const createItem = (body: ItemPayload, csrf: string | null) =>
  send<AdminItem>('POST', '/api/admin/items', body, csrf);

export const patchItem = (id: string, body: ItemPayload, csrf: string | null) =>
  send<AdminItem>('PATCH', `/api/admin/items/${id}`, body, csrf);

export const deleteItem = (id: string, csrfToken: string | null) =>
  apiFetch<void>(`/api/admin/items/${id}`, { method: 'DELETE', csrfToken });

export const createCategory = (body: CategoryPayload, csrf: string | null) =>
  send<Category>('POST', '/api/admin/item-categories', body, csrf);

export interface CategorySaved extends Category {
  // Chỉ có khi vừa bật lại nhóm
  affected_items?: { reactivated: number; still_inactive: number };
}

export const patchCategory = (id: string, body: CategoryPayload, csrf: string | null) =>
  send<CategorySaved>('PATCH', `/api/admin/item-categories/${id}`, body, csrf);

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export function uploadItemImage(blob: Blob, mime: string, csrfToken: string | null) {
  const form = new FormData();
  form.append('purpose', 'item_image');
  form.append('file', blob, `item.${EXT[mime] ?? 'jpg'}`);
  return apiFetch<{ id: string }>('/api/files', { method: 'POST', body: form, csrfToken });
}

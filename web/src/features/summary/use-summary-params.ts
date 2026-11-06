import { useEffect } from 'react';
import { YM, lockedYm } from '@/lib/ym';
import { useUrlPatch, type UrlPatch } from '@/lib/use-url-patch';
import type { AdjustReason } from './summary.api';

export type SummaryView = 'person' | 'item';
export type PersonFilter = 'unregistered' | 'pending_delivery' | 'custom_pending' | 'over_max' | 'left';
export type PageFilter = PersonFilter | 'low';

const PERSON_FILTERS: readonly string[] = ['unregistered', 'pending_delivery', 'custom_pending', 'over_max', 'left'];

// Chỉ xem kỳ đã khóa: mặc định và trần là kỳ khóa gần nhất; ?ym= sai mẫu, là kỳ mở hoặc tương lai → thay URL, không gọi API với tháng đó
export function useSummaryParams(openYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked < openYm ? asked : openYm && lockedYm(openYm);
  // Liên kết cũ/viết tay dùng view=items: hiểu như view=item rồi chuẩn hóa URL
  const askedView = params.get('view');
  const view: SummaryView = askedView === 'item' || askedView === 'items' ? 'item' : 'person';
  // ?left=1 đến từ nhắc người đã nghỉ ở Tháng này: lọc người nghỉ còn phần chưa nhận, lý do giảm chọn sẵn "Người đã nghỉ"
  const left = params.get('left') === '1';
  const raw = params.get('filter') ?? (left ? 'left' : '');
  const filter: PageFilter | null = view === 'item' ? (raw === 'low' ? 'low' : null) : PERSON_FILTERS.includes(raw) ? (raw as PersonFilter) : null;

  useEffect(() => {
    const patch: UrlPatch = {};
    if (openYm && ym && asked !== ym) patch.ym = ym;
    if (askedView === 'items') patch.view = 'item';
    if (Object.keys(patch).length) update(patch, true);
  }, [openYm, ym, asked, askedView, update]);

  // ?item= đến từ "Xem ai đăng ký" ở Gửi ADM: Tổng hợp theo món lọc sẵn một món
  const item = view === 'item' ? params.get('item') || null : null;

  return {
    ym,
    view,
    filter,
    item,
    presetReason: (filter === 'left' ? 'user_left' : undefined) as AdjustReason | undefined,
    q: params.get('q') ?? '',
    setMonth: (next: string) => update({ ym: next, request: null }),
    setView: (next: SummaryView) => update({ view: next === 'item' ? 'item' : null, filter: null, left: null, item: null }),
    toggleFilter: (next: PageFilter) =>
      update({ view: next === 'low' ? 'item' : null, filter: filter === next ? null : next, left: null, item: null }),
    clearItem: () => update({ item: null }),
    clearFilter: () => update({ filter: null, left: null }),
    setQ: (next: string) => update({ q: next || null }, true),
  };
}

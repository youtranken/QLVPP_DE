import { useEffect } from 'react';
import { YM, lockedYm } from '@/lib/ym';
import { useUrlPatch, type UrlPatch } from '@/lib/use-url-patch';
import type { AdjustReason } from './summary.api';

export type SummaryView = 'person' | 'item';
export type PersonFilter = 'unregistered' | 'pending_delivery' | 'custom_pending' | 'over_max' | 'left';
export type PageFilter = PersonFilter | 'low';

const PERSON_FILTERS: readonly string[] = ['unregistered', 'pending_delivery', 'custom_pending', 'over_max', 'left'];
// Lọc theo việc giao/vượt tối đa/người nghỉ chỉ có nghĩa ở kỳ đã khóa: kỳ đang mở thì bỏ
const LOCKED_ONLY: readonly string[] = ['pending_delivery', 'over_max', 'left'];

// Mặc định kỳ khóa gần nhất (Hành chính làm việc trên kỳ đã khóa); ?ym= sai mẫu hoặc vượt kỳ đang mở → thay URL bằng kỳ đó, không gọi API với tháng sai
export function useSummaryParams(openYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : openYm && lockedYm(openYm);
  const view: SummaryView = params.get('view') === 'item' ? 'item' : 'person';
  // ?left=1 đến từ nhắc người đã nghỉ ở Tháng này: lọc người nghỉ còn phần chưa nhận, lý do giảm chọn sẵn "Người đã nghỉ"
  const left = params.get('left') === '1';
  const raw = params.get('filter') ?? (left ? 'left' : '');
  const inOpen = !!ym && ym === openYm;
  const lockedOnlyInOpen = inOpen && (LOCKED_ONLY.includes(raw) || left);
  const filter: PageFilter | null =
    view === 'item' ? (raw === 'low' ? 'low' : null) : PERSON_FILTERS.includes(raw) && !lockedOnlyInOpen ? (raw as PersonFilter) : null;

  useEffect(() => {
    const patch: UrlPatch = {};
    if (openYm && ym && asked !== ym) patch.ym = ym;
    if (lockedOnlyInOpen) Object.assign(patch, { filter: null, left: null });
    if (Object.keys(patch).length) update(patch, true);
  }, [openYm, ym, asked, lockedOnlyInOpen, update]);

  // ?item= đến từ "Xem ai đăng ký" ở Gửi ADM: Tổng hợp theo món lọc sẵn một món
  const item = view === 'item' ? params.get('item') || null : null;

  return {
    ym,
    view,
    filter,
    item,
    presetReason: (filter === 'left' ? 'user_left' : undefined) as AdjustReason | undefined,
    q: params.get('q') ?? '',
    requestId: params.get('request'),
    setMonth: (next: string) =>
      update({ ym: next, request: null, ...(next === openYm && (LOCKED_ONLY.includes(raw) || left) ? { filter: null, left: null } : {}) }),
    setView: (next: SummaryView) => update({ view: next === 'item' ? 'item' : null, filter: null, left: null, item: null }),
    toggleFilter: (next: PageFilter) =>
      update({ view: next === 'low' ? 'item' : null, filter: filter === next ? null : next, left: null, item: null }),
    clearItem: () => update({ item: null }),
    clearFilter: () => update({ filter: null, left: null }),
    setQ: (next: string) => update({ q: next || null }, true),
    openAdjust: (id: string) => update({ request: id }),
    // ↑/↓ trong ngăn kéo thay mục lịch sử: Back về trang trước khi mở, không đi lùi qua từng người
    stepAdjust: (id: string) => update({ request: id }, true),
    closeAdjust: () => update({ request: null }),
  };
}

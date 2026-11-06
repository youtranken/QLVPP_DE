import { useEffect } from 'react';
import { YM, lockedYm } from '@/lib/ym';
import { useUrlPatch, type UrlPatch } from '@/lib/use-url-patch';

export type SummaryView = 'person' | 'item';
export type PersonFilter = 'unregistered' | 'pending_delivery' | 'custom_pending';
export type PageFilter = PersonFilter | 'low';

const PERSON_FILTERS: readonly string[] = ['unregistered', 'pending_delivery', 'custom_pending'];

// Mặc định kỳ khóa gần nhất (Hành chính làm việc trên kỳ đã khóa); ?ym= sai mẫu hoặc vượt kỳ đang mở → thay URL bằng kỳ đó, không gọi API với tháng sai
export function useSummaryParams(openYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : openYm && lockedYm(openYm);
  const view: SummaryView = params.get('view') === 'item' ? 'item' : 'person';
  const raw = params.get('filter') ?? '';
  // Kỳ đang mở chưa giao được (PERIOD_NOT_LOCKED) → lọc "còn dòng chờ giao" vô nghĩa, bỏ đi
  const pendingInOpen = raw === 'pending_delivery' && !!ym && ym === openYm;
  const filter: PageFilter | null =
    view === 'item' ? (raw === 'low' ? 'low' : null) : PERSON_FILTERS.includes(raw) && !pendingInOpen ? (raw as PersonFilter) : null;


  useEffect(() => {
    const patch: UrlPatch = {};
    if (openYm && ym && asked !== ym) patch.ym = ym;
    if (pendingInOpen) patch.filter = null;
    if (Object.keys(patch).length) update(patch, true);
  }, [openYm, ym, asked, pendingInOpen, update]);

  return {
    ym,
    view,
    filter,
    q: params.get('q') ?? '',
    requestId: params.get('request'),
    setMonth: (next: string) =>
      update({ ym: next, request: null, ...(next === openYm && raw === 'pending_delivery' ? { filter: null } : {}) }),
    setView: (next: SummaryView) => update({ view: next === 'item' ? 'item' : null, filter: null }),
    toggleFilter: (next: PageFilter) =>
      update({ view: next === 'low' ? 'item' : null, filter: filter === next ? null : next }),
    clearFilter: () => update({ filter: null }),
    setQ: (next: string) => update({ q: next || null }, true),
    openAdjust: (id: string) => update({ request: id }),
    // ↑/↓ trong ngăn kéo thay mục lịch sử: Back về trang trước khi mở, không đi lùi qua từng người
    stepAdjust: (id: string) => update({ request: id }, true),
    closeAdjust: () => update({ request: null }),
  };
}

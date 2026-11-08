import { useEffect } from 'react';
import { YM, lockedYm } from '@/lib/ym';
import type { AdjustReason } from '@/features/summary/summary.api';
import { useUrlPatch, type UrlPatch } from '@/lib/use-url-patch';
import { MONTH_CHIPS, type MonthChip } from './month-chips';

const isChip = (v: string | null): v is MonthChip => MONTH_CHIPS.includes(v as MonthChip);

// Tham số của trang Tổng hợp cũ: lọc cũ thành chip mới, phần không còn chỗ (xem theo món, chưa đăng ký, sắp hết) thì bỏ
const LEGACY_FILTER: Record<string, MonthChip | undefined> = {
  pending_delivery: 'undelivered',
  left: 'undelivered',
  over_max: 'noted',
  custom_pending: 'noted',
};

// Mặc định kỳ khóa gần nhất; trần là kỳ đang mở (chỉ xem); ?ym= sai mẫu hoặc tương lai → thay URL, không gọi API với tháng đó
export function useMonthParams(openYm: string | undefined) {
  const [params, update] = useUrlPatch();
  const asked = params.get('ym');
  const ym = asked && openYm && YM.test(asked) && asked <= openYm ? asked : openYm && lockedYm(openYm);
  const legacy = params.get('filter');
  // ?left=1 từ nhắc người đã nghỉ: chỉ liệt kê người đã nghỉ; phiếu của họ chọn sẵn lý do "Người đã nghỉ"
  const left = params.get('left') === '1' || legacy === 'left';
  const rawChip = params.get('chip');
  const chip: MonthChip = isChip(rawChip) ? rawChip : ((legacy && LEGACY_FILTER[legacy]) || (left ? 'undelivered' : 'all'));
  const hasView = params.has('view');
  const hasItem = params.has('item');

  useEffect(() => {
    const patch: UrlPatch = {};
    if (openYm && ym && asked !== ym) patch.ym = ym;
    if (hasView) patch.view = null;
    if (hasItem) patch.item = null;
    if (legacy !== null) {
      patch.filter = null;
      const mapped = LEGACY_FILTER[legacy];
      if (mapped && !isChip(rawChip)) patch.chip = mapped;
      if (legacy === 'left') patch.left = '1';
    }
    if (Object.keys(patch).length) update(patch, true);
  }, [openYm, ym, asked, legacy, rawChip, hasView, hasItem, update]);

  return {
    ym,
    chip,
    q: params.get('q') ?? '',
    left,
    presetReason: (left ? 'user_left' : undefined) as AdjustReason | undefined,
    setYm: (next: string) => update({ ym: next, request: null }),
    setChip: (next: MonthChip) => update({ chip: next === 'all' ? null : next, left: null }),
    setQ: (next: string) => update({ q: next || null }, true),
  };
}

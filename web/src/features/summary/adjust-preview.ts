import type { LineView } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { targetOf, type Pick } from './adjust-plan';
import type { AdjustReason, AdminRequestView } from './summary.api';

type Translate = (key: string, opts?: Record<string, unknown>) => string;

export const lineNameOf = (l: LineView) => l.item?.name ?? l.custom_name ?? '';
export const lineUnitOf = (l: LineView) => l.item?.unit ?? l.custom_unit ?? null;

// Câu nhân viên sẽ đọc ở chuông/lịch sử: "Adm D&E giảm A 10 → 5 cuộn, từ chối B (tháng 12): Số lượng quá nhiều."
export function previewText(
  t: Translate,
  unitName: (code: string | null) => string,
  view: AdminRequestView,
  picks: Record<string, Pick>,
  reason: AdjustReason | undefined,
  note: string,
): string | null {
  const parts = view.lines.flatMap((l) => {
    const p = picks[l.id];
    if (!p) return [];
    if (p.mode === 'reject') return [t('summary.adjust.partReject', { name: lineNameOf(l) })];
    return [t('summary.adjust.partReduce', { name: lineNameOf(l), from: l.qty, to: targetOf(l, p), unit: unitName(lineUnitOf(l)) })];
  });
  if (parts.length === 0 || !reason) return null;
  const clean = note.normalize('NFC').trim();
  const why = reason === 'other' ? clean : clean ? `${t(`adjustReason.${reason}`)} — ${clean}` : t(`adjustReason.${reason}`);
  return t('summary.adjust.preview', { parts: parts.join(', '), month: monthOf(view.period_ym), reason: why });
}

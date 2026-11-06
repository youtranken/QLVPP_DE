import { useTranslation } from 'react-i18next';
import { adjustReasonText } from '@/lib/adjust-reason';
import { formatVnStamp } from '@/lib/format-time';
import { ItemThumb } from '@/ui/item-thumb';
import type { LineAdjustment, RemovedLine } from './request.api';
import { useRequestFormat } from './request-format';

// Mỗi lần Hành chính giảm một dòng, theo thời gian (server đã xếp)
export function AdjustNotes({ adjustments = [], unit }: { adjustments?: LineAdjustment[]; unit: string }) {
  const { t } = useTranslation();
  if (adjustments.length === 0) return null;
  return (
    <ul className="hs-adjusts">
      {adjustments.map((a) => (
        <li key={`${a.at}-${a.after}`} className="hs-adjust">
          {t('request.history.adjusted', {
            before: a.before,
            after: a.after,
            unit,
            reason: adjustReasonText(t, a.reason_code, a.reason_note),
            at: formatVnStamp(a.at),
          })}
        </li>
      ))}
    </ul>
  );
}

// Dòng đã bị bỏ không còn trong phiếu: tên, ĐVT lấy từ bản ghi điều chỉnh
export function RemovedLines({ lines }: { lines: RemovedLine[] }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return lines.map((l) => (
    <li key={`${l.at}-${l.name}`} className="hs-card hs-line">
      <ItemThumb fileId={null} alt="" tone="g0" size={42} />
      <div className="hs-line-body">
        <span className="hs-item-name">{fmt.name(l)}</span>
        <div className="hs-adjust">
          {t('request.history.removed', {
            before: l.before,
            unit: fmt.unit(l.unit),
            reason: adjustReasonText(t, l.reason_code, l.reason_note),
          })}
        </div>
      </div>
    </li>
  ));
}

export function RemovedAllNote({ lines }: { lines: RemovedLine[] }) {
  const { t } = useTranslation();
  const reasons = [...new Set(lines.map((l) => adjustReasonText(t, l.reason_code, l.reason_note)))];
  return <p className="hs-card hs-adjust">{t('request.history.removedAll', { reasons: reasons.join('; ') })}</p>;
}

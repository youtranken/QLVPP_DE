import { useTranslation } from 'react-i18next';
import { PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/dialog';
import { IconDocCopy } from '@/ui/icons';
import { monthOf } from './request-format';
import type { CopySummary } from './use-copy-previous';

export function CopyPreviousButton({ fromYm, busy, onClick }: { fromYm: string; busy: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  // Điện thoại: nút chỉ còn nửa hàng, chữ đầy đủ sẽ gãy 2 dòng
  const phone = useMediaQuery(PHONE_QUERY);
  return (
    <button type="button" className="rq-copy" disabled={busy} onClick={onClick}>
      <IconDocCopy />
      <span className="rq-copy-label">{t(phone ? 'request.grid.copyShort' : 'request.grid.copy', { month: monthOf(fromYm) })}</span>
    </button>
  );
}

// Báo bằng lời món nào không chép được và vì sao, để member không tưởng giỏ thiếu do lỗi
export function CopySummaryDialog({ summary, onClose }: { summary: CopySummary; onClose: () => void }) {
  const { result, report } = summary;
  const { t } = useTranslation();
  const notes = [
    ...result.skipped.map((s) =>
      t('request.copy.skipped', { name: s.name, reason: t(`request.copy.reasons.${s.reason}`) }),
    ),
    ...result.capped.map((c) => t('request.copy.capped', c)),
    ...result.previously_accepted.map((name) => t('request.copy.accepted', { name })),
    ...report.heldByAdmin.map((name) => t('request.copy.skipped', { name, reason: t('request.copy.reasons.HELD_BY_ADMIN') })),
    ...(report.unavailable > 0 ? [t('request.unavailable', { n: report.unavailable })] : []),
  ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} className="sheet rq-dialog" maxWidth={480}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('request.copy.summaryTitle', { month: monthOf(result.from_ym) })}</DialogTitle>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('request.copy.footer')}</DialogDescription>
        <ul className="rq-copy-list">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('request.copy.ok')}
        </button>
      </div>
    </Dialog>
  );
}

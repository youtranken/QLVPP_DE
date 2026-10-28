import { useTranslation } from 'react-i18next';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/dialog';
import { IconDocCopy } from '@/ui/icons';
import type { CopyPreviousResult } from './request.api';
import { monthOf } from './request-format';

export function CopyPreviousButton({ fromYm, busy, onClick }: { fromYm: string; busy: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button type="button" className="rq-copy" disabled={busy} onClick={onClick}>
      <IconDocCopy />
      {t('request.hero.copy', { month: monthOf(fromYm) })}
    </button>
  );
}

// Báo bằng lời món nào không chép được và vì sao, để member không tưởng giỏ thiếu do lỗi
export function CopySummaryDialog({ result, onClose }: { result: CopyPreviousResult; onClose: () => void }) {
  const { t } = useTranslation();
  const notes = [
    ...result.skipped.map((s) =>
      t('request.copy.skipped', { name: s.name, reason: t(`request.copy.reasons.${s.reason}`) }),
    ),
    ...result.capped.map((c) => t('request.copy.capped', c)),
    ...result.previously_accepted.map((name) => t('request.copy.accepted', { name })),
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

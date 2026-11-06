import { useTranslation } from 'react-i18next';
import { Dialog, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useRequestFormat } from '@/features/request/request-format';
import type { ArrivalRow } from './arrival-rows';

const MAX_LINES = 8;
// Chèn danh sách vào giữa câu W15 mà không tách khóa i18n thành nhiều mảnh
const LIST_MARK = '\u0000';

interface SaveProps {
  diffs: { row: ArrivalRow; qty: number }[];
  pending: boolean;
  onBack: () => void;
  onSave: () => void;
}

export function SaveConfirm({ diffs, pending, onBack, onSave }: SaveProps) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const [before, after] = t('warn.W15', { n: diffs.length, list: LIST_MARK }).split(LIST_MARK);
  const more = diffs.length - MAX_LINES;
  return (
    <Dialog open onOpenChange={(o) => !o && onBack()} maxWidth={520}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('arrivals.confirm.title')}</DialogTitle>
        <DialogCloseButton />
      </div>
      <div className="sheet-body ar-confirm">
        <DialogDescription asChild>
          <div>
            {before}
            <ul>
              {diffs.slice(0, MAX_LINES).map(({ row, qty }) => (
                <li key={row.item_id}>{t('arrivals.confirm.line', { name: fmt.name(row), x: qty, y: row.remaining })}</li>
              ))}
              {more > 0 && <li className="ar-confirm__more">{t('arrivals.confirm.more', { n: more })}</li>}
            </ul>
            {after}
          </div>
        </DialogDescription>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onBack}>
          {t('arrivals.confirm.back')}
        </button>
        <button type="button" className="btn btn--primary" disabled={pending} onClick={onSave}>
          {t('arrivals.confirm.save')}
        </button>
      </div>
    </Dialog>
  );
}

export interface FullSummary {
  items: number;
  units: number;
  time: string;
  skip: { adm: number; done: number };
  custom: number;
  reduced: number;
  replacesDraft: boolean;
}

interface FullProps {
  s: FullSummary;
  pending: boolean;
  onBack: () => void;
  onConfirm: () => void;
}

export function FullConfirm({ s, pending, onBack, onConfirm }: FullProps) {
  const { t } = useTranslation();
  const skips = [
    ['skipAdm', s.skip.adm],
    ['skipDone', s.skip.done],
  ].filter(([, n]) => Number(n) > 0) as [string, number][];
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onBack()} maxWidth={520}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('arrivals.full.title')}</DialogTitle>
        <DialogCloseButton disabled={pending} />
      </div>
      <div className="sheet-body ar-confirm">
        <DialogDescription asChild>
          <div>
            <p>{t('warn.W18', { x: s.items, y: s.units, time: s.time })}</p>
            {skips.length > 0 && (
              <ul>
                {skips.map(([key, n]) => (
                  <li key={key}>{t(`arrivals.full.${key}`, { n })}</li>
                ))}
              </ul>
            )}
            {s.custom > 0 && <p>{t('arrivals.full.custom', { n: s.custom })}</p>}
            {s.reduced > 0 && <p className="ar-warn-text">{t('warn.W14head', { x: s.reduced })}</p>}
            {s.replacesDraft && <p className="ar-warn-text">{t('arrivals.full.replaceDraft')}</p>}
          </div>
        </DialogDescription>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" disabled={pending} onClick={onBack}>
          {t('arrivals.full.back')}
        </button>
        <button type="button" className="btn btn--primary" disabled={pending} onClick={onConfirm}>
          {pending ? t('arrivals.full.sending') : t('arrivals.full.confirm')}
        </button>
      </div>
    </Dialog>
  );
}

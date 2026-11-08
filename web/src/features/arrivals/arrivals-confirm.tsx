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

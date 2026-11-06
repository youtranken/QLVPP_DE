import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useRequestFormat } from './request-format';
import type { CartLine } from './use-cart';

export function SaveDialog({
  month,
  lastDay,
  lines,
  saving,
  onClose,
  onConfirm,
}: {
  month: number;
  lastDay: string;
  lines: CartLine[];
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (
    // Lưu hỏng thì use-save-flow tự đưa focus tới dòng lỗi/thông báo, không trả về nút Lưu
    <Dialog open onOpenChange={(o) => !o && onClose()} dismissible={!saving} className="sheet rq-dialog" maxWidth={440} returnFocus={false}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('request.confirm.title', { month })}</DialogTitle>
      </div>
      <div className="sheet-body">
        <DialogDescription>
          {lines.length > 0 ? t('request.confirm.hint', { date: lastDay }) : t('request.confirm.emptyHint')}
        </DialogDescription>
        {lines.length > 0 && (
          <table className="rq-confirm-table">
            <tbody>
              {lines.map((l) => (
                <tr key={l.key}>
                  <td>{fmt.name(l.label)}</td>
                  <td className="num">{t('request.cart.qty', { qty: l.qty, unit: fmt.unit(l.label.unit) })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {lines.length > 0 && (
          <p className="rq-confirm-total num">
            {t('request.cart.summary', { kinds: lines.length, units: lines.reduce((sum, l) => sum + l.qty, 0) })}
          </p>
        )}
      </div>
      <div className="sheet-footer">
        <DialogClose asChild>
          <button type="button" className="btn" disabled={saving}>
            {t('request.confirm.back')}
          </button>
        </DialogClose>
        <button type="button" className="btn btn--primary" disabled={saving} onClick={onConfirm}>
          {saving ? t('request.confirm.saving') : t('request.confirm.submit')}
        </button>
      </div>
    </Dialog>
  );
}

export function StaleDialog({
  month,
  reloading,
  onReload,
  onClose,
}: {
  month: number;
  reloading: boolean;
  onReload: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} dismissible={!reloading} className="sheet rq-dialog" maxWidth={440}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('request.stale.title')}</DialogTitle>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('request.stale.body', { month })}</DialogDescription>
      </div>
      <div className="sheet-footer">
        <DialogClose asChild>
          <button type="button" className="btn" disabled={reloading}>
            {t('request.stale.keep')}
          </button>
        </DialogClose>
        <button type="button" className="btn btn--primary" disabled={reloading} onClick={onReload}>
          {t('request.stale.reload')}
        </button>
      </div>
    </Dialog>
  );
}

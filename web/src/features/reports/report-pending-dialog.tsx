import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';

export function PendingDialog({ count, onReview, onConfirm, onCancel }: { count: number; onReview: () => void; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} maxWidth={440}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('reports.page.pendingDialog.title', { count })}</DialogTitle>
        <DialogClose asChild>
          <button type="button" className="sheet-close" aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
        </DialogClose>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('reports.page.pendingDialog.message')}</DialogDescription>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onReview}>
          {t('reports.page.pendingDialog.review')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          {t('reports.page.pendingDialog.ok')}
        </button>
      </div>
    </Dialog>
  );
}

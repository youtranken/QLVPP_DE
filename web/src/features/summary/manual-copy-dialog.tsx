import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Icon } from '@/ui/icon';

export function ManualCopyDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const { t } = useTranslation();
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => box.current?.select(), []);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} maxWidth={520}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('summary.unregistered.copy.dialogTitle')}</DialogTitle>
        <DialogClose asChild>
          <button type="button" className="sheet-close" aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
        </DialogClose>
      </div>
      <div className="sheet-body">
        <DialogDescription>{t('summary.unregistered.copy.dialogHint')}</DialogDescription>
        <textarea
          ref={box}
          autoFocus
          className="sm-copy-text"
          readOnly
          rows={8}
          value={text}
          aria-label={t('summary.unregistered.copy.dialogTitle')}
          onFocus={(e) => e.currentTarget.select()}
        />
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onClose}>
          {t('common.cancel')}
        </button>
      </div>
    </Dialog>
  );
}

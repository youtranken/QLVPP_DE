import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogTitle, DialogDescription, DialogCloseButton } from '@/ui/dialog';

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  warning,
  caution = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  warning?: ReactNode;
  caution?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
      dismissible={!busy}
      maxWidth={440}
      onOpenAutoFocus={
        caution
          ? (e) => {
              e.preventDefault();
              cancelRef.current?.focus();
            }
          : undefined
      }
    >
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{title}</DialogTitle>
        <DialogCloseButton disabled={busy} />
      </div>
      <div className="sheet-body">
        {error && <p role="alert" className="alert alert--danger">{error}</p>}
        <DialogDescription className={caution ? 'alert alert--warn' : undefined}>{message}</DialogDescription>
        {warning && (
          <div role="note" className="alert alert--warn">
            {warning}
          </div>
        )}
      </div>
      <div className="sheet-footer">
        <button ref={cancelRef} type="button" className="btn btn--ghost" disabled={busy} onClick={onCancel}>
          {cancelLabel ?? t('common.cancel')}
        </button>
        <button
          type="button"
          className={danger ? 'btn btn--danger btn--solid' : 'btn btn--primary'}
          disabled={busy}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

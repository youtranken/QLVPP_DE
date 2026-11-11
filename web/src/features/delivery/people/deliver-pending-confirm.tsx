import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogDescription, DialogTitle } from '@/ui/dialog';

interface Props {
  title: string;
  names: string[];
  onConfirm: () => void;
  onCancel: () => void;
}

const MAX_NAMES = 5;

// Giao khi phiếu còn món ngoài danh mục chưa duyệt: nói trước tên món (tối đa 5) sẽ bị ghi Không mua; focus sẵn ở Hủy
export function DeliverPendingConfirm({ title, names, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const more = names.length - MAX_NAMES;
  const listed = names.slice(0, MAX_NAMES).join(', ') + (more > 0 ? ` ${t('warn.W8more', { k: more })}` : '');
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      maxWidth={520}
      returnFocus={false}
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        cancel.current?.focus();
      }}
    >
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{title}</DialogTitle>
      </div>
      <div className="sheet-body">
        <DialogDescription className="dd-pending">{t('warn.W8deliver', { names: listed })}</DialogDescription>
      </div>
      <div className="sheet-footer">
        <button ref={cancel} type="button" className="btn btn--ghost" onClick={onCancel}>
          {t('delivery.confirm.abort')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          {t('delivery.confirm.ok')}
        </button>
      </div>
    </Dialog>
  );
}

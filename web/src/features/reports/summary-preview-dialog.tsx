import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { monthOf } from '@/features/request/request-format';
import { SnapshotWarnings, type PendingCustom } from '@/features/send-adm/send-adm-dialogs';
import type { OrderChange } from '@/features/send-adm/send-adm-rows';
import { orderOf } from './print-format';
import { PrintRequestForm } from './print-request-form';
import type { SnapshotData } from './reports.api';
import './print.m1.css';

interface Props {
  snap: SnapshotData;
  ym: string;
  // confirm: kỳ đang lập phiếu, "Đồng ý và in" mới lưu bản; print: tháng cũ, in lại bản đã gửi
  mode: 'confirm' | 'print';
  pending?: PendingCustom;
  changes?: OrderChange[];
  sentAt?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Đếm như tờ in: hàng có Đề nghị > 0
function countsOf(snap: SnapshotData) {
  const qty = [...snap.byItem, ...snap.custom].map((r) => orderOf(snap, r)).filter((n) => n > 0);
  return { items: qty.length, units: qty.reduce((a, b) => a + b, 0) };
}

// "Xem tổng kết": đúng tờ sẽ in, thu nhỏ trong khung A4; Hủy không lưu gì
const NO_PENDING: PendingCustom = { count: 0, names: [] };

export function SummaryPreviewDialog({ snap, ym, mode, pending = NO_PENDING, changes = [], sentAt = null, onConfirm, onCancel }: Props) {
  const { t } = useTranslation();
  const cancel = useRef<HTMLButtonElement>(null);
  const confirming = mode === 'confirm';
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onCancel()}
      maxWidth={900}
      className="sheet bc-preview"
      // Chốt có thể ghi Không mua cho món chờ: focus sẵn ở Hủy, không ở nút chốt
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        cancel.current?.focus();
      }}
    >
      <div className="sheet-header">
        <div className="bc-preview__titles">
          <DialogTitle className="sheet-title">{t('reports.preview.title', { month: monthOf(ym), year: ym.slice(0, 4) })}</DialogTitle>
          <DialogDescription className="bc-preview__sub">{t('reports.preview.sub', countsOf(snap))}</DialogDescription>
        </div>
        <DialogCloseButton />
      </div>
      <div className="bc-preview__body">
        {confirming && (pending.count > 0 || changes.length > 0) && (
          <div className="sa-confirm">
            <SnapshotWarnings pending={pending} changes={changes} sentAt={sentAt} />
          </div>
        )}
        <div className="bc-preview__sheet">
          <PrintRequestForm snap={snap} />
        </div>
      </div>
      <div className="sheet-footer bc-preview__foot">
        {confirming && <p className="bc-preview__note">{t('reports.preview.foot')}</p>}
        <button ref={cancel} type="button" className="btn" onClick={onCancel}>
          {t('reports.preview.cancel')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          {t(confirming ? 'reports.preview.confirm' : 'reports.preview.print')}
        </button>
      </div>
    </Dialog>
  );
}

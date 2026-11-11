import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { Dialog, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useRequestFormat } from '@/features/request/request-format';
import type { SnapshotKind } from '@/features/reports/reports.api';
import type { OrderChange } from './send-adm-rows';

const MAX_CHANGES = 10;
const MAX_PENDING_NAMES = 5;

function ChangeList({ changes, sentAt }: { changes: OrderChange[]; sentAt: string }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const more = changes.length - MAX_CHANGES;
  return (
    <div className="sa-changes">
      <p>{t('sendAdm.confirm.changes', { time: formatVnStamp(sentAt) })}</p>
      <ul>
        {changes.slice(0, MAX_CHANGES).map((c) => (
          <li key={c.key}>{t('sendAdm.confirm.change', { name: fmt.name(c), x: c.from, y: c.to })}</li>
        ))}
      </ul>
      {more > 0 && <p>{t('sendAdm.confirm.more', { n: more })}</p>}
    </div>
  );
}

// Chốt bản ghi Không mua cho món ngoài danh mục còn chờ: nói trước tên món (tối đa 5)
export function PendingCustomWarning({ pending, names }: { pending: number; names: string[] }) {
  const { t } = useTranslation();
  const shown = names.slice(0, MAX_PENDING_NAMES);
  const more = pending - shown.length;
  return (
    <div className="sa-w8">
      <p>{t('warn.W8', { n: pending })}</p>
      {shown.length > 0 && (
        <ul>
          {shown.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
        </ul>
      )}
      {more > 0 && <p>{t('warn.W8more', { k: more })}</p>}
    </div>
  );
}

export interface PendingCustom {
  count: number;
  names: string[];
}

// Cảnh báo trước khi chốt, dùng chung cho hộp hỏi lại (Excel) và hộp Xem tổng kết: món đổi sau bản đã gửi, món ngoài DM sẽ ghi Không mua
export function SnapshotWarnings({ pending, changes, sentAt, conflict = false }: { pending: PendingCustom; changes: OrderChange[]; sentAt: string | null; conflict?: boolean }) {
  const { t } = useTranslation();
  return (
    <>
      {conflict && (
        <p role="alert" className="alert alert--danger">
          {t('warn.W8changed')}
        </p>
      )}
      {sentAt !== null && changes.length > 0 && <ChangeList changes={changes} sentAt={sentAt} />}
      {pending.count > 0 && <PendingCustomWarning pending={pending.count} names={pending.names} />}
    </>
  );
}

interface PrintConfirmProps {
  kind: SnapshotKind;
  pending: PendingCustom;
  changes: OrderChange[];
  sentAt: string | null;
  busy?: boolean;
  conflict?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Hỏi lại trước khi chốt: bản thay thế (liệt kê món đổi số) và/hoặc còn món ngoài danh mục chưa duyệt (sẽ ghi Không mua)
export function PrintConfirm({ kind, pending, changes, sentAt, busy = false, conflict = false, onConfirm, onCancel }: PrintConfirmProps) {
  const { t } = useTranslation();
  const back = useRef<HTMLButtonElement>(null);
  const replacing = sentAt !== null && changes.length > 0;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && !busy && onCancel()}
      dismissible={!busy}
      maxWidth={520}
      // Chốt ghi Không mua cho món chờ: focus sẵn ở nút lùi, không ở nút chốt
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        back.current?.focus();
      }}
    >
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{replacing ? t('sendAdm.confirm.replaceTitle', { time: formatVnStamp(sentAt) }) : t('sendAdm.confirm.title')}</DialogTitle>
        <DialogCloseButton />
      </div>
      <div className="sheet-body sa-confirm">
        <DialogDescription asChild>
          <div>
            <SnapshotWarnings pending={pending} changes={changes} sentAt={sentAt} conflict={conflict} />
          </div>
        </DialogDescription>
      </div>
      <div className="sheet-footer">
        <button ref={back} type="button" className="btn" disabled={busy} onClick={onCancel}>
          {t('sendAdm.confirm.back')}
        </button>
        <button type="button" className="btn btn--primary" disabled={busy} aria-busy={busy || undefined} onClick={onConfirm}>
          {t(kind === 'xlsx' ? 'sendAdm.actions.xlsx' : 'sendAdm.actions.print')}
        </button>
      </div>
    </Dialog>
  );
}

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatVnStamp } from '@/lib/format-time';
import { Dialog, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { useRequestFormat } from '@/features/request/request-format';
import type { SnapshotKind } from '@/features/reports/reports.api';
import type { OrderChange } from './send-adm-rows';

const MAX_CHANGES = 10;

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

interface PrintConfirmProps {
  kind: SnapshotKind;
  ym: string;
  pending: number;
  changes: OrderChange[];
  sentAt: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

// Hỏi lại trước khi chốt: bản thay thế (liệt kê món đổi số) và/hoặc còn món ngoài danh mục chưa xem (không chặn)
export function PrintConfirm({ kind, ym, pending, changes, sentAt, onConfirm, onCancel }: PrintConfirmProps) {
  const { t } = useTranslation();
  const replacing = sentAt !== null && changes.length > 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onCancel()} maxWidth={520}>
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{replacing ? t('sendAdm.confirm.replaceTitle', { time: formatVnStamp(sentAt) }) : t('sendAdm.confirm.title')}</DialogTitle>
        <DialogCloseButton />
      </div>
      <div className="sheet-body sa-confirm">
        <DialogDescription asChild>
          <div>
            {replacing && <ChangeList changes={changes} sentAt={sentAt} />}
            {pending > 0 && (
              <div className="sa-w8">
                <p>{t('warn.W8', { n: pending })}</p>
                <Link to={`/admin/review?status=pending&ym=${ym}`}>{t('sendAdm.confirm.review')}</Link>
              </div>
            )}
          </div>
        </DialogDescription>
      </div>
      <div className="sheet-footer">
        <button type="button" className="btn" onClick={onCancel}>
          {t('sendAdm.confirm.back')}
        </button>
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          {t(kind === 'xlsx' ? 'sendAdm.actions.xlsx' : 'sendAdm.actions.print')}
        </button>
      </div>
    </Dialog>
  );
}

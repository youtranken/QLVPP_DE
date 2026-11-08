import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { vnSavedStamp } from '@/lib/format-time';
import { Dialog, DialogCloseButton, DialogDescription, DialogTitle } from '@/ui/dialog';
import { Loading, LoadError } from '@/ui/load-state';
import { receiveRows, receiveSummary, type ReceiveRow } from './receive-rows';
import { useMyRequest } from './request.api';
import { monthOf, useRequestFormat } from './request-format';

export function ReceiveStatus({ row }: { row: ReceiveRow }) {
  const { t } = useTranslation();
  if (row.state === 'none') return <span className="rq-recv-st is-none">{t('request.receive.none')}</span>;
  if (row.state === 'received') return <span className="rq-recv-st is-ok">{t('request.receive.received', { a: row.received, b: row.toGive })}</span>;
  return <span className="rq-recv-st is-wait">{t('request.receive.waiting', { n: row.waiting })}</span>;
}

function ReceiveTable({ rows }: { rows: ReceiveRow[] }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (
    <table className="rq-recv-table">
      <thead>
        <tr>
          <th scope="col">{t('request.receive.colItem')}</th>
          <th scope="col">{t('request.receive.colUnit')}</th>
          <th scope="col">{t('request.receive.colRegistered')}</th>
          <th scope="col">{t('request.receive.colToGive')}</th>
          <th scope="col">{t('request.receive.colReceived')}</th>
          <th scope="col">{t('request.receive.colStatus')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <th scope="row" className="rq-recv-name">
              {r.name}
              {r.note && <small>{r.note}</small>}
            </th>
            <td data-label={t('request.receive.colUnit')}>{fmt.unit(r.unit)}</td>
            <td data-label={t('request.receive.colRegistered')} className="num">{r.registered}</td>
            <td data-label={t('request.receive.colToGive')} className="num">{r.toGive}</td>
            <td data-label={t('request.receive.colReceived')} className="num">{r.received}</td>
            <td data-label={t('request.receive.colStatus')}><ReceiveStatus row={r} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Popup nhận hàng của phiếu kỳ đang giao (NV-NhanHang-Popup)
export function ReceiveDialog({ ym, onClose }: { ym: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const request = useMyRequest(ym);
  const view = request.data;
  const rows = view ? receiveRows(view, t, i18n.language) : [];
  const sum = receiveSummary(rows);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} className="sheet rq-dialog rq-recv" maxWidth={760}>
      <div className="sheet-header">
        <div>
          <DialogTitle className="sheet-title">{t('request.receive.title', { month: monthOf(ym) })}</DialogTitle>
          {view && (
            <DialogDescription className="rq-recv-sub">
              {t('request.receive.subtitle', { done: sum.done, total: sum.total, time: vnSavedStamp(view.updated_at) })}
            </DialogDescription>
          )}
        </div>
        <DialogCloseButton />
      </div>
      <div className="sheet-body">
        {request.isError && <LoadError onRetry={() => void request.refetch()} />}
        {request.isPending && request.fetchStatus !== 'idle' && <Loading />}
        {view && <ReceiveTable rows={rows} />}
        {view && <p className="rq-recv-foot">{t('request.receive.footer')}</p>}
      </div>
      <div className="sheet-footer">
        <Link className="btn" to={`/history/${ym}`} onClick={onClose}>
          {t('request.receive.history')}
        </Link>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          {t('request.receive.close')}
        </button>
      </div>
    </Dialog>
  );
}

import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import { useFormatTime } from '@/lib/format-time';
import { useSingleFlight } from '@/lib/use-single-flight';
import { LoadError } from '@/ui/load-state';
import { downloadSnapshot, printPath, useSnapshots, type SnapshotRow } from './reports.api';

function SnapshotItem({ snapshot: s, ym, onError }: { snapshot: SnapshotRow; ym: string; onError: (e: unknown) => void }) {
  const { t, i18n } = useTranslation();
  const flight = useSingleFlight();
  const navigate = useNavigate();
  const at = useFormatTime()(s.created_at);
  const col = (k: string) => t(`reports.snapshots.${k}`);
  return (
    <tr>
      <td data-label={col('colAt')}>{at}</td>
      <td data-label={col('colBy')}>{s.created_by_name ?? s.created_by_sub}</td>
      <td data-label={col('colKind')}>{t(`reports.snapshots.kind.${s.kind}`)}</td>
      <td data-label="">
        <div className="row-actions">
          <button type="button" className="btn btn--sm" aria-label={t('reports.snapshots.downloadLabel', { at })} disabled={flight.pending} onClick={() => void flight.run(() => downloadSnapshot(s.id, i18n.language, ym).catch(onError))}>
            {col('download')}
          </button>
          <button type="button" className="btn btn--sm" aria-label={t('reports.snapshots.reprintLabel', { at })} onClick={() => navigate(printPath(s.id))}>
            {col('reprint')}
          </button>
        </div>
      </td>
    </tr>
  );
}

// Tải lại / In lại dùng đúng bản đã chốt, không tạo bản mới
export function SnapshotList({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const titleId = useId();
  const query = useSnapshots(ym);
  const [error, setError] = useState<string | null>(null);
  // 401 đã chuyển sang đăng nhập lại ở api-client, không báo thêm
  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.status === 401) return;
    setError(apiErrorCode(e) === 'SNAPSHOT_NOT_FOUND' ? 'SNAPSHOT_NOT_FOUND' : 'UNKNOWN');
  };
  const items = query.data?.items ?? [];
  const col = (k: string) => t(`reports.snapshots.${k}`);
  return (
    <section className="a-panel rp-section" aria-labelledby={titleId}>
      <h2 id={titleId} className="rp-h2">
        {col('title')}
      </h2>
      {error && (
        <p role="alert" className="alert alert--warn rp-alert">
          {t(`reports.snapshots.error.${error}`)}
        </p>
      )}
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && <div className="empty">{col('empty')}</div>}
      {items.length > 0 && (
        <div className="table-wrap">
          <table className="table table-stack rp-table">
            <thead>
              <tr>
                <th>{col('colAt')}</th>
                <th>{col('colBy')}</th>
                <th>{col('colKind')}</th>
                <th className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <SnapshotItem key={s.id} snapshot={s} ym={ym} onError={fail} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

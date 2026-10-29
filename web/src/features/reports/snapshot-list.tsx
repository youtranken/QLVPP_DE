import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFormatTime } from '@/lib/format-time';
import { LoadError } from '@/ui/load-state';
import { downloadSnapshot, printPath, useSnapshots, type SnapshotRow } from './reports.api';

function SnapshotItem({ snapshot: s }: { snapshot: SnapshotRow }) {
  const { t, i18n } = useTranslation();
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
          <button type="button" className="btn btn--sm" aria-label={t('reports.snapshots.downloadLabel', { at })} onClick={() => downloadSnapshot(s.id, i18n.language)}>
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
  const items = query.data?.items ?? [];
  const col = (k: string) => t(`reports.snapshots.${k}`);
  return (
    <section className="a-panel rp-section" aria-labelledby={titleId}>
      <h2 id={titleId} className="rp-h2">
        {col('title')}
      </h2>
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
                <SnapshotItem key={s.id} snapshot={s} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

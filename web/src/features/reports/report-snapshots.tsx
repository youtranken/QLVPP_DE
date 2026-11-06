import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { formatVnStamp } from '@/lib/format-time';
import { Icon } from '@/ui/icon';
import { LoadError } from '@/ui/load-state';
import { printPath, useSnapshots, type SnapshotRow } from './reports.api';
import { ReportSection } from './report-section';
import type { SnapshotDownload } from './use-snapshot';

// Trang đã mở danh sách: trang in riêng dùng để Quay lại đúng chỗ
export type SnapshotsFrom = 'send-adm' | 'reports';

function SnapshotItem({ snapshot: s, files, from }: { snapshot: SnapshotRow; files: SnapshotDownload; from: SnapshotsFrom }) {
  const { t } = useTranslation();
  const id = useId();
  const at = formatVnStamp(s.created_at);
  return (
    <li className="bc-snap" aria-labelledby={`${id}-kind ${id}-meta`}>
      <span className="bc-snap__icon" aria-hidden="true">
        <Icon name={s.kind === 'xlsx' ? 'sheet' : 'printer'} />
      </span>
      <span className="bc-snap__text">
        <span className="bc-snap__kind">
          <b id={`${id}-kind`}>{t(`reports.snapshots.kind.${s.kind}`)}</b>
          {s.has_items === false && <span className="tag">{t('reports.snapshots.empty')}</span>}
        </span>
        <span id={`${id}-meta`} className="bc-snap__meta">
          {t('reports.snapshots.meta', { at: formatVnStamp(s.created_at, true), by: s.created_by_name ?? s.created_by_sub })}
        </span>
      </span>
      {s.kind === 'xlsx' ? (
        <button type="button" className="btn btn--ghost btn--sm bc-icon-btn" aria-label={t('reports.snapshots.download', { at })} title={t('reports.snapshots.download', { at })} disabled={files.pending} onClick={() => void files.run(s.id)}>
          <Icon name="download" size={18} />
        </button>
      ) : (
        <Link className="btn btn--ghost btn--sm bc-icon-btn" to={`${printPath(s.id)}?from=${from}`} aria-label={t('reports.snapshots.reprint', { at })} title={t('reports.snapshots.reprint', { at })}>
          <Icon name="printer" size={18} />
        </Link>
      )}
    </li>
  );
}

function DownloadFailure({ files }: { files: SnapshotDownload }) {
  const { t } = useTranslation();
  const failure = files.failure;
  if (!failure) return null;
  return (
    <div role="alert" className="alert alert--danger bc-snap-error">
      <Icon name="alert" size={18} />
      <span>{t(`reports.snapshots.error.${failure.error}`)}</span>
      {failure.error === 'DOWNLOAD_FAILED' && (
        <button type="button" className="btn btn--sm" disabled={files.pending} onClick={() => void files.run(failure.id)}>
          {t('reports.snapshots.retry')}
        </button>
      )}
    </div>
  );
}

export function ReportSnapshots({ ym, files, from }: { ym: string; files: SnapshotDownload; from: SnapshotsFrom }) {
  const { t } = useTranslation();
  const query = useSnapshots(ym);
  const items = query.data?.items ?? [];
  return (
    <ReportSection title={t('reports.snapshots.title')} note={t('reports.snapshots.note')}>
      <DownloadFailure files={files} />
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {query.isSuccess && items.length === 0 && <p className="bc-empty">{t('reports.snapshots.none')}</p>}
      {items.length > 0 && (
        <ul className="bc-snaps">
          {items.map((s) => (
            <SnapshotItem key={s.id} snapshot={s} files={files} from={from} />
          ))}
        </ul>
      )}
    </ReportSection>
  );
}

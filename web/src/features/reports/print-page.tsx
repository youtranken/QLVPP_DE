import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUrlPatch } from '@/lib/use-url-patch';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import { LoadError, Loading, NotFound } from '@/ui/load-state';
import { Icon } from '@/ui/icon';
import { IconSprite } from '@/ui/icon-sprite';
import { useShellFont } from '@/shell/use-shell-font';
import { monthOf } from '@/features/request/request-format';
import { useSnapshot, type SnapshotData } from './reports.api';
import { vnStampParts } from './print-format';
import { PrintRequestForm } from './print-request-form';
import { PrintAppendix } from './print-appendix';
import './print.m1.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Toolbar({ snap, appendix, onAppendix }: { snap: SnapshotData; appendix: boolean; onAppendix: (on: boolean) => void }) {
  const { t } = useTranslation();
  const at = vnStampParts(snap.created_at);
  return (
    <div role="toolbar" aria-label={t('reports.print.toolbar.label')} className="pp-toolbar">
      <Link className="btn btn--ghost" to={`/admin/reports?ym=${snap.period_ym}`}>
        <Icon name="back" size={18} />
        {t('reports.print.toolbar.back')}
      </Link>
      <span className="pp-toolbar__text">
        {t('reports.print.toolbar.summary', { month: monthOf(snap.period_ym), year: snap.period_ym.slice(0, 4), at: `${at.time} ${at.dayMonth}` })}
      </span>
      <label className="pp-switch">
        <input type="checkbox" checked={appendix} onChange={(e) => onAppendix(e.target.checked)} />
        {t('reports.print.toolbar.appendix')}
      </label>
      <button type="button" className="btn btn--primary" onClick={() => window.print()}>
        <Icon name="printer" size={18} />
        {t('reports.print.toolbar.print')}
      </button>
    </div>
  );
}

function PrintScreen({ snap }: { snap: SnapshotData }) {
  const [params, update] = useUrlPatch();
  const appendix = params.get('appendix') === '1';
  const onAppendix = (on: boolean) => update({ appendix: on ? '1' : null }, true);
  return (
    <div className="pp-page">
      <Toolbar snap={snap} appendix={appendix} onAppendix={onAppendix} />
      <PrintRequestForm snap={snap} />
      {appendix && <PrintAppendix snap={snap} />}
    </div>
  );
}

function PrintContent() {
  const { id = '' } = useParams();
  const valid = UUID.test(id);
  const query = useSnapshot(id, valid);
  if (!valid) return <NotFound />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 401) return <Loading />;
    return apiErrorCode(query.error) === 'SNAPSHOT_NOT_FOUND' ? <NotFound /> : <LoadError onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <Loading />;
  return <PrintScreen snap={query.data} />;
}

export function PrintPage() {
  useShellFont('admin');
  return (
    <>
      <IconSprite />
      <PrintContent />
    </>
  );
}

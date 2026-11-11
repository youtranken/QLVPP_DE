import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { apiErrorCode } from '@/lib/api-error';
import { LoadError, Loading, NotFound } from '@/ui/load-state';
import { Icon } from '@/ui/icon';
import { IconSprite } from '@/ui/icon-sprite';
import { useShellFont } from '@/shell/use-shell-font';
import { monthOf } from '@/features/request/request-format';
import { useSnapshot, type SnapshotData } from './reports.api';
import { hasItems, vnStampParts } from './print-format';
import { PrintRequestForm } from './print-request-form';
import { usePageStyle } from './print-page-style';
import './print.m1.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Quay lại luôn về Báo cáo & gửi ADM của tháng bản chốt
const backPath = (ym: string) => `/admin/reports?ym=${ym}`;

function Toolbar({ snap, empty }: { snap: SnapshotData; empty: boolean }) {
  const { t } = useTranslation();
  const at = vnStampParts(snap.created_at);
  const back = backPath(snap.period_ym);
  return (
    <div role="toolbar" aria-label={t('reports.print.toolbar.label')} className="pp-toolbar">
      <Link className="btn btn--ghost" to={back}>
        <Icon name="back" size={18} />
        {t('reports.print.toolbar.back')}
      </Link>
      <span className="pp-toolbar__text">
        {t('reports.print.toolbar.summary', { month: monthOf(snap.period_ym), year: snap.period_ym.slice(0, 4), at: `${at.time} ${at.dayMonth}` })}
      </span>
      <button type="button" className="btn btn--primary" disabled={empty} onClick={() => window.print()}>
        <Icon name="printer" size={18} />
        {t('reports.print.toolbar.print')}
      </button>
    </div>
  );
}

function EmptySnapshot() {
  const { t } = useTranslation();
  return (
    <p role="status" className="alert pp-empty-snap">
      {t('reports.print.emptySnapshot')}
    </p>
  );
}

// Bản in chỉ có Phiếu đề xuất; phụ lục chi tiết chỉ còn trong Excel (link cũ ?appendix=1 bị bỏ qua)
function PrintScreen({ snap }: { snap: SnapshotData }) {
  // Bản rỗng cũ: không có gì để trình ký
  const empty = !hasItems(snap);
  return (
    <div className="pp-page">
      <Toolbar snap={snap} empty={empty} />
      {empty ? <EmptySnapshot /> : <PrintRequestForm snap={snap} />}
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
  usePageStyle();
  return (
    <>
      <IconSprite />
      <PrintContent />
    </>
  );
}

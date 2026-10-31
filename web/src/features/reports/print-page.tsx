import { useId } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ApiError } from '@/lib/api-client';
import { formatVnStamp } from '@/lib/format-time';
import { apiErrorCode } from '@/lib/api-error';
import { LoadError, Loading, NotFound } from '@/ui/load-state';
import { monthOf } from '@/features/request/request-format';
import { useSnapshot, type SnapshotData } from './reports.api';
import { ReportItemTable } from './report-item-table';
import { IssuesTable } from './issues-table';
import { ReportDetailTable } from './report-detail-table';
import './reports.css';
import '@/css/print.css';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OLD_SIGNERS = ['preparer', 'head', 'approver'] as const;

interface SignBox {
  title: string;
  title_en: string;
  name: string;
}

// Bản chốt trước 0112 chỉ có signers: in 3 ô với chức danh cũ
function signBoxesOf(snap: SnapshotData, oldTitle: (role: string) => string): SignBox[] {
  if (snap.signature_boxes) return snap.signature_boxes;
  return OLD_SIGNERS.map((role) => ({ title: oldTitle(role), title_en: '', name: snap.signers?.[role] ?? '' }));
}

function SignBoxes({ snap }: { snap: SnapshotData }) {
  const { t } = useTranslation();
  const boxes = signBoxesOf(snap, (role) => t(`reports.printPage.signer.${role}`));
  return (
    <div role="group" aria-label={t('reports.printPage.signGroup')} className="pr-signs">
      {boxes.map((box, i) => (
        <div key={i} role="group" aria-label={box.title} className="pr-sign">
          <b>{box.title}</b>
          {box.title_en && <span className="pr-sign-en">{box.title_en}</span>}
          <span className="pr-sign-name">{box.name}</span>
        </div>
      ))}
    </div>
  );
}

function Toolbar({ ym }: { ym: string }) {
  const { t } = useTranslation();
  return (
    <div className="pr-toolbar">
      <Link className="btn btn--sm" to={`/admin/reports?ym=${ym}`}>
        {t('reports.printPage.back')}
      </Link>
      <span className="sp" />
      <button type="button" className="btn btn--sm btn--primary" onClick={() => window.print()}>
        {t('reports.printPage.print')}
      </button>
    </div>
  );
}

function PrintSheet({ snap }: { snap: SnapshotData }) {
  const { t } = useTranslation();
  const ids = [useId(), useId()];
  const year = snap.period_ym.slice(0, 4);
  return (
    <div className="pr-page">
      <Toolbar ym={snap.period_ym} />
      <article className="pr-sheet">
        <h1 className="pr-title">{t('reports.printPage.title', { month: monthOf(snap.period_ym), year })}</h1>
        <p className="pr-meta">{t('reports.printPage.preparedAt', { at: formatVnStamp(snap.created_at, true), by: snap.created_by.name ?? snap.created_by.sub })}</p>
        <section aria-labelledby={ids[0]}>
          <h2 id={ids[0]} className="pr-h2">{t('reports.items.title')}</h2>
          <ReportItemTable report={snap} frozen={snap.order_qty} />
          <IssuesTable issues={snap.issues} />
        </section>
        <section aria-labelledby={ids[1]}>
          <h2 id={ids[1]} className="pr-h2">{t('reports.detail.title')}</h2>
          <ReportDetailTable departments={snap.byDepartment} />
        </section>
        <SignBoxes snap={snap} />
      </article>
    </div>
  );
}

export function PrintPage() {
  const { id = '' } = useParams();
  const valid = UUID.test(id);
  const query = useSnapshot(id, valid);
  if (!valid) return <NotFound />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 401) return <Loading />;
    return apiErrorCode(query.error) === 'SNAPSHOT_NOT_FOUND' ? <NotFound /> : <LoadError onRetry={() => void query.refetch()} />;
  }
  if (!query.data) return <Loading />;
  return <PrintSheet snap={query.data} />;
}

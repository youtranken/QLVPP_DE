import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { monthOf } from '@/features/request/request-format';
import { useSnapshots, type SnapshotData } from './reports.api';
import { isDefaultOrder, snapshotOrdinal, vnStampParts } from './print-format';
import { IssuesTable, Part1Table, Part2Table } from './print-appendix-tables';

function Ordinal({ snap }: { snap: SnapshotData }) {
  const { t } = useTranslation();
  const { data } = useSnapshots(snap.period_ym);
  const k = snapshotOrdinal(data?.items, snap.id);
  if (k === null) return null;
  return <p>{t(isDefaultOrder(snap) ? 'reports.print.appendix.ordinalDefault' : 'reports.print.appendix.ordinal', { k })}</p>;
}

export function PrintAppendix({ snap }: { snap: SnapshotData }) {
  const { t } = useTranslation();
  const titleId = useId();
  const at = vnStampParts(snap.created_at);
  const requests = snap.byDepartment.reduce((n, d) => n + d.people.length, 0);
  const items = snap.byItem.length + snap.custom.length;
  const month = { month: monthOf(snap.period_ym), year: snap.period_ym.slice(0, 4) };
  return (
    <section className="pp-sheet pp-appendix" aria-labelledby={titleId}>
      <header className="pp-app__head">
        <div>
          <p className="pp-app__org">{t('reports.print.appendix.org')}</p>
          <p>{t('reports.print.appendix.dept')}</p>
        </div>
        <div className="pp-app__meta">
          <p>{t('reports.print.appendix.preparedAt', { time: at.time, date: at.date, by: snap.created_by.name ?? snap.created_by.sub })}</p>
          <Ordinal snap={snap} />
        </div>
      </header>
      <h2 id={titleId} className="pp-app__title">
        {t('reports.print.appendix.title', month)}
      </h2>
      <p className="pp-app__counts">{t('reports.print.appendix.counts', { requests, items })}</p>
      <Part1Table snap={snap} />
      <IssuesTable issues={snap.issues} />
      <Part2Table departments={snap.byDepartment} />
      <p className="pp-app__foot">{t('reports.print.appendix.footer', { at: `${at.time} ${at.date}` })}</p>
    </section>
  );
}

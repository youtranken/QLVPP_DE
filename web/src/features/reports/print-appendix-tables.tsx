import { useId, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { pickName, type ReportCustomRow, type ReportDepartment, type ReportIssue, type ReportItemRow, type SnapshotData } from './reports.api';
import { orderOf, useFrozenUnitName, vnStampParts } from './print-format';

function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="pp-part" aria-labelledby={id}>
      <h3 id={id} className="pp-h3">
        {title}
      </h3>
      {children}
    </section>
  );
}

const PART1_COLS = ['colName', 'colUnit', 'colRequested', 'colBacklog', 'colStock', 'colNeed', 'colOrder', 'colPeople'] as const;

export function Part1Table({ snap }: { snap: SnapshotData }) {
  const { t, i18n } = useTranslation();
  const unitName = useFrozenUnitName();
  const lang = i18n.language;
  const row = (r: ReportItemRow | ReportCustomRow, n: number, name: string, people: number | null) => (
    <tr key={r.key}>
      <td className="pp-c">{n}</td>
      <td>{name}</td>
      <td>{unitName(r, lang)}</td>
      <td className="pp-r">{r.requested}</td>
      <td className="pp-r">{r.backlog_prev}</td>
      <td className="pp-r">{r.stock ?? '—'}</td>
      <td className="pp-r">{r.need}</td>
      <td className="pp-r">{orderOf(snap, r)}</td>
      <td className="pp-r">{people ?? ''}</td>
    </tr>
  );
  const empty = snap.byItem.length === 0 && snap.custom.length === 0;
  return (
    <PrintSection title={t('reports.part1.title')}>
      <table className="pp-table">
        <thead>
          <tr>
            <th scope="col">{t('reports.print.appendix.colNo')}</th>
            {PART1_COLS.map((c) => (
              <th key={c} scope="col">
                {t(`reports.part1.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty && (
            <tr>
              <td colSpan={PART1_COLS.length + 1} className="pp-empty">
                {t('reports.part1.empty')}
              </td>
            </tr>
          )}
          {snap.byItem.map((r, i) => row(r, i + 1, pickName(lang, r.name, r.name_en), null))}
          {snap.custom.length > 0 && (
            <tr className="pp-group">
              <th scope="row" colSpan={PART1_COLS.length + 1}>
                {t('reports.part1.custom')}
              </th>
            </tr>
          )}
          {snap.custom.map((r, i) => row(r, snap.byItem.length + i + 1, r.name, r.people))}
        </tbody>
      </table>
      <p className="pp-note">{t('reports.print.appendix.formula')}</p>
    </PrintSection>
  );
}

export function IssuesTable({ issues }: { issues: ReportIssue[] }) {
  const { t, i18n } = useTranslation();
  if (issues.length === 0) return null;
  const col = (k: string) => t(`reports.issues.${k}`);
  return (
    <PrintSection title={col('title')}>
      <table className="pp-table">
        <thead>
          <tr>
            <th scope="col">{t('reports.print.appendix.colNo')}</th>
            <th scope="col">{col('colName')}</th>
            <th scope="col">{col('colRecipient')}</th>
            <th scope="col">{col('colQty')}</th>
            <th scope="col">{col('colReason')}</th>
            <th scope="col">{t('reports.print.appendix.colDate')}</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((r, i) => (
            <tr key={`${r.at}-${i}`}>
              <td className="pp-c">{i + 1}</td>
              <td>{pickName(i18n.language, r.item_name, r.item_name_en)}</td>
              <td>{r.recipient_sub ? (r.recipient_name ?? r.recipient_sub) : col('shared')}</td>
              <td className="pp-r">{r.qty}</td>
              <td>{r.reason}</td>
              <td className="pp-c">{vnStampParts(r.at).date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PrintSection>
  );
}

export function Part2Table({ departments }: { departments: ReportDepartment[] }) {
  const { t, i18n } = useTranslation();
  const col = (k: string) => t(`reports.part2.${k}`);
  const people = departments.flatMap((d) => d.people.map((p, i) => ({ dept: d.department, first: i === 0, person: p })));
  return (
    <PrintSection title={col('title')}>
      {people.length === 0 ? (
        <p className="pp-empty">{col('empty')}</p>
      ) : (
        <table className="pp-table">
          <thead>
            <tr>
              <th scope="col">{t('reports.print.appendix.colDepartment')}</th>
              <th scope="col">{col('colPerson')}</th>
              <th scope="col">{col('colLines')}</th>
              <th scope="col">{col('colTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {people.map(({ dept, first, person }) => (
              <tr key={`${dept ?? ''}-${person.user_sub}`} className={first ? 'pp-dept-first' : undefined}>
                <td>{dept ?? col('noDepartment')}</td>
                <td>{person.full_name ?? person.user_sub}</td>
                <td>{person.lines.map((l) => t('reports.part2.line', { name: pickName(i18n.language, l.name, l.name_en), qty: l.qty })).join(' · ')}</td>
                <td className="pp-r">{person.lines.reduce((s, l) => s + l.qty, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PrintSection>
  );
}

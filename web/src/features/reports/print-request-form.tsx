import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { SnapshotData } from './reports.api';
import { orderOf, signBoxesOf, useFrozenUnitName, vnStampParts, type SignBox } from './print-format';

const FORM_LANG = 'vi';
const COLUMNS = ['no', 'code', 'name', 'nameEn', 'unit', 'qty'] as const;
const BILINGUAL = new Set(['no', 'code', 'unit', 'qty']);

interface FormRow {
  key: string;
  code: string;
  name: string;
  nameEn: string;
  unit: string;
  qty: number;
}

function useFormRows(snap: SnapshotData, noCode: string): FormRow[] {
  const unitName = useFrozenUnitName();
  const items = snap.byItem
    .filter((r) => orderOf(snap, r) > 0)
    .map((r) => ({ key: r.key, code: r.code || noCode, name: r.name, nameEn: r.name_en ?? '', unit: unitName(r, FORM_LANG), qty: orderOf(snap, r) }));
  const custom = snap.custom
    .filter((r) => orderOf(snap, r) > 0)
    .map((r) => ({ key: r.key, code: noCode, name: r.name, nameEn: '', unit: unitName(r, FORM_LANG), qty: orderOf(snap, r) }));
  return [...items, ...custom];
}

function ColumnHead({ col }: { col: (typeof COLUMNS)[number] }) {
  const { t } = useTranslation();
  if (!BILINGUAL.has(col)) return <th scope="col">{t(`reports.print.form.col.${col}`)}</th>;
  return (
    <th scope="col">
      <span className="pp-bi">{t(`reports.print.form.col.${col}`)}</span> <span className="pp-bi">{t(`reports.print.form.col.${col}En`)}</span>
    </th>
  );
}

function SignBoxes({ boxes }: { boxes: SignBox[] }) {
  const { t } = useTranslation();
  return (
    <div role="group" aria-label={t('reports.print.form.signGroup')} className="pp-signs">
      {boxes.map((box, i) => (
        <div key={i} role="group" aria-label={box.title} className="pp-sign">
          <b className="pp-sign__title">{box.title}</b>
          {box.title_en && <span className="pp-sign__en">{box.title_en}</span>}
          <span className="pp-sign__space" aria-hidden="true" />
          {box.name ? <span className="pp-sign__name">{box.name}</span> : <span className="pp-sign__name pp-sign__name--blank" data-testid="sign-dots" />}
        </div>
      ))}
    </div>
  );
}

export function PrintRequestForm({ snap }: { snap: SnapshotData }) {
  const { t } = useTranslation();
  const titleId = useId();
  const rows = useFormRows(snap, t('reports.print.form.noCode'));
  const boxes = signBoxesOf(snap, (role) => t(`reports.print.form.oldSigner.${role}`));
  return (
    <section className="pp-sheet pp-form" aria-labelledby={titleId}>
      <header className="pp-form__head">
        <h1 id={titleId} className="pp-form__title">
          {t('reports.print.form.title')}
        </h1>
        <p className="pp-form__sub">{t('reports.print.form.subtitle')}</p>
        <p className="pp-form__date">{t('reports.print.form.date', { date: vnStampParts(snap.created_at).date })}</p>
      </header>
      <table className="pp-table pp-form__table">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <ColumnHead key={c} col={c} />
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="pp-empty">
                {t('reports.print.form.empty')}
              </td>
            </tr>
          )}
          {rows.map((r, i) => (
            <tr key={r.key}>
              <td className="pp-c">{i + 1}</td>
              <td className="pp-c">{r.code}</td>
              <td>{r.name}</td>
              <td>{r.nameEn}</td>
              <td className="pp-c">{r.unit}</td>
              <td className="pp-r">{r.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <SignBoxes boxes={boxes} />
    </section>
  );
}

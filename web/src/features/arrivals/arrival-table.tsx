import { useTranslation } from 'react-i18next';
import type { ArrivalRow, ArrivalSection } from './arrival-rows';
import { showShortColumn } from './arrival-status';
import { ArrivalsGroup, type GroupPick } from './arrivals-group';
import type { ArrivalsDraft } from './use-arrivals-draft';

interface Props {
  sections: ArrivalSection[];
  draft: ArrivalsDraft;
  admBusy: ReadonlySet<string>;
  pickOf: (groupId: string) => GroupPick;
  onToggleAdm: (r: ArrivalRow) => void;
}

const NUMERIC = new Set<string>(['ordered', 'stock', 'short', 'after']);

export function ArrivalTable({ sections, draft, admBusy, pickOf, onToggleAdm }: Props) {
  const { t } = useTranslation();
  const rows = sections.flatMap((s) => s.rows);
  const showShort = showShortColumn(rows, draft.qtyOf);
  const columns = ['item', 'stock', 'ordered', 'qty', ...(showShort ? ['short'] : []), 'status', 'after'];
  return (
    <table className="ar-table grid-table" aria-label={t('arrivals.table.label')}>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c} scope="col" className={NUMERIC.has(c) ? 'n' : undefined}>
              {t(`arrivals.table.${c}`)}
            </th>
          ))}
        </tr>
      </thead>
      {sections.map((s) => (
        <ArrivalsGroup key={s.id} section={s} draft={draft} admBusy={admBusy} showShort={showShort} columns={columns.length} pick={pickOf(s.id)} onToggleAdm={onToggleAdm} />
      ))}
    </table>
  );
}

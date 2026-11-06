import { useTranslation } from 'react-i18next';
import type { ArrivalRow, ArrivalSection } from './arrival-rows';
import { ArrivalsGroup } from './arrivals-group';
import type { ArrivalsDraft } from './use-arrivals-draft';

interface Props {
  sections: ArrivalSection[];
  draft: ArrivalsDraft;
  admBusy: ReadonlySet<string>;
  onToggleAdm: (r: ArrivalRow) => void;
}

const COLUMNS = ['item', 'ordered', 'received', 'stock', 'qty', 'status', 'after'] as const;
const NUMERIC = new Set<string>(['ordered', 'received', 'stock', 'after']);

export function ArrivalTable({ sections, draft, admBusy, onToggleAdm }: Props) {
  const { t } = useTranslation();
  return (
    <table className="ar-table" aria-label={t('arrivals.table.label')}>
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th key={c} scope="col" className={NUMERIC.has(c) ? 'n' : undefined}>
              {t(`arrivals.table.${c}`)}
            </th>
          ))}
        </tr>
      </thead>
      {sections.map((s) => (
        <ArrivalsGroup key={s.id} section={s} draft={draft} admBusy={admBusy} onToggleAdm={onToggleAdm} />
      ))}
    </table>
  );
}

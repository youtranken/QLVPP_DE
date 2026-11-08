import { useTranslation } from 'react-i18next';
import { Toolbar } from '@/ui/toolbar';
import type { PersonRow } from '@/features/summary/summary.api';
import { MONTH_CHIPS, chipCounts, type MonthChip } from './month-chips';
import { useUrlSearchBox } from '@/lib/use-url-search-box';

const MAX_SEARCH = 100;

interface Props {
  rows: PersonRow[];
  chip: MonthChip;
  q: string;
  onChip: (c: MonthChip) => void;
  onQ: (q: string) => void;
}

export function MonthChips({ rows, chip, q, onChip, onQ }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useUrlSearchBox(q, onQ);
  const counts = chipCounts(rows);
  return (
    <Toolbar search={{ value: search, onChange: setSearch, label: t('month.search'), placeholder: t('month.search'), maxLength: MAX_SEARCH }}>
      <div className="flt-chips" role="group" aria-label={t('month.chips.label')}>
        {MONTH_CHIPS.map((c) => (
          <button key={c} type="button" className="flt-chip" aria-pressed={chip === c} onClick={() => onChip(c)}>
            {t(`month.chips.${c}`)}
            <span className="flt-cnt num">{counts[c]}</span>
          </button>
        ))}
      </div>
    </Toolbar>
  );
}

import { useTranslation } from 'react-i18next';
import type { StockFilter, stockStats } from './stock-rows';

interface Props {
  stats: ReturnType<typeof stockStats>;
  filter: StockFilter | null;
  onFilter: (f: StockFilter) => void;
  onClear: () => void;
}

const FILTERS: StockFilter[] = ['incoming', 'low', 'none'];

// Một hàng chip lọc có số: Tất cả · Chờ hàng về · Sắp hết · Không có
export function StockFilterTabs({ stats, filter, onFilter, onClear }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flt-chips" role="group" aria-label={t('stock.stats.label')}>
      <button type="button" className="flt-chip" aria-pressed={filter === null} onClick={onClear}>
        {t('stock.stats.all')}
        <span className="flt-cnt num">{stats.all}</span>
      </button>
      {FILTERS.map((f) => (
        <button key={f} type="button" className="flt-chip" aria-pressed={filter === f} onClick={() => onFilter(f)}>
          {t(`stock.stats.${f}`)}
          <span className="flt-cnt num">{stats[f]}</span>
        </button>
      ))}
    </div>
  );
}

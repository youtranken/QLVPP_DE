import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { StockFilter, stockStats } from './stock-rows';

interface Props {
  stats: ReturnType<typeof stockStats>;
  filter: StockFilter | null;
  narrowed: boolean;
  onFilter: (f: StockFilter) => void;
  onClear: () => void;
}

export function StockStats({ stats, filter, narrowed, onFilter, onClear }: Props) {
  const { t } = useTranslation();
  const items = t('stock.stats.items');
  return (
    <StatRow>
      <StatCard label={t('stock.stats.tracked')} icon="layers" value={stats.tracked} unit={items} pressed={!narrowed} onClick={onClear} />
      <StatCard label={t('stock.stats.low')} icon="warehouse" value={stats.low} unit={items} tone={stats.low > 0 ? 'warn' : 'neutral'} pressed={filter === 'low'} onClick={() => onFilter('low')} />
      <StatCard label={t('stock.stats.out')} icon="alert" value={stats.out} unit={items} tone={stats.out > 0 ? 'danger' : 'neutral'} pressed={filter === 'out'} onClick={() => onFilter('out')} />
      <StatCard label={t('stock.stats.owed')} icon="receipt" value={stats.owedQty > 0 ? stats.owedQty : t('common.empty')} unit={stats.owedQty > 0 ? t('stock.stats.units') : undefined} sub={stats.owedQty > 0 ? t('stock.stats.owedItems', { items: stats.owedItems }) : undefined} />
    </StatRow>
  );
}

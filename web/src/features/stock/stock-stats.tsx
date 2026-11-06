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

// Đỏ chỉ khi có người đang chờ mà thiếu; "Không có" không tô
export function StockStats({ stats, filter, narrowed, onFilter, onClear }: Props) {
  const { t } = useTranslation();
  const items = t('stock.stats.items');
  const card = (f: StockFilter, icon: 'alert' | 'pkg' | 'warehouse' | 'layers', tone: 'danger' | 'warn' | 'neutral') => (
    <StatCard key={f} label={t(`stock.stats.${f}`)} icon={icon} value={stats[f]} unit={items} tone={stats[f] > 0 ? tone : 'neutral'} pressed={filter === f} onClick={() => onFilter(f)} />
  );
  return (
    <StatRow>
      <StatCard label={t('stock.stats.all')} icon="layers" value={stats.all} unit={items} pressed={!narrowed} onClick={onClear} />
      {card('short', 'alert', 'danger')}
      {card('incoming', 'pkg', 'neutral')}
      {card('low', 'warehouse', 'warn')}
      {card('none', 'layers', 'neutral')}
    </StatRow>
  );
}

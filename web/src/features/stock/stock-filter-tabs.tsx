import { useTranslation } from 'react-i18next';
import type { StockFilter, stockStats } from './stock-rows';
import { Segmented } from '@/ui/segmented';

interface Props {
  stats: ReturnType<typeof stockStats>;
  filter: StockFilter | null;
  onFilter: (f: StockFilter) => void;
  onClear: () => void;
}

const FILTERS: StockFilter[] = ['incoming', 'low', 'none'];
const ALL = 'all';

export function StockFilterTabs({ stats, filter, onFilter, onClear }: Props) {
  const { t } = useTranslation();
  return (
    <Segmented
      label={t('stock.stats.label')}
      value={filter ?? ALL}
      options={[
        { value: ALL, label: t('stock.stats.all'), count: stats.all },
        ...FILTERS.map((f) => ({ value: f, label: t(`stock.stats.${f}`), count: stats[f] })),
      ]}
      onChange={(v) => (v === ALL ? onClear() : onFilter(v))}
    />
  );
}

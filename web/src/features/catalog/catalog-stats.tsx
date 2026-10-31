import { useTranslation } from 'react-i18next';
import { StatCard } from '@/ui/stat-card';
import { StatRow } from '@/ui/stat-row';
import type { CatalogFilter, catalogStats } from './catalog-rows';

interface Props {
  stats: ReturnType<typeof catalogStats>;
  filter: CatalogFilter | null;
  onFilter: (f: CatalogFilter) => void;
  onClear: () => void;
}

export function CatalogStats({ stats, filter, onFilter, onClear }: Props) {
  const { t } = useTranslation();
  const items = t('catalog.stats.items');
  return (
    <StatRow>
      <StatCard label={t('catalog.stats.active')} icon="layers" value={stats.active} unit={items} sub={t('catalog.stats.groups', { k: stats.groups })} pressed={filter === null} onClick={onClear} />
      <StatCard label={t('catalog.stats.low')} icon="warehouse" value={stats.low} unit={items} tone={stats.low > 0 ? 'warn' : 'neutral'} pressed={filter === 'low'} onClick={() => onFilter('low')} />
      <StatCard label={t('catalog.stats.out')} icon="alert" value={stats.out} unit={items} tone={stats.out > 0 ? 'danger' : 'neutral'} pressed={filter === 'out'} onClick={() => onFilter('out')} />
      <StatCard label={t('catalog.stats.noImage')} icon="image" value={stats.noImage} unit={items} sub={t('catalog.stats.noImageHint')} tone={stats.noImage > 0 ? 'warn' : 'neutral'} pressed={filter === 'noimage'} onClick={() => onFilter('noimage')} />
    </StatRow>
  );
}

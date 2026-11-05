import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/ui/load-state';
import { Skeleton } from '@/ui/skeleton';
import { categoryLabel } from './catalog.api';
import { CatalogCard } from './catalog-card';
import type { CatalogRow, CategoryIndex } from './catalog-rows';

const CARDS = { shape: 'card', count: 8 } as const;

interface Props {
  rows: CatalogRow[];
  index: CategoryIndex;
  loading: boolean;
  onEdit: (id: string) => void;
  emptyAction: ReactNode;
}

export function CatalogGrid({ rows, index, loading, onEdit, emptyAction }: Props) {
  const { t, i18n } = useTranslation();
  if (loading) return <Skeleton {...CARDS} />;
  if (rows.length === 0) return <EmptyState art="no-match" title={t('catalog.list.emptyTitle')} hint={t('catalog.list.emptyHint')} action={emptyAction} />;
  const groupName = (key: string) => {
    const cat = index.byId.get(key);
    return cat ? categoryLabel(cat, i18n.language) : t('catalog.page.noCategory');
  };
  return (
    <div className="ct-grid">
      {rows.map((r) => (
        <CatalogCard key={r.id} row={r} groupName={groupName(r.group)} onEdit={onEdit} />
      ))}
    </div>
  );
}

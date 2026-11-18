import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { EmptyState } from '@/ui/load-state';
import { Skeleton } from '@/ui/skeleton';
import { categoryLabel, type Category } from './catalog.api';
import { CatalogCard } from './catalog-card';
import { StoppedGroupRow } from './stopped-group-row';
import type { CatalogTab } from './catalog-tabs';
import type { CatalogRow, CategoryIndex } from './catalog-rows';

const CARDS = { shape: 'card', count: 8 } as const;

interface Props {
  rows: CatalogRow[];
  index: CategoryIndex;
  loading: boolean;
  openId?: string | null;
  onEdit: (id: string) => void;
  emptyAction: ReactNode;
  tab: CatalogTab;
  narrowed: boolean;
  groupBusy: boolean;
  onReactivateGroup: (category: Category) => void;
}

function sectionsOf(rows: CatalogRow[]) {
  const map = new Map<string, CatalogRow[]>();
  for (const r of rows) map.set(r.group, [...(map.get(r.group) ?? []), r]);
  return [...map.entries()];
}

export function CatalogGrid({ rows, index, loading, openId, onEdit, emptyAction, tab, narrowed, groupBusy, onReactivateGroup }: Props) {
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  if (loading) return <Skeleton {...CARDS} />;
  if (rows.length === 0 && !narrowed && tab !== 'all') return <EmptyState art="no-match" title={t(`catalog.grid.empty.${tab}`)} />;
  if (rows.length === 0) return <EmptyState art="no-match" title={t('catalog.list.emptyTitle')} hint={t('catalog.list.emptyHint')} action={emptyAction} />;
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <div className="ct-sections">
      {sectionsOf(rows).map(([key, list]) => {
        const cat = index.byId.get(key);
        const name = cat ? categoryLabel(cat, i18n.language) : t('catalog.page.noCategory');
        const stopped = cat?.active === false;
        const open = !stopped || narrowed || expanded.has(key);
        const paused = list.filter((r) => !r.usable).length;
        return (
          <section key={key} className="ct-section" aria-label={name}>
            {stopped && cat ? (
              <StoppedGroupRow name={name} count={list.length} expanded={open} busy={groupBusy} onToggle={() => toggle(key)} onReactivate={() => onReactivateGroup(cat)} />
            ) : (
              <div className="ct-section__head">
                <h2 className="ct-section__title">{name}</h2>
                <span className="ct-section__meta">{paused > 0 ? t('catalog.grid.groupHead', { n: list.length, k: paused }) : t('catalog.grid.groupCount', { n: list.length })}</span>
              </div>
            )}
            {open && (
              <div className="ct-grid">
                {list.map((r) => (
                  <CatalogCard key={r.id} row={r} groupName={name} open={r.id === openId} onEdit={onEdit} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

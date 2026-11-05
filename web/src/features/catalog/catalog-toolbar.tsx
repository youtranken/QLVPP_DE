import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BulkBar } from '@/ui/bulk-bar';
import { Switch } from '@/ui/switch';
import { Toolbar } from '@/ui/toolbar';

const MAX_SEARCH = 100;

interface Props {
  search: string;
  onSearch: (v: string) => void;
  searchable: number;
  inactiveCount: number;
  showInactive: boolean;
  onToggleInactive: () => void;
  allCollapsed: boolean;
  onToggleCollapse: () => void;
  viewSwitch: ReactNode;
  bulk: { count: number; pending: boolean; onMax: () => void; onMove: () => void; onDeactivate: () => void; onClear: () => void };
}

export function CatalogToolbar({ search, onSearch, searchable, inactiveCount, showInactive, onToggleInactive, allCollapsed, onToggleCollapse, viewSwitch, bulk }: Props) {
  const { t } = useTranslation();
  if (bulk.count > 0) {
    return (
      <BulkBar count={bulk.count} label={t('catalog.stats.items')} onClear={bulk.onClear}>
        <button type="button" disabled={bulk.pending} onClick={bulk.onMax}>
          {t('catalog.bulk.max')}
        </button>
        <button type="button" disabled={bulk.pending} onClick={bulk.onMove}>
          {t('catalog.bulk.move')}
        </button>
        <button type="button" disabled={bulk.pending} onClick={bulk.onDeactivate}>
          {t('catalog.bulk.deactivate')}
        </button>
      </BulkBar>
    );
  }
  const label = t('catalog.list.search', { n: searchable });
  return (
    <Toolbar search={{ value: search, onChange: onSearch, label, placeholder: label, maxLength: MAX_SEARCH }}>
      <Switch checked={showInactive} text={t('catalog.list.showInactive', { n: inactiveCount })} onChange={onToggleInactive} />
      <button type="button" className="btn btn--ghost btn--sm" onClick={onToggleCollapse}>
        {t(allCollapsed ? 'catalog.list.expandAll' : 'catalog.list.collapseAll')}
      </button>
      {viewSwitch}
    </Toolbar>
  );
}

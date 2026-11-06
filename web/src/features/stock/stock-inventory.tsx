import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { Toolbar } from '@/ui/toolbar';
import { categoryLabel } from '@/features/catalog/catalog.api';
import { CountStockDialog } from './count-stock-dialog';
import { IssueDialog } from './issue-dialog';
import { MovementsDrawer } from './movements-drawer';
import { PurchaseDialog } from './purchase-dialog';
import { StockMore } from './stock-more';
import { StockStats } from './stock-stats';
import { StockTable, type StockAction } from './stock-table';
import { applyStockView, stockStats, type StockFilter, type StockRow } from './stock-rows';
import { useStockData } from './use-stock-data';
import { useShownLimit } from './use-shown-limit';
import type { StockParams } from './use-stock-params';

const MAX_SEARCH = 100;

interface Open {
  action: StockAction;
  id: string;
}

const EMPTY_KEY: Record<StockFilter, string> = { short: 'emptyShort', incoming: 'emptyIncoming', low: 'emptyLow', none: 'emptyNone' };

export function StockInventory({ p }: { p: StockParams }) {
  const { t, i18n } = useTranslation();
  const d = useStockData();
  const [search, setSearch] = useUrlSearchBox(p.view.q, p.setQ);
  const [open, setOpen] = useState<Open | null>(null);
  const onAction = useCallback((action: StockAction, r: StockRow) => setOpen({ action, id: r.id }), []);
  const groupName = useCallback(
    (r: StockRow) => {
      const cat = d.index.byId.get(r.group);
      return cat ? categoryLabel(cat, i18n.language) : t('stock.page.noCategory');
    },
    [d.index, i18n.language, t],
  );
  const { filter } = p.view;
  const shown = applyStockView(d.rows, p.view);
  const page = useShownLimit(shown, `${filter ?? ''}|${p.view.q}`);
  if (d.failed) {
    return <LoadError onRetry={d.retry} />;
  }

  const target = open ? d.rows.find((r) => r.id === open.id) : undefined;
  const close = () => setOpen(null);
  const emptyKey = filter ? EMPTY_KEY[filter] : 'emptyTitle';
  return (
    <>
      {d.loaded && <StockStats stats={stockStats(d.rows)} filter={filter} narrowed={filter !== null || p.view.q !== ''} onFilter={p.toggleFilter} onClear={p.clearAll} />}
      <Toolbar search={{ value: search, onChange: setSearch, label: t('stock.page.search'), placeholder: t('stock.page.search'), maxLength: MAX_SEARCH }} />
      {filter && <FilterNotice label={t(`stock.stats.${filter}`)} count={shown.length} onClear={p.clearFilter} />}
      <StockTable
        rows={page.visible}
        loading={!d.loaded}
        activeRowId={open?.action === 'ledger' ? open.id : undefined}
        groupName={groupName}
        onAction={onAction}
        empty={{
          title: t(`stock.page.${emptyKey}`),
          hint: filter ? undefined : t('stock.page.emptyHint'),
          action: (
            <button type="button" className="btn" onClick={p.clearAll}>
              {t('stock.page.showAll')}
            </button>
          ),
        }}
      />
      <StockMore shown={page.visible.length} total={page.total} hidden={page.hidden} onMore={page.showMore} />
      {target && open?.action === 'purchase' && <PurchaseDialog item={target} onClose={close} />}
      {target && open?.action === 'count' && <CountStockDialog item={target} onClose={close} />}
      {target && open?.action === 'issue' && <IssueDialog item={target} onClose={close} />}
      {target && open?.action === 'ledger' && (
        <MovementsDrawer item={target} groupName={groupName(target)} onAction={(action) => setOpen({ action, id: target.id })} onClose={close} />
      )}
    </>
  );
}

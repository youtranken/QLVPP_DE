import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Toolbar } from '@/ui/toolbar';
import { categoryLabel, useAdminItems, useAllCategories } from '@/features/catalog/catalog.api';
import { indexCategories, toRows } from '@/features/catalog/catalog-rows';
import { useBacklog } from '@/features/delivery/backlog.api';
import { CountStockDialog } from './count-stock-dialog';
import { IssueDialog } from './issue-dialog';
import { MovementsDrawer } from './movements-drawer';
import { PurchaseDialog } from './purchase-dialog';
import { StockMore } from './stock-more';
import { StockStats } from './stock-stats';
import { StockTable, type StockAction } from './stock-table';
import { applyStockView, owedByItem, stockStats, toStockRows, type StockRow } from './stock-rows';
import { useShownLimit } from './use-shown-limit';
import { useStockParams } from './use-stock-params';
import './stock.m1.css';

const MAX_SEARCH = 100;

interface Open {
  action: StockAction;
  id: string;
}

function useStockData() {
  const items = useAdminItems();
  const categories = useAllCategories();
  const backlog = useBacklog('item');
  const index = useMemo(() => indexCategories(categories.data ?? []), [categories.data]);
  const rows = useMemo(
    () => toStockRows(toRows(items.data ?? [], index), owedByItem(backlog.data?.groups ?? [])),
    [items.data, index, backlog.data],
  );
  const loaded = items.isSuccess && categories.isSuccess && backlog.isSuccess;
  const failed = items.isError || categories.isError || backlog.isError;
  const retry = () => {
    void items.refetch();
    void categories.refetch();
    void backlog.refetch();
  };
  return { index, rows, loaded, failed, retry };
}

export function StockPage() {
  const { t, i18n } = useTranslation();
  const p = useStockParams();
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
  const title = t('stock.title');
  const header = (
    <PageHeader
      crumbs={[t('nav.groups.stock'), title]}
      title={title}
      description={t('stock.page.description')}
      secondary={
        <Link className="btn" to="/admin/catalog">
          {t('stock.page.catalogLink')}
        </Link>
      }
    />
  );
  if (d.failed) {
    return (
      <div className="ct-page sk-page">
        {header}
        <LoadError onRetry={d.retry} />
      </div>
    );
  }

  const target = open ? d.rows.find((r) => r.id === open.id) : undefined;
  const close = () => setOpen(null);
  const emptyKey = filter === 'low' ? 'emptyLow' : filter === 'out' ? 'emptyOut' : 'emptyTitle';
  return (
    <div className="ct-page sk-page">
      {header}
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
    </div>
  );
}

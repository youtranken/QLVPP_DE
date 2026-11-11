import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePanelParam } from '@/lib/use-panel-param';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { FilterNotice } from '@/ui/filter-notice';
import { LoadError } from '@/ui/load-state';
import { Toolbar } from '@/ui/toolbar';
import { categoryLabel } from '@/features/catalog/catalog.api';
import { IssueDialog } from './issue-dialog';
import { MovementsDrawer } from './movements-drawer';
import { PurchaseDialog } from './purchase-dialog';
import { StockMore } from './stock-more';
import { StockFilterTabs } from './stock-filter-tabs';
import { StockTable, type StockAction } from './stock-table';
import { applyStockView, stockStats, type StockFilter, type StockRow } from './stock-rows';
import { useStockData } from './use-stock-data';
import { useShownLimit } from './use-shown-limit';
import type { StockParams } from './use-stock-params';

const MAX_SEARCH = 100;

type DialogAction = Exclude<StockAction, 'ledger'>;

interface Open {
  action: DialogAction;
  id: string;
}

const EMPTY_KEY: Record<StockFilter, string> = { incoming: 'emptyIncoming', low: 'emptyLow', none: 'emptyNone' };

export function StockInventory({ p, end }: { p: StockParams; end?: ReactNode }) {
  const { t, i18n } = useTranslation();
  const d = useStockData();
  const [search, setSearch] = useUrlSearchBox(p.view.q, p.setQ);
  const [open, setOpen] = useState<Open | null>(null);
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
  // Lịch sử nhập xuất là panel phủ ?item=; Nhập/Xuất lẻ từ chân panel mở hộp trên panel, panel giữ nguyên
  const ledger = usePanelParam('item', { order: shown.map((r) => r.id), known: (id) => (d.loaded ? d.rows.some((r) => r.id === id) : undefined) });
  const { open: openLedger } = ledger;
  const onAction = useCallback((action: StockAction, r: StockRow) => (action === 'ledger' ? openLedger(r.id) : setOpen({ action, id: r.id })), [openLedger]);
  // Tải tồn lỗi vẫn giữ bộ chuyển Tồn kho/Xuất lẻ để sang tab kia được
  if (d.failed) {
    return (
      <>
        {end && <div className="toolbar">{end}</div>}
        <LoadError onRetry={d.retry} />
      </>
    );
  }

  const target = open ? d.rows.find((r) => r.id === open.id) : undefined;
  const ledgerItem = ledger.id ? d.rows.find((r) => r.id === ledger.id) : undefined;
  const close = () => setOpen(null);
  const emptyKey = filter ? EMPTY_KEY[filter] : 'emptyTitle';
  return (
    <>
      <Toolbar search={{ value: search, onChange: setSearch, label: t('stock.page.search'), placeholder: t('stock.page.search'), maxLength: MAX_SEARCH }}>
        {end}
        {d.loaded && <StockFilterTabs stats={stockStats(d.rows)} filter={filter} onFilter={p.toggleFilter} onClear={p.clearFilter} />}
      </Toolbar>
      {filter && <FilterNotice label={t(`stock.stats.${filter}`)} count={shown.length} onClear={p.clearFilter} />}
      <StockTable
        rows={page.visible}
        loading={!d.loaded}
        activeRowId={ledgerItem?.id}
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
      {ledgerItem && (
        <MovementsDrawer
          item={ledgerItem}
          groupName={groupName(ledgerItem)}
          onAction={(action) => action !== 'ledger' && setOpen({ action, id: ledgerItem.id })}
          onClose={ledger.close}
          nav={{ index: ledger.index, total: ledger.total, onStep: ledger.step }}
        />
      )}
      {target && open?.action === 'purchase' && <PurchaseDialog item={target} onClose={close} />}
      {target && open?.action === 'issue' && <IssueDialog item={target} onClose={close} />}
    </>
  );
}

import { useCallback, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataTable } from '@/ui/data-table';
import { LoadError } from '@/ui/load-state';
import { useAdminItems, type AdminItem } from '@/features/catalog/catalog.api';
import { useLowStock } from '@/features/stock/stock.api';
import { useStockColumns, type StockAction } from '@/features/stock/stock-columns';
import { IssueDialog, StockChangeDialog } from '@/features/stock/stock-dialogs';
import { MovementsDrawer } from '@/features/stock/movements-drawer';
import '@/features/catalog/catalog.css';
import '@/features/stock/stock.css';

interface Open {
  action: StockAction;
  item: AdminItem;
}

export function StockPage() {
  const { t } = useTranslation();
  const items = useAdminItems();
  const low = useLowStock();
  const [params] = useSearchParams();
  // KPI "Món sắp hết" ở Tổng hợp kỳ mở /admin/stock?filter=low
  const [onlyLow, setOnlyLow] = useState(params.get('filter') === 'low');
  const [open, setOpen] = useState<Open | null>(null);
  const onAction = useCallback((action: StockAction, item: AdminItem) => setOpen({ action, item }), []);
  const columns = useStockColumns(onAction);
  const close = () => setOpen(null);

  if (items.isError || low.isError) {
    return (
      <LoadError
        onRetry={() => {
          void items.refetch();
          void low.refetch();
        }}
      />
    );
  }

  // Kho chỉ quản món đang dùng; "Sắp hết" lấy từ server để khớp KPI và cảnh báo
  const rows = onlyLow ? (low.data ?? []) : (items.data ?? []).filter((i) => i.active);

  return (
    <div className="a-stack">
      <div className="a-toolbar">
        <button type="button" className="btn filter-btn" aria-pressed={onlyLow} onClick={() => setOnlyLow((v) => !v)}>
          {t('stock.page.lowFilter')}
          <span className="count">{low.data?.length ?? 0}</span>
        </button>
      </div>
      <section className="a-panel">
        <DataTable
          data={rows}
          columns={columns}
          loading={items.isPending || low.isPending}
          emptyText={t(onlyLow ? 'stock.page.emptyLow' : 'stock.page.empty')}
          searchPlaceholder={t('stock.page.search')}
          stackOnMobile
        />
      </section>
      {open?.action === 'purchase' && <StockChangeDialog item={open.item} mode="purchase" onClose={close} />}
      {open?.action === 'adjust' && <StockChangeDialog item={open.item} mode="adjust" onClose={close} />}
      {open?.action === 'issue' && <IssueDialog item={open.item} onClose={close} />}
      {open?.action === 'ledger' && <MovementsDrawer item={open.item} onClose={close} />}
    </div>
  );
}

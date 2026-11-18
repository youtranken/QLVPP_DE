import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { useUrlPatch } from '@/lib/use-url-patch';
import { StockLedgerPage } from './stock-ledger-page';
import { StockInventory } from './stock-inventory';
import { useStockParams } from './use-stock-params';
import './stock.m1.css';

const TAB_STOCK = 'stock';
const TAB_LEDGER = 'ledger';

export function StockPage() {
  const { t } = useTranslation();
  const p = useStockParams();
  const [params] = useSearchParams();
  const [, update] = useUrlPatch();
  const ledger = params.get('tab') === TAB_LEDGER;
  // Xuất lẻ thành trang riêng: link cũ ?tab=issues chuyển sang, giữ tháng
  if (params.get('tab') === 'issues') {
    const ym = params.get('ym');
    return <Navigate replace to={ym ? `/admin/issues?ym=${encodeURIComponent(ym)}` : '/admin/issues'} />;
  }
  const title = t('stock.page.title');
  return (
    <div className="ct-page sk-page">
      <PageHeader
        crumbs={[t('nav.groups.stock'), title]}
        title={title}
        description={t('stock.page.description')}
      />
      {/* Trong tủ / Lịch sử nhập xuất (sổ cái toàn kho) */}
      <Segmented
        label={t('stock.book.tabs')}
        value={ledger ? TAB_LEDGER : TAB_STOCK}
        options={[
          { value: TAB_STOCK, label: t('stock.book.tabStock') },
          { value: TAB_LEDGER, label: t('stock.book.tabLedger') },
        ]}
        onChange={(v) => update(v === TAB_LEDGER ? { tab: TAB_LEDGER } : { tab: null, ym: null, kind: null })}
      />
      {ledger ? <StockLedgerPage /> : <StockInventory p={p} />}
    </div>
  );
}

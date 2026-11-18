import { Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { useUrlPatch } from '@/lib/use-url-patch';
import { StockLedgerPage } from './stock-ledger-page';
import { IssueOneButton } from './issue-one-button';
import { StockInventory } from './stock-inventory';
import { useStockParams } from './use-stock-params';
import './stock.m1.css';

const TAB_STOCK = 'stock';
const TAB_HISTORY = 'history';
// Link cũ: ?tab=ledger (tab Lịch sử trước 18/11), ?tab=issues (tab Xuất lẻ trước G6)
const OLD_LEDGER = 'ledger';
const OLD_ISSUES = 'issues';

export function StockPage() {
  const { t } = useTranslation();
  const p = useStockParams();
  const [params] = useSearchParams();
  const [, update] = useUrlPatch();
  const tab = params.get('tab');
  const ledger = tab === TAB_HISTORY || tab === OLD_LEDGER;
  if (tab === OLD_ISSUES) {
    const ym = params.get('ym');
    const search = new URLSearchParams({ tab: TAB_HISTORY, kind: 'issue', ...(ym ? { ym } : {}) });
    return <Navigate replace to={`/admin/stock?${search}`} />;
  }
  const title = t('stock.page.title');
  return (
    <div className="ct-page sk-page">
      <PageHeader
        crumbs={[t('nav.groups.stock'), title]}
        title={title}
        description={t('stock.page.description')}
        primary={<IssueOneButton />}
      />
      {/* Trong tủ / Lịch sử nhập xuất (sổ cái toàn kho) */}
      <Segmented
        label={t('stock.book.tabs')}
        value={ledger ? TAB_HISTORY : TAB_STOCK}
        options={[
          { value: TAB_STOCK, label: t('stock.book.tabStock') },
          { value: TAB_HISTORY, label: t('stock.book.tabLedger') },
        ]}
        onChange={(v) => update(v === TAB_HISTORY ? { tab: TAB_HISTORY } : { tab: null, ym: null, kind: null })}
      />
      {ledger ? <StockLedgerPage /> : <StockInventory p={p} />}
    </div>
  );
}

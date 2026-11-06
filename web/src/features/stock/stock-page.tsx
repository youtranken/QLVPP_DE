import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { vnYmNow } from '@/lib/ym';
import { IssueOneButton } from './issue-one-button';
import { IssuesPanel } from './issues-panel';
import { StockInventory } from './stock-inventory';
import { useStockParams, type StockTab } from './use-stock-params';
import './stock.m1.css';

export function StockPage() {
  const { t } = useTranslation();
  const p = useStockParams();
  const title = t('stock.page.title');
  const tabs: { value: StockTab; label: string }[] = [
    { value: 'stock', label: t('stock.issues.tabStock') },
    { value: 'issues', label: t('stock.issues.tabIssues') },
  ];
  return (
    <div className="ct-page sk-page">
      <PageHeader
        crumbs={[t('nav.groups.stock'), title]}
        title={title}
        description={t('stock.page.description')}
        secondary={
          <>
            <Link className="btn btn--ghost" to="/admin/arrivals">
              {t('stock.page.toArrivals')}
            </Link>
            <Link className="btn" to="/admin/catalog">
              {t('stock.page.catalogLink')}
            </Link>
          </>
        }
      />
      <div className="sk-issues__head">
        <Segmented label={t('stock.issues.tabs')} value={p.tab} options={tabs} onChange={p.setTab} />
        {p.tab === 'issues' && <IssueOneButton />}
      </div>
      {p.tab === 'issues' ? <IssuesPanel ym={p.ym ?? vnYmNow()} onYmChange={p.setYm} /> : <StockInventory p={p} />}
    </div>
  );
}

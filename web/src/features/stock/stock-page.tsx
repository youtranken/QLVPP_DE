import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LoadError, Loading } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { currentPeriodQuery } from '@/features/request/request.api';
import { IssuesPanel } from './issues-panel';
import { StockInventory } from './stock-inventory';
import { useStockParams, type StockTab } from './use-stock-params';
import './stock.m1.css';

function IssuesTab({ ym, onYmChange }: { ym: string | undefined; onYmChange: (ym: string) => void }) {
  const current = useQuery({ ...currentPeriodQuery(), enabled: !ym });
  const shown = ym ?? current.data?.ym;
  if (!shown) return current.isError ? <LoadError onRetry={() => void current.refetch()} /> : <Loading />;
  return <IssuesPanel ym={shown} onYmChange={onYmChange} />;
}

export function StockPage() {
  const { t } = useTranslation();
  const p = useStockParams();
  const title = t('stock.title');
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
          <Link className="btn" to="/admin/catalog">
            {t('stock.page.catalogLink')}
          </Link>
        }
      />
      <Segmented label={t('stock.issues.tabs')} value={p.tab} options={tabs} onChange={p.setTab} />
      {p.tab === 'issues' ? <IssuesTab ym={p.ym} onYmChange={p.setYm} /> : <StockInventory p={p} />}
    </div>
  );
}

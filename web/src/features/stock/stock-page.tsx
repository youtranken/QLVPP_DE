import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import { Segmented } from '@/ui/segmented';
import { vnYmNow } from '@/lib/ym';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { IssueOneButton } from './issue-one-button';
import { IssuesPanel } from './issues-panel';
import { StockInventory } from './stock-inventory';
import { useStockParams, type StockTab } from './use-stock-params';
import './stock.m1.css';

export function StockPage() {
  const { t } = useTranslation();
  const p = useStockParams();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const title = t('stock.page.title');
  const tabs: { value: StockTab; label: string }[] = [
    { value: 'stock', label: t('stock.issues.tabStock') },
    { value: 'issues', label: t('stock.issues.tabIssues') },
  ];
  const switcher = <Segmented label={t('stock.issues.tabs')} value={p.tab} options={tabs} onChange={p.setTab} />;
  const issueOne = p.tab === 'issues' && <IssueOneButton />;
  // Máy tính: chế độ xem nằm cuối hàng ô tìm/bộ chọn tháng; điện thoại: hàng riêng để ô tìm đủ rộng
  const end = phone ? undefined : (
    <div className="toolbar__end">
      {issueOne}
      {switcher}
    </div>
  );
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
      {phone && (
        <div className="sk-issues__head">
          {switcher}
          {issueOne}
        </div>
      )}
      {p.tab === 'issues' ? <IssuesPanel ym={p.ym ?? vnYmNow()} onYmChange={p.setYm} end={end} /> : <StockInventory p={p} end={end} />}
    </div>
  );
}

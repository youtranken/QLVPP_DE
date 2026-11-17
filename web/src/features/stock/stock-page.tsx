import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/ui/page-header';
import { StockInventory } from './stock-inventory';
import { useStockParams } from './use-stock-params';
import './stock.m1.css';

export function StockPage() {
  const { t } = useTranslation();
  const p = useStockParams();
  const [params] = useSearchParams();
  // Xuất lẻ thành trang riêng (G6): link cũ ?tab=issues chuyển sang, giữ tháng
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
        secondary={
          <Link className="btn" to="/admin/catalog">
            {t('stock.page.catalogLink')}
          </Link>
        }
      />
      <StockInventory p={p} />
    </div>
  );
}

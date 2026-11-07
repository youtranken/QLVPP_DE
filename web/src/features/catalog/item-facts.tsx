import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUnitName } from '@/features/units/units.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useItemRows } from '@/features/summary/summary.api';
import { lockedYm } from '@/lib/ym';
import type { AdminItem } from './catalog.api';

export function ItemFacts({ item }: { item: AdminItem }) {
  const { t } = useTranslation();
  const unit = useUnitName(item.unit);
  const period = useCurrentPeriod();
  // Số người đăng ký lấy ở kỳ đã khóa gần nhất: danh sách theo món của kỳ đang mở trả 409
  const ym = period.data && lockedYm(period.data.ym);
  const rows = useItemRows(ym);
  const people = rows.data ? (rows.data.items.find((r) => r.item_id === item.id)?.people ?? 0) : null;
  return (
    <p className="ct-facts">
      <span>{t('catalog.drawer.stock', { n: item.stock_qty, unit })}</span>
      {ym && people !== null && <span>{t('catalog.drawer.registered', { month: monthOf(ym), people })}</span>}
      <Link className="ct-facts__link" to={`/admin/stock?q=${encodeURIComponent(item.name)}`}>
        {t('catalog.drawer.openStock')}
      </Link>
    </p>
  );
}

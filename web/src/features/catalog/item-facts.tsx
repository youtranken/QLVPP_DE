import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useUnitName } from '@/features/units/units.api';
import { useCurrentPeriod } from '@/features/request/request.api';
import { monthOf } from '@/features/request/request-format';
import { useItemRows } from '@/features/summary/summary.api';
import type { AdminItem } from './catalog.api';

export function ItemFacts({ item }: { item: AdminItem }) {
  const { t } = useTranslation();
  const unit = useUnitName(item.unit);
  const period = useCurrentPeriod();
  const ym = period.data?.ym;
  const rows = useItemRows(ym);
  const people = rows.data ? (rows.data.items.find((r) => r.item_id === item.id)?.people ?? 0) : null;
  return (
    <section className="ct-facts">
      <p className="ct-facts__row">
        <span>{t('catalog.drawer.stock', { n: item.stock_qty, unit })}</span>
        <Link className="btn btn--ghost btn--sm" to={`/admin/stock?q=${encodeURIComponent(item.name)}`}>
          {t('catalog.drawer.openStock')}
        </Link>
      </p>
      {ym && people !== null && <p className="ct-facts__row">{t('catalog.drawer.registered', { month: monthOf(ym), people })}</p>}
    </section>
  );
}

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function WhoRegistered({ ym, itemKey, people }: { ym: string; itemKey: string; people: number | undefined }) {
  const { t } = useTranslation();
  if (!people) return null;
  const to = `/admin/summary?${new URLSearchParams({ ym, view: 'item', item: itemKey })}`;
  return (
    <Link className="sa-who" to={to}>
      {t('sendAdm.orders.who', { count: people })}
    </Link>
  );
}

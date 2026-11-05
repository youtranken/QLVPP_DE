import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { monthOf, useRequestFormat } from '@/features/request/request-format';
import { useUnregisteredCopy } from '@/features/summary/use-unregistered-copy';
import type { UnregisteredUser } from '@/features/summary/summary.api';
import type { AdminItem } from '@/features/catalog/catalog.api';

const MAX_CHIPS = 8;
const MAX_LOW = 3;
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map((w) => w[0]?.toUpperCase() ?? '').join('');

interface UnregisteredProps {
  ym: string;
  deadline: string | null;
  count: number;
  people: UnregisteredUser[];
}

export function UnregisteredCard({ ym, deadline, count, people }: UnregisteredProps) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const copy = useUnregisteredCopy(ym, deadline);
  const shown = people.slice(0, MAX_CHIPS);
  const more = count - shown.length;
  return (
    <section aria-labelledby="hm-unreg" className="hm-card hm-card--main">
      <div className="hm-card__head">
        <span className="hm-card__ic" aria-hidden="true"><Icon name="users" size={24} /></span>
        <div>
          <h2 id="hm-unreg">{t('home.unregistered.title', { n: count, month: monthOf(ym) })}</h2>
          {deadline && <p>{t('home.unregistered.hint', { day: fmt.lastDay(deadline).split('/')[0] })}</p>}
        </div>
      </div>
      <ul className="hm-chips">
        {shown.map((p) => {
          const name = p.full_name ?? p.email ?? p.sub;
          return (
            <li key={p.sub} className="hm-chip">
              <span className="hm-chip__av" aria-hidden="true">{initials(name)}</span>
              {name}
            </li>
          );
        })}
        {more > 0 && <li className="hm-chip hm-chip--more">{t('home.unregistered.more', { n: more })}</li>}
      </ul>
      <div className="hm-card__actions">
        <button type="button" className="btn hm-btn-dark" disabled={copy.busy} onClick={copy.copy}>
          <Icon name="copy" size={18} />
          {t('home.unregistered.copy')}
        </button>
        <Link className="btn" to="/admin/summary">{t('home.unregistered.all')}</Link>
      </div>
      {copy.feedback}
    </section>
  );
}

export function CustomCard({ count }: { count: number }) {
  const { t } = useTranslation();
  return (
    <section aria-labelledby="hm-custom" className="hm-card hm-card--warn">
      <h2 id="hm-custom">{t('home.custom.title', { n: count })}</h2>
      <div className="hm-card__actions">
        <Link className="btn hm-btn-dark" to="/admin/review">{t('home.custom.open')}</Link>
      </div>
    </section>
  );
}

export function LowStockCard({ items }: { items: AdminItem[] }) {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  return (
    <section aria-labelledby="hm-low" className="hm-card">
      <div className="hm-card__row">
        <h2 id="hm-low">{t('home.low.title', { n: items.length })}</h2>
        <Link to="/admin/stock">{t('home.low.open')}</Link>
      </div>
      <ul className="hm-low">
        {items.slice(0, MAX_LOW).map((i) => (
          <li key={i.id}>
            <span>{fmt.name(i)}</span>
            <small>{t('home.low.stock', { n: i.stock_qty })}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

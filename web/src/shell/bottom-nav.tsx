import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconCart, IconHistory, IconUser } from '@/ui/icons';

const ITEMS = [
  { to: '/', key: 'nav.register', Icon: IconCart },
  { to: '/history', key: 'nav.history', Icon: IconHistory },
  { to: '/me', key: 'nav.me', Icon: IconUser },
];

export function BottomNav() {
  const { t } = useTranslation();
  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      {ITEMS.map(({ to, key, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon />
          <span>{t(key)}</span>
        </NavLink>
      ))}
    </nav>
  );
}

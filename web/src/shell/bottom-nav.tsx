import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { IconCart, IconHistory, IconUser } from '@/ui/icons';

const ITEMS = [
  { to: '/', key: 'nav.register', Icon: IconCart },
  { to: '/history', key: 'nav.history', Icon: IconHistory },
];

// "Tôi" không đổi trang: mở sheet tài khoản (ngôn ngữ, đăng xuất)
export function BottomNav({ accountOpen, onAccount }: { accountOpen: boolean; onAccount: () => void }) {
  const { t } = useTranslation();
  const onMePage = useLocation().pathname === '/me';
  return (
    <nav className="bottom-nav" aria-label={t('nav.main')}>
      {ITEMS.map(({ to, key, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon />
          <span>{t(key)}</span>
        </NavLink>
      ))}
      <button type="button" aria-haspopup="dialog" aria-expanded={accountOpen} aria-current={onMePage ? 'page' : undefined} onClick={onAccount}>
        <IconUser />
        <span>{t('nav.me')}</span>
      </button>
    </nav>
  );
}

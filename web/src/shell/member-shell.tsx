import { Link, NavLink, Outlet, useMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { BottomNav } from '@/shell/bottom-nav';
import { useShellFont } from '@/shell/use-shell-font';

function initials(name: string | null, fallback: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return fallback.slice(0, 2).toUpperCase();
  const pick = words.length === 1 ? [words[0]] : [words[0], words[words.length - 1]];
  return pick.map((w) => w[0]).join('').toUpperCase();
}

export function MemberShell() {
  const { t } = useTranslation();
  const me = useMe();
  const narrow = useMediaQuery(NARROW_QUERY);
  useShellFont('member');
  // Trang Đăng ký tự dựng khung panel (v2); các trang cũ tạm nằm trong panel sáng tới C8
  const ownLayout = useMatch({ path: '/', end: true }) !== null;

  return (
    <div className={`m-shell${narrow ? ' is-narrow' : ''}`}>
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      <header className="m-top">
        <Link to="/" className="m-logo">
          <i aria-hidden="true">{t('app.logoLetter')}</i>
          {t('app.title')}
        </Link>
        {!narrow && (
          <nav className="m-tabs" aria-label={t('nav.sections')}>
            <NavLink to="/" end>
              {t('nav.register')}
            </NavLink>
            <NavLink to="/history">{t('nav.history')}</NavLink>
            <NavLink to="/me">{t('nav.me')}</NavLink>
          </nav>
        )}
        <span className="sp" />
        <NotificationBell />
        <div className="m-avatar">
          <span className="m-avatar__ini" aria-hidden="true">{initials(me.fullName, me.sub)}</span>
          {!narrow && (
            <span className="m-avatar__who">
              <b>{me.fullName ?? me.sub}</b>
              {me.department && <small>{me.department}</small>}
            </span>
          )}
        </div>
      </header>
      <main id="main" className={ownLayout ? 'm-main m-main--bare' : 'm-main'}>
        <Outlet />
      </main>
      {narrow && <BottomNav />}
    </div>
  );
}

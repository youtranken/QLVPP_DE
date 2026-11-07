import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { BottomNav } from '@/shell/bottom-nav';
import { useLockTimer } from '@/features/request/use-lock-timer';
import { useShellFont } from '@/shell/use-shell-font';

function initials(name: string | null, fallback: string): string {
  const fromName = initialsOf((name ?? '').trim());
  return fromName === '?' ? fallback.slice(0, 2).toUpperCase() : fromName;
}

export function MemberShell() {
  const { t } = useTranslation();
  const me = useMe();
  const narrow = useMediaQuery(NARROW_QUERY);
  useShellFont('member');
  useLockTimer();

  return (
    <div className={`m-shell${narrow ? ' is-narrow' : ''}`}>
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      <header className="m-top">
        <div className="m-top__in">
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
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      {narrow && <BottomNav />}
    </div>
  );
}

import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAdminRole, useMe } from '@/lib/me';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
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
          </nav>
        )}
        <span className="sp" />
        {isAdminRole(me.role) && (
          <Link to="/admin" className="m-admin-link">
            {t('nav.toAdmin')}
          </Link>
        )}
        {!narrow && (
          <NavLink to="/me" className="m-avatar" aria-label={t('nav.me')} title={me.fullName ?? undefined}>
            <span aria-hidden="true">{initials(me.fullName, me.sub)}</span>
          </NavLink>
        )}
      </header>
      <main id="main" className="m-main">
        <Outlet />
      </main>
      {narrow && <BottomNav />}
    </div>
  );
}

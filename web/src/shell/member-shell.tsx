import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { NARROW_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { IconSprite } from '@/ui/icon-sprite';
import { RouteChunk } from '@/ui/chunk-error-boundary';
import { Loading } from '@/ui/load-state';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { AccountMenu } from '@/shell/account-menu';
import { BottomNav } from '@/shell/bottom-nav';
import { useLockTimer } from '@/features/request/use-lock-timer';
import { useShellFont } from '@/shell/use-shell-font';
import { LoadPanel } from '@/shell/member-page';

function initials(name: string | null, fallback: string): string {
  const fromName = initialsOf((name ?? '').trim());
  return fromName === '?' ? fallback.slice(0, 2).toUpperCase() : fromName;
}

export function MemberShell() {
  const { t } = useTranslation();
  const me = useMe();
  const narrow = useMediaQuery(NARROW_QUERY);
  const [accountOpen, setAccountOpen] = useState(false);
  useShellFont('member');
  useLockTimer();

  const avatar = (
    <>
      <span className="m-avatar__ini" aria-hidden="true">{initials(me.fullName, me.sub)}</span>
      <span className="m-avatar__who">
        <b>{me.fullName ?? me.sub}</b>
      </span>
    </>
  );

  return (
    <div className={`m-shell${narrow ? ' is-narrow' : ''}`}>
      {/* Mọi <Icon> (nút xóa ô tìm, ảnh dự phòng của món, toast, hộp thoại) trỏ vào sprite này */}
      <IconSprite />
      <a className="skip-link" href="#main">
        {t('common.skipToContent')}
      </a>
      <header className="m-top">
        <div className="m-top__in">
          <Link to="/" className="m-logo">
            <img src="/vpp-logo.png" alt="" width={30} height={30} />
            <span className="m-logo__name">{t('app.title')}</span>
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
          {/* Ngôn ngữ nằm trong hộp tài khoản; ≤ 900 tài khoản ở "Tôi" (thanh dưới) */}
          <NotificationBell />
          {!narrow && (
            <AccountMenu
              variant="popover"
              open={accountOpen}
              onOpenChange={setAccountOpen}
              trigger={(p) => (
                <button type="button" className="m-avatar" aria-label={t('profile.openMenu', { name: me.fullName ?? me.sub })} {...p}>
                  {avatar}
                </button>
              )}
            />
          )}
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <RouteChunk
          loading={
            <LoadPanel>
              <Loading />
            </LoadPanel>
          }
          frame={(node) => <LoadPanel>{node}</LoadPanel>}
        >
          <Outlet />
        </RouteChunk>
      </main>
      {narrow && <BottomNav accountOpen={accountOpen} onAccount={() => setAccountOpen(true)} />}
      {narrow && <AccountMenu variant="sheet" open={accountOpen} onOpenChange={setAccountOpen} />}
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { logout } from '@/lib/auth-actions';
import { initialsOf } from '@/lib/initials';
import { ADMIN_TABLET_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { Icon } from '@/ui/icon';
import { LanguageSwitch } from '@/ui/language-switch';

function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    setBusy(true);
    setFailed(false);
    if (!(await logout(me.csrfToken))) {
      setFailed(true);
      setBusy(false);
    }
  };
  return (
    <>
      {iconOnly ? (
        <button type="button" className="side__icon-btn" aria-label={t('auth.logout')} title={t('auth.logout')} disabled={busy} onClick={() => void run()}>
          <Icon name="logout" size={18} />
        </button>
      ) : (
        <button type="button" className="btn btn--ghost btn--sm side__logout" disabled={busy} onClick={() => void run()}>
          <Icon name="logout" size={18} />
          {t('auth.logout')}
        </button>
      )}
      {failed && (
        <p role="alert" className="side__error">
          {t('auth.logoutFailed')}
        </p>
      )}
    </>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>('[aria-checked="true"], button')?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || !open) return;
    setOpen(false);
    trigger.current?.focus();
  };
  return { open, setOpen, box, trigger, panel, id, onKeyDown };
}

// Máy tính bảng: cột 72 chỉ còn avatar, bấm mới hiện đổi ngôn ngữ + đăng xuất.
// Cột 252 (compact): một hàng để 12 mục vừa 1280×720 — đăng xuất là nút biểu tượng, ngôn ngữ sau nút "Ngôn ngữ".
export function AdminSidebarUser({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const tablet = useMediaQuery(ADMIN_TABLET_QUERY);
  const row = compact && !tablet;
  const { open, setOpen, box, trigger, panel, id, onKeyDown } = usePopover();
  const name = me.fullName ?? me.sub;
  const initials = initialsOf(name);
  const popover = { ref: panel, id };
  const toggle = { ref: trigger, 'aria-expanded': open, 'aria-controls': open ? id : undefined, onClick: () => setOpen((v) => !v) };
  return (
    <div ref={box} className="side__user" data-layout={row ? 'row' : undefined} onKeyDown={onKeyDown}>
      <div className="side__who">
        {tablet ? (
          <button type="button" className="side__avatar" title={name} aria-label={t('nav.userMenu')} {...toggle}>
            {initials}
          </button>
        ) : (
          <span className="side__avatar" aria-hidden="true">
            {initials}
          </span>
        )}
        <span className="side__who-text" title={name}>
          <b>{name}</b>
          <small>{t(`common.roles.${me.role}`)}</small>
        </span>
        {compact && !row && <NotificationBell />}
        {row && (
          <div className="side__tools">
            <NotificationBell />
            <button type="button" className="side__icon-btn side__lang-btn" aria-label={t('common.languages.label')} title={t('common.languages.label')} {...toggle}>
              {t('common.languages.short')}
            </button>
            <LogoutButton iconOnly />
          </div>
        )}
      </div>
      {row
        ? open && (
            <div className="side__acct" {...popover}>
              <LanguageSwitch />
            </div>
          )
        : (!tablet || open) && (
            <div className="side__acct" {...(tablet ? popover : {})}>
              <LanguageSwitch />
              <LogoutButton />
            </div>
          )}
    </div>
  );
}

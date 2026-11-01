import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { logout } from '@/lib/auth-actions';
import { initialsOf } from '@/lib/initials';
import { ADMIN_TABLET_QUERY, useMediaQuery } from '@/lib/use-media-query';
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

// Máy tính bảng: cột 72 chỉ còn avatar, bấm mới hiện đổi ngôn ngữ + đăng xuất.
// Cột 232 (compact): một hàng để 12 mục vừa 1280×800 — đăng xuất là nút biểu tượng, ngôn ngữ sau nút "Ngôn ngữ".
export function AdminSidebarUser({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const me = useMe();
  const tablet = useMediaQuery(ADMIN_TABLET_QUERY);
  const row = compact && !tablet;
  const [open, setOpen] = useState(false);
  const name = me.fullName ?? me.sub;
  const initials = initialsOf(name);
  return (
    <div className="side__user" data-layout={row ? 'row' : undefined} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <div className="side__who">
        {tablet ? (
          <button type="button" className="side__avatar" title={name} aria-label={t('nav.userMenu')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
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
        {row && (
          <>
            <button type="button" className="side__icon-btn" aria-label={t('common.languages.label')} title={t('common.languages.label')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              <Icon name="more" size={18} />
            </button>
            <LogoutButton iconOnly />
          </>
        )}
      </div>
      {row
        ? open && (
            <div className="side__acct">
              <LanguageSwitch />
            </div>
          )
        : (!tablet || open) && (
            <div className="side__acct">
              <LanguageSwitch />
              <LogoutButton />
            </div>
          )}
    </div>
  );
}

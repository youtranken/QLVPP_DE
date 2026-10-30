import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { logout } from '@/lib/auth-actions';
import { ADMIN_TABLET_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { Icon } from '@/ui/icon';
import { LanguageSwitch } from '@/ui/language-switch';

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1][0] ?? '') : '';
  return (first + last).toUpperCase();
}

function LogoutButton() {
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
      <button type="button" className="btn btn--ghost btn--sm side__logout" disabled={busy} onClick={() => void run()}>
        <Icon name="logout" size={18} />
        {t('auth.logout')}
      </button>
      {failed && (
        <p role="alert" className="side__error">
          {t('auth.logoutFailed')}
        </p>
      )}
    </>
  );
}

// Máy tính bảng: cột 72 chỉ còn avatar, bấm mới hiện đổi ngôn ngữ + đăng xuất
export function AdminSidebarUser() {
  const { t } = useTranslation();
  const me = useMe();
  const tablet = useMediaQuery(ADMIN_TABLET_QUERY);
  const [open, setOpen] = useState(false);
  const name = me.fullName ?? me.sub;
  const initials = initialsOf(name);
  return (
    <div className="side__user" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
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
        <span className="side__who-text">
          <b>{name}</b>
          <small>{t(`common.roles.${me.role}`)}</small>
        </span>
      </div>
      {(!tablet || open) && (
        <div className="side__acct">
          <LanguageSwitch />
          <LogoutButton />
        </div>
      )}
    </div>
  );
}

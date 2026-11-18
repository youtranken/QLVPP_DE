import { useId, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { Icon } from '@/ui/icon';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { currentPeriodQuery } from '@/features/request/request.api';
import { AdminMenuSheet } from '@/shell/admin-menu-sheet';
import { QuickSearch } from '@/shell/quick-search';


// Thanh trên không lặp tiêu đề trang (đã có h1): dòng phụ nói kỳ hiện tại, giống nhau ở mọi màn
function usePeriodContext(): string | undefined {
  const { t } = useTranslation();
  const period = useQuery(currentPeriodQuery());
  if (!period.data?.ym) return undefined;
  return t('nav.mobile.currentPeriod', { month: Number(period.data.ym.slice(5, 7)) });
}

export function AdminTopbar() {
  const { t } = useTranslation();
  const me = useMe();
  const [open, setOpen] = useState(false);
  const avatarHint = useId();
  const sub = usePeriodContext();
  const name = me.fullName ?? me.sub;
  return (
    <header className="topbar">
      <button type="button" className="topbar__menu" aria-label={t('nav.mobile.openMenu')} aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      <span className="topbar__text">
        <span className="topbar__title">{t('app.title')}</span>
        {sub && <small className="topbar__sub">{sub}</small>}
      </span>
      <QuickSearch variant="icon" />
      <NotificationBell />
      {/* Avatar cũng mở menu: mọi trang chỉ cách 2 chạm */}
      <button
        type="button"
        className="topbar__avatar"
        aria-label={t('nav.mobile.avatar', { name, role: t(`common.roles.${me.role}`) })}
        aria-describedby={avatarHint}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span className="topbar__avatar-face" aria-hidden="true">
          {initialsOf(name)}
        </span>
      </button>
      <span id={avatarHint} hidden>
        {t('nav.mobile.openMenu')}
      </span>
      <AdminMenuSheet open={open} onOpenChange={setOpen} />
    </header>
  );
}

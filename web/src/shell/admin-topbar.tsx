import { useId, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { lockedYm } from '@/lib/ym';
import { Icon } from '@/ui/icon';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { currentPeriodQuery } from '@/features/request/request.api';
import { ADMIN_NAV } from '@/shell/admin-nav';
import { AdminMenuSheet } from '@/shell/admin-menu-sheet';

const PAGES = ADMIN_NAV.flatMap((g) => g.pages);

// Thanh trên không lặp tiêu đề trang (đã có h1): dòng phụ nói ngữ cảnh kỳ; Giao hàng chỉ làm kỳ khóa gần nhất
function usePeriodContext(delivery: boolean): string | undefined {
  const { t } = useTranslation();
  const period = useQuery(currentPeriodQuery());
  if (!period.data?.ym) return undefined;
  if (!delivery) return t('nav.mobile.currentPeriod', { month: Number(period.data.ym.slice(5, 7)) });
  const ym = lockedYm(period.data.ym);
  return t('nav.mobile.lockedMonth', { month: Number(ym.slice(5, 7)), year: ym.slice(0, 4) });
}

export function AdminTopbar() {
  const { t } = useTranslation();
  const me = useMe();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const avatarHint = useId();
  const page = PAGES.find((p) => pathname.startsWith(`/admin/${p.path}`));
  const delivery = page?.path === 'delivery';
  const sub = usePeriodContext(delivery);
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

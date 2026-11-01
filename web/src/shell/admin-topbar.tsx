import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { initialsOf } from '@/lib/initials';
import { useMe } from '@/lib/me';
import { useUrlPatch } from '@/lib/use-url-patch';
import { YM, shiftYm } from '@/lib/ym';
import { Icon } from '@/ui/icon';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { currentPeriodQuery } from '@/features/request/request.api';
import { ADMIN_NAV } from '@/shell/admin-nav';
import { AdminMenuSheet } from '@/shell/admin-menu-sheet';

const PAGES = ADMIN_NAV.flatMap((g) => g.pages);

function useDeliveryMonth(active: boolean, asked: string | null): string | undefined {
  const { t } = useTranslation();
  const period = useQuery({ ...currentPeriodQuery(), enabled: active });
  if (!active || !period.data?.ym) return undefined;
  const ym = asked && YM.test(asked) ? asked : shiftYm(period.data.ym, -1);
  return t('nav.mobile.lockedMonth', { month: Number(ym.slice(5, 7)), year: ym.slice(0, 4) });
}

export function AdminTopbar() {
  const { t } = useTranslation();
  const me = useMe();
  const { pathname } = useLocation();
  const [params, update] = useUrlPatch();
  const [open, setOpen] = useState(false);
  const page = PAGES.find((p) => pathname.startsWith(`/admin/${p.path}`));
  const delivery = page?.path === 'delivery';
  const detail = delivery && !!params.get('request');
  const sub = useDeliveryMonth(delivery, params.get('ym'));
  const name = me.fullName ?? me.sub;
  return (
    <header className="topbar">
      {detail ? (
        <button type="button" className="topbar__menu" aria-label={t('nav.mobile.backToList')} onClick={() => update({ request: null })}>
          <Icon name="back" />
        </button>
      ) : (
        <button type="button" className="topbar__menu" aria-label={t('nav.mobile.openMenu')} aria-expanded={open} onClick={() => setOpen(true)}>
          <Icon name="menu" />
        </button>
      )}
      <span className="topbar__text">
        <span className="topbar__title">{page ? t(page.titleKey) : t('app.title')}</span>
        {sub && <small className="topbar__sub">{sub}</small>}
      </span>
      <NotificationBell />
      {/* Avatar cũng mở menu: ở màn chi tiết nút trái là Quay lại, mọi trang vẫn chỉ cách 2 chạm */}
      <button
        type="button"
        className="topbar__avatar"
        aria-label={t('nav.mobile.avatar', { name, role: t(`common.roles.${me.role}`) })}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {initialsOf(name)}
      </button>
      <AdminMenuSheet open={open} onOpenChange={setOpen} />
    </header>
  );
}

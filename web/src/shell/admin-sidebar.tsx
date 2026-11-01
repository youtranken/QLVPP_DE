import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { currentPeriodQuery } from '@/features/request/request.api';
import { ADMIN_NAV, type AdminPage } from '@/shell/admin-nav';
import { AdminPeriodCard } from '@/shell/admin-period-card';
import { AdminSidebarUser } from '@/shell/admin-sidebar-user';
import { useAdminBadges } from '@/shell/use-admin-badges';

function SideLink({ page, count, onNavigate }: { page: AdminPage; count?: number; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const label = t(page.titleKey);
  return (
    <NavLink to={`/admin/${page.path}`} title={label} className="side__link" onClick={onNavigate}>
      <Icon name={page.icon} />
      <span className="side__label">{label}</span>
      {!!count && page.badge && (
        <>
          <span className="side__cnt" data-badge={page.badge} aria-hidden="true">
            {count}
          </span>
          <span className="sr-only">{`, ${t(`nav.badge.${page.badge}`, { n: count })}`}</span>
        </>
      )}
    </NavLink>
  );
}

// 'side': cột trái ≥ 768 (hàng thương hiệu là banner, có chuông); 'sheet': thân menu điện thoại, đầu do AdminMenuSheet dựng
export function AdminSidebar({ variant = 'side', onNavigate }: { variant?: 'side' | 'sheet'; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const badges = useAdminBadges();
  const period = useQuery(currentPeriodQuery());
  const hasPeriod = typeof period.data?.ym === 'string' && typeof period.data.deadline === 'string';
  return (
    <div className="side" data-variant={variant}>
      {variant === 'side' && (
        <header className="side__brand">
          <span className="side__logo" aria-hidden="true">
            <Icon name="pkg" />
          </span>
          <span className="side__brand-text">
            {t('app.title')}
            <small>{t('common.roles.admin')}</small>
          </span>
          <NotificationBell />
        </header>
      )}
      <nav className="side__nav" aria-label={t('nav.adminMenu')}>
        {ADMIN_NAV.map((g) => (
          <div key={g.labelKey} className="side__group" role="group" aria-label={t(g.labelKey)}>
            <span className="side__group-label" aria-hidden="true">
              {t(g.labelKey)}
            </span>
            {g.pages.map((p) => (
              <SideLink key={p.path} page={p} count={p.badge ? badges[p.badge] : undefined} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>
      {hasPeriod && <AdminPeriodCard period={period.data!} onNavigate={onNavigate} />}
      <AdminSidebarUser compact={variant === 'side'} />
    </div>
  );
}

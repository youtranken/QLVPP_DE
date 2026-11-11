import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { ADMIN_TABLET_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { currentPeriodQuery } from '@/features/request/request.api';
import { ADMIN_NAV, type AdminPage } from '@/shell/admin-nav';
import { AdminPeriodCard } from '@/shell/admin-period-card';
import { AdminSidebarUser } from '@/shell/admin-sidebar-user';
import { useAdminBadges } from '@/shell/use-admin-badges';

const ALL_PATHS = ADMIN_NAV.flatMap((g) => g.pages.map((p) => p.path));

function SideLink({ page, count, onNavigate }: { page: AdminPage; count?: number; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const label = t(page.titleKey);
  // Mục là tiền tố của mục khác thì chỉ khớp đúng đường dẫn để hai mục không sáng chung
  const end = ALL_PATHS.some((p) => p.startsWith(`${page.path}/`));
  // B0.9: chỉ cột thu gọn (768–1279, ẩn chữ) mới cần tooltip; cột đủ chữ và menu điện thoại thì title là thừa
  const collapsed = useMediaQuery(ADMIN_TABLET_QUERY) && !onNavigate;
  return (
    <NavLink to={`/admin/${page.path}`} end={end} title={collapsed ? label : undefined} className="side__link" onClick={onNavigate}>
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

// 'side': cột trái ≥ 768 (chuông nằm ở khối người dùng cuối cột); 'sheet': thân menu điện thoại, đầu do AdminMenuSheet dựng
export function AdminSidebar({ variant = 'side', onNavigate }: { variant?: 'side' | 'sheet'; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const badges = useAdminBadges();
  const period = useQuery(currentPeriodQuery());
  const hasPeriod = typeof period.data?.ym === 'string' && typeof period.data.deadline === 'string';
  return (
    <div className="side" data-variant={variant}>
      <nav className="side__nav" aria-label={t('nav.adminMenu')}>
        {ADMIN_NAV.map((g) => {
          const links = g.pages.map((p) => (
            <SideLink key={p.path} page={p} count={p.badge ? badges[p.badge] : undefined} onNavigate={onNavigate} />
          ));
          return (
            <div key={g.labelKey} className="side__group" role="group" aria-label={t(g.labelKey)}>
              <span className="side__group-label" aria-hidden="true">
                {t(g.labelKey)}
              </span>
              {links}
            </div>
          );
        })}
      </nav>
      {hasPeriod && <AdminPeriodCard period={period.data!} onNavigate={onNavigate} />}
      <AdminSidebarUser compact={variant === 'side'} />
    </div>
  );
}

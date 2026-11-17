import type { MouseEvent } from 'react';
import { Link, NavLink } from 'react-router-dom';
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

// Nhãn bị cắt "…" (tên dài, cột đủ chữ hay menu điện thoại) → rê chuột thấy tên đầy đủ; nhãn vừa thì không title thừa
function titleIfTruncated(e: MouseEvent<HTMLAnchorElement>, label: string): void {
  const el = e.currentTarget.querySelector<HTMLElement>('.side__label');
  if (el && el.scrollWidth > el.clientWidth) e.currentTarget.title = label;
  else e.currentTarget.removeAttribute('title');
}

function SideLink({ page, count, collapsed, onNavigate }: { page: AdminPage; count?: number; collapsed: boolean; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const label = t(page.titleKey);
  // Mục là tiền tố của mục khác thì chỉ khớp đúng đường dẫn để hai mục không sáng chung
  const end = ALL_PATHS.some((p) => p.startsWith(`${page.path}/`));
  return (
    <NavLink
      to={`/admin/${page.path}`}
      end={end}
      // Cột thu gọn ẩn chữ → luôn có title
      title={collapsed ? label : undefined}
      onMouseEnter={collapsed ? undefined : (e) => titleIfTruncated(e, label)}
      className="side__link"
      onClick={onNavigate}
    >
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
  // Cột thu gọn (768–1279) chỉ ở cột trái; menu điện thoại luôn đủ chữ
  const collapsed = useMediaQuery(ADMIN_TABLET_QUERY) && variant === 'side';
  return (
    <div className="side" data-variant={variant}>
      {/* Q2: tên app ở đầu cột trái; menu điện thoại có đầu riêng (AdminMenuSheet) */}
      {variant === 'side' && (
        <Link to="/admin" className="side__brand" aria-label={t('app.title')} title={collapsed ? t('app.title') : undefined}>
          <img src="/vpp-logo.png" alt="" width={30} height={30} />
          {!collapsed && <span aria-hidden="true">{t('app.title')}</span>}
        </Link>
      )}
      <nav className="side__nav" aria-label={t('nav.adminMenu')}>
        {ADMIN_NAV.map((g) => {
          const links = g.pages.map((p) => (
            <SideLink key={p.path} page={p} count={p.badge ? badges[p.badge] : undefined} collapsed={collapsed} onNavigate={onNavigate} />
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
      {variant === 'sheet' && <AdminSidebarUser />}
    </div>
  );
}

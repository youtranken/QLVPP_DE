import { useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';
import { currentPeriodQuery } from '@/features/request/request.api';
import { ADMIN_NAV, type AdminNavGroup, type AdminPage } from '@/shell/admin-nav';
import { AdminPeriodCard } from '@/shell/admin-period-card';
import { AdminSidebarUser } from '@/shell/admin-sidebar-user';
import { useAdminBadges } from '@/shell/use-admin-badges';

const ALL_PATHS = ADMIN_NAV.flatMap((g) => g.pages.map((p) => p.path));
const LATER_KEY = 'vpp.admin.navLater';

function SideLink({ page, count, onNavigate }: { page: AdminPage; count?: number; onNavigate?: () => void }) {
  const { t } = useTranslation();
  const label = t(page.titleKey);
  // "delivery" là tiền tố của "delivery/classic": chỉ khớp đúng đường dẫn thì mục không sáng chung
  const end = ALL_PATHS.some((p) => p.startsWith(`${page.path}/`));
  return (
    <NavLink to={`/admin/${page.path}`} end={end} title={label} className="side__link" onClick={onNavigate}>
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

function readOpen(): boolean {
  try {
    return localStorage.getItem(LATER_KEY) === '1';
  } catch {
    return false;
  }
}

// Thu gọn mặc định để cột trái vừa 1280×720; đang đứng trong nhóm thì luôn mở để thấy mục đang chọn
function CollapsibleGroup({ group, children }: { group: AdminNavGroup; children: ReactNode }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [stored, setStored] = useState(readOpen);
  const inside = group.pages.some((p) => pathname === `/admin/${p.path}` || pathname.startsWith(`/admin/${p.path}/`));
  const open = stored || inside;
  const toggle = () => {
    if (inside) return;
    const next = !open;
    setStored(next);
    try {
      localStorage.setItem(LATER_KEY, next ? '1' : '0');
    } catch {
      // chỉ mất việc nhớ lựa chọn
    }
  };
  return (
    <div className="side__group" role="group" aria-label={t(group.labelKey)}>
      <button type="button" className="side__group-toggle" aria-expanded={open} aria-disabled={inside || undefined} onClick={toggle}>
        <span className="side__group-label">{t(group.labelKey)}</span>
        <Icon name="chev" size={16} />
      </button>
      {open && children}
    </div>
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
          if (g.collapsible && variant === 'side') return <CollapsibleGroup key={g.labelKey} group={g}>{links}</CollapsibleGroup>;
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

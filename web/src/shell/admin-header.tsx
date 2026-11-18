import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ADMIN_NAV } from '@/shell/admin-nav';
import { AdminSidebarUser } from '@/shell/admin-sidebar-user';
import { QuickSearch } from '@/shell/quick-search';

const PAGES = ADMIN_NAV.flatMap((g) => g.pages);

// Thanh trên trắng ≥ 768 theo họ app PMH: đường dẫn bên trái, Tìm nhanh, chuông + tài khoản bên phải
export function AdminHeader() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const page = PAGES.filter((p) => pathname.startsWith(`/admin/${p.path}`)).sort((a, b) => b.path.length - a.path.length)[0];
  return (
    <header className="adm-head">
      <nav className="adm-head__crumb" aria-label={t('nav.breadcrumb')}>
        <Link to="/admin">{t('app.title')}</Link>
        {page && (
          <>
            <span aria-hidden="true">›</span>
            <span aria-current="page">{t(page.titleKey)}</span>
          </>
        )}
      </nav>
      <QuickSearch variant="field" />
      <AdminSidebarUser compact inTopbar />
    </header>
  );
}

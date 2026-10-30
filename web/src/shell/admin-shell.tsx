import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ADMIN_PHONE_QUERY, useMediaQuery } from '@/lib/use-media-query';
import { IconSprite } from '@/ui/icon-sprite';
import { NoPermission } from '@/ui/load-state';
import { PageHeader } from '@/ui/page-header';
import { ToastProvider } from '@/ui/toast-provider';
import { adminPageOf } from '@/shell/admin-nav';
import { AdminSidebar } from '@/shell/admin-sidebar';
import { AdminTopbar } from '@/shell/admin-topbar';
import { useForbiddenRole } from '@/shell/use-forbidden-role';
import { useShellFont } from '@/shell/use-shell-font';

// Trang chưa port (S2–S6) chưa tự dựng PageHeader: shell dựng tạm tiêu đề theo mục sidebar
function ShellPageHeader() {
  const { t } = useTranslation();
  const current = adminPageOf(useLocation().pathname);
  if (!current) return null;
  return <PageHeader crumbs={[]} title={t(current.page.titleKey)} />;
}

export function AdminShell() {
  const { t } = useTranslation();
  const phone = useMediaQuery(ADMIN_PHONE_QUERY);
  const forbidden = useForbiddenRole();
  useShellFont('admin');

  return (
    <ToastProvider>
      <IconSprite />
      <div className="shell">
        <a className="skip-link" href="#main">
          {t('common.skipToContent')}
        </a>
        {phone ? <AdminTopbar /> : <AdminSidebar />}
        <main id="main" className="shell__main" tabIndex={-1}>
          {forbidden ? (
            <NoPermission />
          ) : (
            <>
              <ShellPageHeader />
              <Outlet />
            </>
          )}
        </main>
      </div>
    </ToastProvider>
  );
}

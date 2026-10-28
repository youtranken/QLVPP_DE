import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { ComingSoon } from '@/ui/coming-soon';
import { NotFound } from '@/ui/load-state';
import { ProfilePage } from '@/features/profile/profile-page';
import { CatalogPage } from '@/features/catalog/catalog-page';
import { CategoryPage } from '@/features/catalog/category-page';
import { MemberShell } from '@/shell/member-shell';
import { AdminShell } from '@/shell/admin-shell';
import { RequireRole } from '@/shell/require-role';
import { ForbiddenScreen } from '@/shell/forbidden-screen';
import { ADMIN_HOME, ADMIN_PAGES } from '@/shell/admin-nav';

function MemberSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return <ComingSoon title={t(titleKey)} asPageTitle />;
}

function AdminSoon({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return <ComingSoon title={t(titleKey)} />;
}

function ForbiddenRoute() {
  return <ForbiddenScreen email={useMe().email} />;
}

const BUILT_ADMIN_PAGES = new Set(['catalog', 'categories']);

// Màn chưa làm hiện "Sắp có"; task sau thêm route thật và tên vào BUILT_ADMIN_PAGES
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/forbidden" element={<ForbiddenRoute />} />
      <Route element={<MemberShell />}>
        <Route index element={<MemberSoon titleKey="nav.register" />} />
        <Route path="history" element={<MemberSoon titleKey="nav.history" />} />
        <Route path="me" element={<ProfilePage />} />
      </Route>
      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin', 'sa']}>
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to={ADMIN_HOME} replace />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="categories" element={<CategoryPage />} />
        {ADMIN_PAGES.filter((p) => !BUILT_ADMIN_PAGES.has(p.path)).map((p) => (
          <Route key={p.path} path={p.path} element={<AdminSoon titleKey={p.titleKey} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

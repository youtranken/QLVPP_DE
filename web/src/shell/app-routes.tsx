import { Navigate, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { ComingSoon } from '@/ui/coming-soon';
import { NotFound } from '@/ui/load-state';
import { ProfilePage } from '@/features/profile/profile-page';
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

// Plan 1: mọi màn đều "Sắp có"; task sau thay element của từng route bằng trang thật
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
        {ADMIN_PAGES.map((p) => (
          <Route key={p.path} path={p.path} element={<AdminSoon titleKey={p.titleKey} />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import { Navigate, Route, Routes } from 'react-router-dom';
import { useMe } from '@/lib/me';
import { NotFound } from '@/ui/load-state';
import { ProfilePage } from '@/features/profile/profile-page';
import { RequestPage } from '@/features/request/request-page';
import { HistoryPage } from '@/features/request/history-page';
import { HistoryDetailPage } from '@/features/request/history-detail-page';
import { CatalogPage } from '@/features/catalog/catalog-page';
import { CategoriesPage } from '@/features/catalog/categories-page';
import { UnitsPage } from '@/features/units/units-page';
import { StockPage } from '@/features/stock/stock-page';
import { UsersPage } from '@/features/directory/users-page';
import { AuditPage } from '@/features/admin/audit-page';
import { ConfigPage } from '@/features/admin/config-page';
import { SummaryPage } from '@/features/summary/summary-page';
import { ReviewPage } from '@/features/review/review-page';
import { DeliveryPage } from '@/features/delivery/delivery-page';
import { BacklogPage } from '@/features/delivery/backlog-page';
import { ReportsPage } from '@/features/reports/reports-page';
import { PrintPage } from '@/features/reports/print-page';
import { MemberShell } from '@/shell/member-shell';
import { AdminShell } from '@/shell/admin-shell';
import { RequireMember, RequireRole } from '@/shell/require-role';
import { ForbiddenScreen } from '@/shell/forbidden-screen';
import { ADMIN_HOME } from '@/shell/admin-nav';

function ForbiddenRoute() {
  return <ForbiddenScreen email={useMe().email} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/forbidden" element={<ForbiddenRoute />} />
      <Route
        element={
          <RequireMember>
            <MemberShell />
          </RequireMember>
        }
      >
        <Route index element={<RequestPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="history/:ym" element={<HistoryDetailPage />} />
        <Route path="me" element={<ProfilePage />} />
      </Route>
      <Route
        path="/admin/reports/snapshots/:id/print"
        element={
          <RequireRole roles={['admin', 'sa']}>
            <PrintPage />
          </RequireRole>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireRole roles={['admin', 'sa']}>
            <AdminShell />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to={ADMIN_HOME} replace />} />
        <Route path="summary" element={<SummaryPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="delivery" element={<DeliveryPage />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="units" element={<UnitsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

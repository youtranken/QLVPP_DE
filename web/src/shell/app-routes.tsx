import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { isAdminRole, useMe } from '@/lib/me';
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
import { MonthPage } from '@/features/month/month-page';
import { ReviewPage } from '@/features/review/review-page';
import { ArrivalsPage } from '@/features/arrivals/arrivals-page';
import { SendAdmPage } from '@/features/send-adm/send-adm-page';
import { DeliveryClassicRedirect, DeliveryPeoplePage } from '@/features/delivery/people/delivery-people-page';
import { BacklogPage } from '@/features/delivery/backlog-page';
import { ReportsPage } from '@/features/reports/reports-page';
import { PrintPage } from '@/features/reports/print-page';
import { MemberPage } from '@/shell/member-page';
import { MemberShell } from '@/shell/member-shell';
import { AdminShell } from '@/shell/admin-shell';
import { RequireMember, RequireRole } from '@/shell/require-role';
import { ForbiddenScreen } from '@/shell/forbidden-screen';
import { ADMIN_HOME } from '@/shell/admin-nav';

// Địa chỉ cũ chuyển sang trang mới: thay mục lịch sử (Back không quay lại) và giữ nguyên query
function RedirectKeepSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

function ForbiddenRoute() {
  return <ForbiddenScreen email={useMe().email} />;
}

export function AppRoutes() {
  // Đường dẫn lạ: nhân viên thấy 404 trong khung Nhân viên; Hành chính/SA rơi xuống 404 chung cuối danh sách (không bị chuyển về /admin)
  const member = !isAdminRole(useMe().role);
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
        {member && <Route path="*" element={<MemberPage><NotFound /></MemberPage>} />}
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
        <Route path="month" element={<MonthPage />} />
        <Route path="home" element={<RedirectKeepSearch to="/admin/month" />} />
        <Route path="summary" element={<RedirectKeepSearch to="/admin/month" />} />
        <Route path="review" element={<ReviewPage />} />
        <Route path="arrivals" element={<ArrivalsPage />} />
        <Route path="send-adm" element={<SendAdmPage />} />
        <Route path="delivery" element={<DeliveryPeoplePage />} />
        <Route path="delivery/classic" element={<DeliveryClassicRedirect />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="catalog" element={<CatalogPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="categories/units" element={<UnitsPage />} />
        <Route path="units" element={<RedirectKeepSearch to="/admin/categories/units" />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

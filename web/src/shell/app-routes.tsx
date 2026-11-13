import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isAdminRole, useMe } from '@/lib/me';
import { NotFound } from '@/ui/load-state';
import { MemberPage } from '@/shell/member-page';
import { MemberShell } from '@/shell/member-shell';
import { AdminShell } from '@/shell/admin-shell';
import { RequireMember, RequireRole } from '@/shell/require-role';
import { ForbiddenScreen } from '@/shell/forbidden-screen';
import { ADMIN_HOME } from '@/shell/admin-nav';
import { adminChunk, memberChunk, printChunk } from '@/shell/route-chunks';
import { PrintPending } from '@/features/reports/print-toolbar';
import { RouteChunk } from '@/ui/chunk-error-boundary';

// Màn nạp lười theo nhóm (Hành chính / Nhân viên / In): mỗi nhóm một chunk, Suspense + ChunkErrorBoundary nằm trong khung
const RequestPage = memberChunk.page('RequestPage');
const HistoryPage = memberChunk.page('HistoryPage');
const HistoryDetailPage = memberChunk.page('HistoryDetailPage');
const ProfilePage = memberChunk.page('ProfilePage');
const MonthPage = adminChunk.page('MonthPage');
const ReviewPage = adminChunk.page('ReviewPage');
const ArrivalsPage = adminChunk.page('ArrivalsPage');
const DeliveryPeoplePage = adminChunk.page('DeliveryPeoplePage');
const DeliveryClassicRedirect = adminChunk.page('DeliveryClassicRedirect');
const BacklogPage = adminChunk.page('BacklogPage');
const ReportSendPage = adminChunk.page('ReportSendPage');
const StockPage = adminChunk.page('StockPage');
const CatalogPage = adminChunk.page('CatalogPage');
const CategoriesPage = adminChunk.page('CategoriesPage');
const UnitsPage = adminChunk.page('UnitsPage');
const UsersPage = adminChunk.page('UsersPage');
const AuditPage = adminChunk.page('AuditPage');
const ConfigPage = adminChunk.page('ConfigPage');
const PrintPage = printChunk.page('PrintPage');

// Địa chỉ cũ chuyển sang trang mới: thay mục lịch sử (Back không quay lại) và giữ nguyên query
function RedirectKeepSearch({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate to={{ pathname: to, search }} replace />;
}

// 404 nhân viên dùng khung trang chuẩn (tiêu đề trên nền, cách thanh trên như mọi trang), không đặt panel sát thanh trên
function MemberNotFound() {
  const { t } = useTranslation();
  return (
    <MemberPage title={t('common.notFoundTitle')}>
      <NotFound inPage />
    </MemberPage>
  );
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
        {member && <Route path="*" element={<MemberNotFound />} />}
      </Route>
      <Route
        path="/admin/reports/snapshots/:id/print"
        element={
          <RequireRole roles={['admin', 'sa']}>
            <RouteChunk loading={<PrintPending />} frame={(node) => <PrintPending>{node}</PrintPending>}>
              <PrintPage />
            </RouteChunk>
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
        <Route path="send-adm" element={<RedirectKeepSearch to="/admin/reports" />} />
        <Route path="delivery" element={<DeliveryPeoplePage />} />
        <Route path="delivery/classic" element={<DeliveryClassicRedirect />} />
        <Route path="backlog" element={<BacklogPage />} />
        <Route path="reports" element={<ReportSendPage />} />
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

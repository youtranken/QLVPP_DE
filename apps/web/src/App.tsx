import { Flex, Result, Spin } from 'antd';
import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ApiError, takeReturnTo } from './lib/api';
import { useMe } from './lib/queries';
import { HomePage } from './pages/HomePage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { NoAccessPage } from './pages/NoAccessPage';
import { RegisterPage } from './pages/RegisterPage';
import { SignInPage } from './pages/SignInPage';

/**
 * Màn quản trị tải chậm (lazy): chỉ admin dùng, mà riêng ECharts đã nặng hơn cả
 * phần còn lại của app — nhân viên không nên phải tải chỗ đó.
 */
const AdminAuditPage = lazy(() =>
  import('./pages/admin/AdminAuditPage').then((m) => ({ default: m.AdminAuditPage })),
);
const AdminCatalogPage = lazy(() =>
  import('./pages/admin/AdminCatalogPage').then((m) => ({ default: m.AdminCatalogPage })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
);
const AdminDirectoryPage = lazy(() =>
  import('./pages/admin/AdminDirectoryPage').then((m) => ({ default: m.AdminDirectoryPage })),
);
const AdminRequestsPage = lazy(() =>
  import('./pages/admin/AdminRequestsPage').then((m) => ({ default: m.AdminRequestsPage })),
);
const AdminSummaryPage = lazy(() =>
  import('./pages/admin/AdminSummaryPage').then((m) => ({ default: m.AdminSummaryPage })),
);

/** Đường dẫn tiếng Việt — khớp với chỗ backend redirect về sau khi đăng nhập. */
export const routes = {
  home: '/',
  register: '/dang-ky',
  myRequests: '/don-cua-toi',
  signIn: '/dang-nhap',
  noAccess: '/khong-co-quyen',
  // Quản trị
  adminDashboard: '/quan-tri',
  adminRequests: '/quan-tri/don',
  adminSummary: '/quan-tri/tong-hop',
  adminCatalog: '/quan-tri/danh-muc',
  adminDirectory: '/quan-tri/danh-ba',
  adminAudit: '/quan-tri/nhat-ky',
} as const;

/**
 * Chỉ cho vào khi đã có phiên. Chưa đăng nhập ⇒ về trang đăng nhập, và **nhớ
 * trang đang định vào** để quay lại sau (AUTH-1 AC2).
 */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { data: me, isPending, error } = useMe();
  const location = useLocation();

  if (isPending) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: '100vh' }}>
        <Spin size="large" />
      </Flex>
    );
  }

  if (error instanceof ApiError && error.status === 401) {
    sessionStorage.setItem('vpp:returnTo', `${location.pathname}${location.search}`);
    return <Navigate to={routes.signIn} replace />;
  }

  if (error || !me) {
    return <Result status="error" title="Không tải được thông tin tài khoản" />;
  }

  return <>{children}</>;
}

/**
 * Chặn nhân viên vào màn quản trị kể cả khi gõ thẳng URL.
 * Đây chỉ là lớp trải nghiệm — backend mới là nơi thực thi phân quyền (SDD §2).
 */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { data: me } = useMe();
  if (me?.role !== 'admin') {
    return <Result status="403" title="Chỉ quản trị viên mới xem được trang này" />;
  }
  return <>{children}</>;
}

/** Sau khi PMH ID đưa về `/`, nhảy tiếp tới trang người dùng định vào lúc đầu. */
function useReturnToRedirect(): void {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname !== routes.home) return;
    const target = takeReturnTo();
    if (target && target !== routes.home) navigate(target, { replace: true });
  }, [location.pathname, navigate]);
}

export function App() {
  useReturnToRedirect();

  const admin = (element: React.ReactNode) => (
    <RequireAdmin>
      <Suspense fallback={<Spin size="large" style={{ display: 'block', margin: '48px auto' }} />}>
        {element}
      </Suspense>
    </RequireAdmin>
  );

  return (
    <Routes>
      <Route path={routes.signIn} element={<SignInPage />} />
      <Route path={routes.noAccess} element={<NoAccessPage />} />
      <Route
        path="*"
        element={
          <RequireAuth>
            <AppLayout>
              <Routes>
                <Route path={routes.home} element={<HomePage />} />
                <Route path={routes.register} element={<RegisterPage />} />
                <Route path={routes.myRequests} element={<MyRequestsPage />} />

                <Route path={routes.adminDashboard} element={admin(<AdminDashboardPage />)} />
                <Route path={routes.adminRequests} element={admin(<AdminRequestsPage />)} />
                <Route path={routes.adminSummary} element={admin(<AdminSummaryPage />)} />
                <Route path={routes.adminCatalog} element={admin(<AdminCatalogPage />)} />
                <Route path={routes.adminDirectory} element={admin(<AdminDirectoryPage />)} />
                <Route path={routes.adminAudit} element={admin(<AdminAuditPage />)} />

                <Route path="*" element={<Result status="404" title="Không tìm thấy trang" />} />
              </Routes>
            </AppLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

import { Flex, Result, Spin } from 'antd';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { ApiError, takeReturnTo } from './lib/api';
import { useMe } from './lib/queries';
import { HomePage } from './pages/HomePage';
import { MyRequestsPage } from './pages/MyRequestsPage';
import { NoAccessPage } from './pages/NoAccessPage';
import { RegisterPage } from './pages/RegisterPage';
import { SignInPage } from './pages/SignInPage';

/** Đường dẫn tiếng Việt — khớp với chỗ backend redirect về sau khi đăng nhập. */
export const routes = {
  home: '/',
  register: '/dang-ky',
  myRequests: '/don-cua-toi',
  signIn: '/dang-nhap',
  noAccess: '/khong-co-quyen',
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
                <Route path="*" element={<Result status="404" title="Không tìm thấy trang" />} />
              </Routes>
            </AppLayout>
          </RequireAuth>
        }
      />
    </Routes>
  );
}

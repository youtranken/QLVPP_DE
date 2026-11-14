import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import type { ComponentType } from 'react';
import { renderWithI18n, screen, jsonResponse } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/render-app';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

// session-relogin giữ cờ "đang chuyển hướng" ở module → nạp lại module mỗi test
let App: ComponentType;
let navigateTo: ReturnType<typeof vi.fn>;

// "PMH ID" dùng khoảng trắng không ngắt (không để "ID)" lẻ dòng)
const LOGIN_FIELD = 'Email';

describe('App — vào app, tự đăng nhập lại khi phiên hết hạn', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    App = (await import('@/App')).default;
    navigateTo = (await import('@/lib/navigate')).navigateTo as ReturnType<typeof vi.fn>;
    sessionStorage.clear();
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
  });
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('vào / chưa đăng nhập → màn đăng nhập, không thông báo hết hạn', async () => {
    renderWithI18n(<App />);
    expect(await screen.findByLabelText(LOGIN_FIELD)).toBeInTheDocument();
    expect(screen.queryByText(/Phiên đăng nhập đã hết hạn/)).toBeNull();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  // Rà soát 13/11 Gu #13: trang công khai log "401" mỗi lần tải vì boot gọi auth/me
  it('boot gọi GET /api/auth/session; chưa đăng nhập → 204 → màn đăng nhập, không gọi auth/me', async () => {
    const fetchMock = vi.fn((url: string) => Promise.resolve(url === '/api/auth/session' ? new Response(null, { status: 204 }) : jsonResponse(200, { testAccounts: false })));
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<App />);
    expect(await screen.findByLabelText(LOGIN_FIELD)).toBeInTheDocument();
    expect(screen.queryByText(/Phiên đăng nhập đã hết hạn/)).toBeNull();
    const urls = fetchMock.mock.calls.map(([u]) => u);
    expect(urls[0]).toBe('/api/auth/session');
    expect(urls).not.toContain('/api/auth/me');
  });

  // Rà soát fix-rs: boot nạp sớm chunk Nhân viên cho cả khách lạ ở '/' — chỉ nạp sớm khi máy này từng đăng nhập
  it('khách chưa từng đăng nhập ở "/" → boot không tải chunk Nhân viên', async () => {
    localStorage.clear();
    const chunks = await import('@/shell/route-chunks');
    const member = vi.spyOn(chunks.memberChunk, 'preload');
    renderWithI18n(<App />);
    expect(await screen.findByLabelText(LOGIN_FIELD)).toBeInTheDocument();
    expect(member).not.toHaveBeenCalled();
  });

  it('204 sau phiên SSO hết hạn → vẫn tự SSO lại như 401 cũ', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    renderWithI18n(<App />);
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledTimes(1));
  });

  it('api cũ chưa có auth/session (404) → hỏi auth/me như trước', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(url === '/api/auth/session' ? jsonResponse(404, {}) : url === '/api/auth/me' ? jsonResponse(200, makeMe('member')) : jsonResponse(200, { items: [], next_cursor: null })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<App />);
    await vi.waitFor(() => expect(fetchMock.mock.calls.map(([u]) => u)).toContain('/api/auth/me'));
    expect(await screen.findByRole('navigation', { name: /./ })).toBeInTheDocument();
    expect(screen.queryByLabelText(LOGIN_FIELD)).toBeNull();
  });

  it('tab từng SSO + tải lại sau khi hết hạn → chuyển PMH ID, nhớ trang', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    window.history.replaceState(null, '', '/history?ym=2026-11');
    renderWithI18n(<App />);
    expect(await screen.findByText('Đang chuyển sang Tài khoản D&E…')).toBeInTheDocument();
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?ui_locales=vi');
    expect(sessionStorage.getItem('vpp.auth.returnTo')).toBe('/history?ym=2026-11');
  });

  it('StrictMode (effect chạy 2 lần) vẫn giữ returnTo + chế độ SSO', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    window.history.replaceState(null, '', '/me?x=1#h');
    renderWithI18n(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    expect(await screen.findByText('Đang chuyển sang Tài khoản D&E…')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem('vpp.auth.returnTo')).toBe('/me?x=1#h');
    expect(sessionStorage.getItem('vpp.auth.mode')).toBe('sso');
  });

  it('vừa thử tự đăng nhập < 60 s → màn đăng nhập + "Phiên đăng nhập đã hết hạn"', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    sessionStorage.setItem('vpp.auth.reloginAt', String(Date.now() - 1000));
    renderWithI18n(<App />);
    expect(await screen.findByText(/Phiên đăng nhập đã hết hạn/)).toBeInTheDocument();
    expect(sessionStorage.getItem('vpp.auth.mode')).toBeNull();
  });

  it('phiên SA hết hạn → màn đăng nhập (không SSO) + thông báo', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sa');
    renderWithI18n(<App />);
    expect(await screen.findByText(/Phiên đăng nhập đã hết hạn/)).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('mở từ portal PMH ID (?sso=1) chưa có phiên → đi thẳng SSO', async () => {
    window.history.replaceState(null, '', '/?sso=1');
    renderWithI18n(<App />);
    expect(await screen.findByText('Đang chuyển sang Tài khoản D&E…')).toBeInTheDocument();
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?ui_locales=vi');
  });

  describe('mở từ portal PMH ID qua referrer (không có ?sso=1): host cổng lấy từ /api/public-config', () => {
    const withReferrer = (ref: string) =>
      Object.defineProperty(document, 'referrer', { value: ref, configurable: true });
    const stubConfig = (portal: string) =>
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation((url: string) =>
          Promise.resolve(
            url === '/api/public-config'
              ? jsonResponse(200, { admin_contact: '', pmh_portal_url: portal })
              : jsonResponse(401, {}),
          ),
        ),
      );
    afterEach(() => withReferrer(''));

    it('referrer = cổng của môi trường này (dev-admin) → đi thẳng SSO', async () => {
      withReferrer('https://dev-admin.pmh.com.vn:8443/apps');
      stubConfig('https://dev-admin.pmh.com.vn:8443/');
      renderWithI18n(<App />);
      expect(await screen.findByText('Đang chuyển sang Tài khoản D&E…')).toBeInTheDocument();
      expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?ui_locales=vi');
    });

    it('referrer = cổng môi trường khác (de-admin) trên bản dev → màn đăng nhập, không SSO', async () => {
      withReferrer('https://de-admin.pmh.com.vn:8443/');
      stubConfig('https://dev-admin.pmh.com.vn:8443/');
      renderWithI18n(<App />);
      expect(await screen.findByLabelText(LOGIN_FIELD)).toBeInTheDocument();
      expect(navigateTo).not.toHaveBeenCalled();
    });
  });

  it('?login=forbidden → trang chưa được cấp quyền, không tự SSO', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    window.history.replaceState(null, '', '/?login=forbidden&sso=1');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(url === '/api/public-config' ? jsonResponse(200, { admin_contact: 'chị Bình' }) : jsonResponse(401, {})),
      ),
    );
    renderWithI18n(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Tài khoản chưa được cấp quyền dùng VPP Công trình' }),
    ).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('đăng nhập lại thành công → về đúng trang cũ (returnTo) trong khung member', async () => {
    sessionStorage.setItem('vpp.auth.returnTo', '/history?x=1');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url.startsWith('/api/me/requests') || url.startsWith('/api/me/issues') ? jsonResponse(200, { items: [], next_cursor: null }) : jsonResponse(200, makeMe('member')),
        ),
      ),
    );
    renderWithI18n(<App />);
    await vi.waitFor(() => expect(window.location.pathname).toBe('/history'));
    expect(window.location.search).toBe('?x=1');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lịch sử' })).toBeInTheDocument();
    expect(sessionStorage.getItem('vpp.auth.mode')).toBe('sso');
    expect(sessionStorage.getItem('vpp.auth.returnTo')).toBeNull();
  });

  it('/me phiên SSO có locale "en" (claim PMH ID) → app vẽ bằng tiếng Anh, nhớ vpp_lang=en (docs 7a)', async () => {
    localStorage.removeItem('vpp_lang');
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url === '/api/auth/session'
            ? jsonResponse(200, makeMe('member', { locale: 'en', localeUpdatedAt: null, serverTime: Date.now() }))
            : jsonResponse(200, { items: [], next_cursor: null }),
        ),
      ),
    );
    renderWithI18n(<App />);
    await vi.waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(localStorage.getItem('vpp_lang')).toBe('en');
    const { setLanguage, resetLanguageStateForTest } = await import('@/lib/i18n');
    resetLanguageStateForTest();
    await setLanguage('vi');
    sessionStorage.clear();
    localStorage.removeItem('vpp_lang');
  });

  it('/api/auth/session lỗi 500 → báo lỗi hệ thống + Thử lại', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})));
    renderWithI18n(<App />);
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('/api/auth/session 503 SSO_UNAVAILABLE → màn đăng nhập kèm báo PMH ID không liên lạc được, nhập tài khoản nội bộ → bước mật khẩu', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    // PMH ID sập: SA vẫn vào được — kiểm tên tài khoản nội bộ là route công khai của VPP, không cần PMH ID
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(url === '/api/auth/identify' ? jsonResponse(200, { next: 'password' }) : jsonResponse(503, { code: 'SSO_UNAVAILABLE' })),
      ),
    );
    renderWithI18n(<App />);
    expect(
      await screen.findByText(
        'Chưa kết nối được Tài khoản D&E. Quản trị kỹ thuật có thể đăng nhập bằng tài khoản nội bộ.',
      ),
    ).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText(LOGIN_FIELD), 'vpp-sa{Enter}');
    expect(await screen.findByText('vpp-sa')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
  });
});

describe('Adm D&E không có phiếu — route nhân viên chuyển về /admin', () => {
  beforeEach(() => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => {})));
  });

  it.each(['admin', 'sa'] as const)('%s vào /, /history, /history/2026-10, /me → /admin/month', (role) => {
    for (const path of ['/', '/history', '/history/2026-10', '/me']) {
      const { unmount } = renderApp(makeMe(role), path);
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/month');
      unmount();
    }
  });

  it('member vào / ở lại /', () => {
    renderApp(makeMe('member'), '/');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
  });

  it('sidebar Adm D&E không có "Phiếu của tôi"', () => {
    renderApp(makeMe('admin'), '/admin/month');
    expect(screen.getByRole('navigation', { name: 'Menu quản lý' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Phiếu của tôi/ })).toBeNull();
  });

  it('đăng nhập lại về returnTo là route nhân viên mà người là Adm D&E → /admin', async () => {
    vi.resetModules();
    sessionStorage.clear();
    sessionStorage.setItem('vpp.auth.returnTo', '/history?x=1');
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url === '/api/auth/session' ? jsonResponse(200, makeMe('admin')) : new Promise<Response>(() => {}))));
    const Fresh = (await import('@/App')).default;
    renderWithI18n(<Fresh />);
    await vi.waitFor(() => expect(window.location.pathname).toBe('/admin/month'));
    window.history.replaceState(null, '', '/');
  });
});

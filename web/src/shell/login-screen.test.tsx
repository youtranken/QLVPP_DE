import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '@/shell/login-screen';
import { navigateTo } from '@/lib/navigate';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

function at(url: string) {
  window.history.replaceState(null, '', url);
}

afterEach(() => at('/'));

describe('LoginScreen', () => {
  it('nút chính "Đăng nhập bằng tài khoản công ty (PMH ID)" đi thẳng /api/auth/login, không có ô email mặc định', async () => {
    const { container } = renderWithI18n(<LoginScreen />);
    expect(container.querySelector('input[type=email]')).toBeNull();
    await userEvent.click(
      screen.getByRole('button', { name: 'Đăng nhập bằng tài khoản công ty (PMH ID)' }),
    );
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?ui_locales=vi');
    expect(
      screen.getByText('Bạn sẽ được đưa sang trang đăng nhập chung của công ty rồi quay lại đây.'),
    ).toBeInTheDocument();
  });

  it('"Gợi ý tài khoản (tùy chọn)" mở ô email → login?login_hint=', async () => {
    renderWithI18n(<LoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Gợi ý tài khoản (tùy chọn)' }));
    await userEvent.type(screen.getByLabelText('Email công ty'), 'an.nguyen@pmh.com.vn');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục với PMH ID' }));
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?login_hint=an.nguyen%40pmh.com.vn&ui_locales=vi');
  });

  it('"Dành cho IT" mở ô username type=text + mật khẩu; 401 → báo sai tài khoản', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { code: 'UNAUTHENTICATED' }));
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderWithI18n(<LoginScreen />);
    expect(container.querySelector('input[name=username]')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Dành cho IT' }));
    expect(container.querySelector('input[name=username][type=text]')).not.toBeNull();
    await userEvent.type(screen.getByLabelText('Tên tài khoản'), 'vpp-sa');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'sai-mat-khau');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sai tên tài khoản hoặc mật khẩu.');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/sa-login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ username: 'vpp-sa', password: 'sai-mat-khau' }),
      }),
    );
  });

  it('SA bị khóa (429) → báo tạm khóa; đăng nhập đúng → về /', async () => {
    const saResponses = [jsonResponse(429, { code: 'SA_LOGIN_LOCKED' }), jsonResponse(200, { ok: true })];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(url === '/api/auth/sa-login' ? saResponses.shift()! : jsonResponse(200, { testAccounts: false })),
      ),
    );
    renderWithI18n(<LoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Dành cho IT' }));
    await userEvent.type(screen.getByLabelText('Tên tài khoản'), 'vpp-sa');
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tạm khóa do nhập sai nhiều lần');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/'));
  });

  it('?login=failed → báo đăng nhập chưa thành công', () => {
    at('/?login=failed');
    renderWithI18n(<LoginScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('Đăng nhập chưa thành công');
  });

  it('?login=forbidden → trang "Chưa được cấp quyền" lấy admin_contact từ /api/public-config', async () => {
    at('/?login=forbidden');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { admin_contact: 'chị Bình (Adm D&E) — 0909 123 456' }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<LoginScreen />);
    expect(
      screen.getByRole('heading', { name: 'Tài khoản chưa được cấp quyền dùng VPP Công trình' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/chị Bình \(Adm D&E\) — 0909 123 456/)).toBeInTheDocument();
    expect(screen.getByText(/PMH ID chưa cấp quyền vào VPP Công trình cho tài khoản này/)).toBeInTheDocument();
    expect(screen.queryByText(/nhóm/i)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/public-config', undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác' }));
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/switch-account?ui_locales=vi');
    expect(screen.getByRole('link', { name: 'Về trang PMH ID' })).toBeInTheDocument();
  });

  it('forbidden khi admin_contact rỗng → dùng "Adm D&E", không để trống', async () => {
    at('/?login=forbidden');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { admin_contact: '' })));
    renderWithI18n(<LoginScreen />);
    expect(await screen.findByText(/Liên hệ Adm D&E/)).toBeInTheDocument();
  });

  describe('Tài khoản thử (chỉ bản dev)', () => {
    const TITLE = 'Tài khoản thử (chỉ bản dev)';

    function stubConfig(config: Response, login?: Response) {
      const fetchMock = vi.fn((url: string) =>
        Promise.resolve(url === '/api/auth/config' ? config : (login ?? jsonResponse(500, {}))),
      );
      vi.stubGlobal('fetch', fetchMock);
      return fetchMock;
    }

    it('api tắt (testAccounts=false) → không có mục tài khoản thử', async () => {
      const fetchMock = stubConfig(jsonResponse(200, { testAccounts: false }));
      renderWithI18n(<LoginScreen />);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/config', undefined));
      expect(screen.queryByRole('heading', { name: TITLE })).toBeNull();
      expect(screen.queryByLabelText('Tên tài khoản thử')).toBeNull();
    });

    it('api lỗi (404 bản cũ / 500) → không có mục tài khoản thử', async () => {
      const fetchMock = stubConfig(jsonResponse(404, {}));
      renderWithI18n(<LoginScreen />);
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
      expect(screen.queryByRole('heading', { name: TITLE })).toBeNull();
    });

    it('api bật → hiện mục có nhãn rõ; đăng nhập đúng gửi /api/auth/test-login rồi về / (RequireRole chia admin/member)', async () => {
      const fetchMock = stubConfig(jsonResponse(200, { testAccounts: true }), jsonResponse(200, { ok: true }));
      renderWithI18n(<LoginScreen />);
      expect(await screen.findByRole('heading', { name: TITLE })).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Tên tài khoản thử'), ' nv.a ');
      await userEvent.type(screen.getByLabelText('Mật khẩu tài khoản thử'), 'pw');
      await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập tài khoản thử' }));
      await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/'));
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/test-login',
        expect.objectContaining({ method: 'POST', body: JSON.stringify({ username: 'nv.a', password: 'pw' }) }),
      );
    });

    it('api bật, sai mật khẩu (401) → báo sai tài khoản, không chuyển trang', async () => {
      vi.mocked(navigateTo).mockClear();
      stubConfig(jsonResponse(200, { testAccounts: true }), jsonResponse(401, { code: 'TEST_LOGIN_INVALID' }));
      renderWithI18n(<LoginScreen />);
      await userEvent.type(await screen.findByLabelText('Tên tài khoản thử'), 'hc.test');
      await userEvent.type(screen.getByLabelText('Mật khẩu tài khoản thử'), 'sai');
      await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập tài khoản thử' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Sai tên tài khoản hoặc mật khẩu.');
      expect(navigateTo).not.toHaveBeenCalled();
    });
  });
});

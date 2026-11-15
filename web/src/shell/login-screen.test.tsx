import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from '@/shell/login-screen';
import { navigateTo } from '@/lib/navigate';
import { portalFallback } from '@/lib/pmh-portal';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

function at(url: string) {
  window.history.replaceState(null, '', url);
}

beforeEach(() => vi.mocked(navigateTo).mockClear());
afterEach(() => at('/'));

describe('LoginScreen', () => {
  it('khung giống QLTS/QLHS: ảnh tòa nhà, logo PMH, dòng tên app, một ô nhãn "Email" không chữ mờ, chân trang IT Department + bản quyền D&E, không dòng hỗ trợ', () => {
    const { container } = renderWithI18n(<LoginScreen />);
    expect(container.querySelector('.auth-media img')).toHaveAttribute('src', '/login-bg.webp');
    expect(screen.getByRole('img', { name: 'Phú Mỹ Hưng' })).toHaveAttribute('src', '/logo-pmh-on-light.png');
    expect(screen.getByText('QLVPP — Quản lý văn phòng phẩm')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument();
    expect(screen.getByText('Đăng nhập để bắt đầu — nhập email của bạn.')).toBeInTheDocument();
    expect(container.querySelectorAll('input:not([type=hidden])')).toHaveLength(1);
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.queryByText(/Cần hỗ trợ\?/)).toBeNull();
    expect(screen.getByText(`© ${new Date().getFullYear()} Phú Mỹ Hưng · Division D&E`)).toBeInTheDocument();
    expect(screen.getByText('Phát triển bởi IT Department')).toBeInTheDocument();
    // Ô email: nhãn "Email" hiện trên ô, trong ô để trống (không "ten@pmh.com.vn"/"Email công ty")
    const email = screen.getByLabelText('Email');
    expect(email).not.toHaveAttribute('placeholder');
    expect(email).not.toHaveAttribute('aria-label');
    expect(screen.getByText('Email', { selector: 'label' })).toBeVisible();
    expect(screen.queryByText(/Email và tài khoản|ten@pmh\.com\.vn/)).toBeNull();
    // Ảnh/logo có sẵn kích thước → không nhảy bố cục khi ảnh tải xong
    for (const img of container.querySelectorAll('img')) {
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
    }
  });

  it('email → sang PMH ID kèm login_hint (ngôn ngữ đang dùng), không hỏi mật khẩu', async () => {
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), '  an.nguyen@pmh.com.vn ');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?login_hint=an.nguyen%40pmh.com.vn&ui_locales=vi');
    expect(screen.queryByLabelText('Mật khẩu')).toBeNull();
  });

  it('Enter trong ô email cũng gửi (form), tiếng Anh → ui_locales=en', async () => {
    renderWithI18n(<LoginScreen />);
    await userEvent.click(screen.getByRole('radio', { name: 'EN – English' }));
    await userEvent.type(screen.getByLabelText('Email'), 'binh.tran@pmh.com.vn{Enter}');
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?login_hint=binh.tran%40pmh.com.vn&ui_locales=en');
    await userEvent.click(screen.getByRole('radio', { name: 'VI – Tiếng Việt' }));
  });

  it('ô trống như QLTS/QLHS: không sang PMH ID, báo ngay dưới ô (không dùng bóng báo mặc định của trình duyệt)', async () => {
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(navigateTo).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa nhập email.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('đúng tên tài khoản nội bộ IT (server xác nhận qua /api/auth/identify) → bước mật khẩu "Đăng nhập với … Đổi", con mắt hiện/ẩn; 401 → báo sai tài khoản', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url === '/api/auth/sa-login'
          ? jsonResponse(401, { code: 'UNAUTHENTICATED' })
          : url === '/api/auth/identify'
            ? jsonResponse(200, { next: 'password' })
            : jsonResponse(200, { testAccounts: false }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), ' vpp-sa ');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(navigateTo).not.toHaveBeenCalled();
    expect(await screen.findByText('Nhập mật khẩu để đăng nhập.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/identify',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ identifier: 'vpp-sa' }) }),
    );
    expect(screen.getByText('Đăng nhập với')).toBeInTheDocument();
    expect(screen.getByText('vpp-sa')).toBeInTheDocument();
    const password = screen.getByLabelText('Mật khẩu');
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveFocus();
    await userEvent.type(password, 'sai-mat-khau');
    await userEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute('aria-pressed', 'true');
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

  it('không phải email và không phải tài khoản nội bộ (server trả invalid) → báo email không hợp lệ dưới ô, không lộ bước mật khẩu', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(200, url === '/api/auth/identify' ? { next: 'invalid' } : { testAccounts: false })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'applicant1');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email không hợp lệ.');
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByLabelText('Mật khẩu')).toBeNull();
    expect(screen.queryByText('Đăng nhập với')).toBeNull();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('kiểm tên tài khoản lỗi mạng / 429 → báo thử lại, vẫn ở ô email', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url === '/api/auth/identify' ? Promise.reject(new TypeError('offline')) : Promise.resolve(jsonResponse(200, { testAccounts: false })),
      ),
    );
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'it.admin{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Không đăng nhập được — thử lại sau ít phút.');
    expect(screen.queryByLabelText('Mật khẩu')).toBeNull();
  });

  it('kiểm tên tài khoản bị tạm khóa (429, chung ngân sách với mật khẩu SA) → báo tạm khóa, không sang bước mật khẩu', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(url === '/api/auth/identify' ? jsonResponse(429, { code: 'SA_LOGIN_LOCKED' }) : jsonResponse(200, { testAccounts: false })),
      ),
    );
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'it.admin{Enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Tạm khóa do nhập sai nhiều lần');
    expect(screen.queryByLabelText('Mật khẩu')).toBeNull();
  });

  it('đang hỏi server: ô Email chỉ đọc (không sửa được tên đang kiểm); bước mật khẩu dùng đúng tên server đã xác nhận', async () => {
    let answer: (r: Response) => void = () => {};
    const fetchMock = vi.fn((url: string) =>
      url === '/api/auth/identify'
        ? new Promise<Response>((res) => {
            answer = res;
          })
        : Promise.resolve(url === '/api/auth/sa-login' ? jsonResponse(401, {}) : jsonResponse(200, { testAccounts: false })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<LoginScreen />);
    const box = screen.getByLabelText('Email');
    await userEvent.type(box, 'it.admin{Enter}');
    expect(box).toHaveAttribute('readonly');
    await userEvent.type(box, 'xyz');
    expect(box).toHaveValue('it.admin');
    answer(jsonResponse(200, { next: 'password' }));
    expect(await screen.findByText('it.admin')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Mật khẩu'), 'pw{Enter}');
    await screen.findByRole('alert');
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/sa-login', expect.objectContaining({ body: JSON.stringify({ username: 'it.admin', password: 'pw' }) }));
  });

  it('bước mật khẩu: để trống → báo, không gửi; "Đổi" → về ô email (giữ chữ đã gõ, con trỏ ở ô)', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(200, url === '/api/auth/identify' ? { next: 'password' } : { testAccounts: false })),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'it.admin');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Đăng nhập' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Chưa nhập mật khẩu.');
    expect(fetchMock).not.toHaveBeenCalledWith('/api/auth/sa-login', expect.anything());
    await userEvent.click(screen.getByRole('button', { name: 'Đổi' }));
    expect(screen.queryByLabelText('Mật khẩu')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Email')).toHaveValue('it.admin');
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('SA bị khóa (429) → báo tạm khóa; đăng nhập đúng → về /', async () => {
    const saResponses = [jsonResponse(429, { code: 'SA_LOGIN_LOCKED' }), jsonResponse(200, { ok: true })];
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url === '/api/auth/sa-login'
            ? saResponses.shift()!
            : jsonResponse(200, url === '/api/auth/identify' ? { next: 'password' } : { testAccounts: false }),
        ),
      ),
    );
    renderWithI18n(<LoginScreen />);
    await userEvent.type(screen.getByLabelText('Email'), 'vpp-sa');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await userEvent.type(await screen.findByLabelText('Mật khẩu'), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tạm khóa do nhập sai nhiều lần');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/'));
  });

  it('?login=failed → báo đăng nhập chưa thành công trong khung mới, vẫn nhập email để thử lại', async () => {
    at('/?login=failed');
    renderWithI18n(<LoginScreen />);
    expect(screen.getByRole('alert')).toHaveTextContent('Đăng nhập chưa thành công');
    await userEvent.type(screen.getByLabelText('Email'), 'an.nguyen@pmh.com.vn{Enter}');
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?login_hint=an.nguyen%40pmh.com.vn&ui_locales=vi');
  });

  it('PMH ID không liên lạc được / phiên hết hạn → báo trên ô nhập', () => {
    const { unmount } = renderWithI18n(<LoginScreen ssoDown />);
    expect(screen.getByRole('alert')).toHaveTextContent('Tạm thời không kết nối được Tài khoản D&E');
    unmount();
    renderWithI18n(<LoginScreen sessionExpired />);
    expect(screen.getByRole('alert')).toHaveTextContent('Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.');
  });

  it('?login=forbidden → trang "Chưa được cấp quyền" lấy admin_contact từ /api/public-config', async () => {
    at('/?login=forbidden');
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {
          admin_contact: 'chị Bình (Adm D&E) — 0909 123 456',
          pmh_portal_url: 'https://dev-admin.pmh.com.vn:8443/',
        }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderWithI18n(<LoginScreen />);
    expect(
      screen.getByRole('heading', { name: 'Không có quyền truy cập' }),
    ).toBeInTheDocument();
    // Cùng khung đăng nhập (ảnh tòa nhà + logo PMH), không có ô nhập
    expect(container.querySelector('.auth-media img')).not.toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(await screen.findByText(/chị Bình \(Adm D&E\) — 0909 123 456/)).toBeInTheDocument();
    expect(screen.getByText('Tài khoản của bạn không có quyền vào QLVPP. Liên hệ chị Bình (Adm D&E) — 0909 123 456 để được cấp quyền.')).toBeInTheDocument();
    expect(screen.queryByText(/nhóm/i)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/public-config', undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác' }));
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/switch-account?ui_locales=vi');
    // Cổng PMH ID theo issuer của môi trường (dev → dev-admin), không để cứng de-admin
    expect(screen.getByRole('link', { name: 'Về trang Tài khoản D&E' })).toHaveAttribute(
      'href',
      'https://dev-admin.pmh.com.vn:8443/',
    );
  });

  it('forbidden mà /api/public-config lỗi → nút "Về trang PMH ID" vẫn có href (suy từ host), không chết', async () => {
    at('/?login=forbidden');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})));
    renderWithI18n(<LoginScreen />);
    await screen.findByText(/Liên hệ Adm D&E/);
    expect(screen.getByRole('link', { name: 'Về trang Tài khoản D&E' })).toHaveAttribute('href', portalFallback());
  });

  it('portalFallback: cổng cùng môi trường theo host VPP', () => {
    expect(portalFallback({ protocol: 'https:', hostname: 'dev-vpp.pmh.com.vn', port: '8443' })).toBe('https://dev-admin.pmh.com.vn:8443/');
    expect(portalFallback({ protocol: 'https:', hostname: 'de-vpp.pmh.com.vn', port: '' })).toBe('https://de-admin.pmh.com.vn/');
    expect(portalFallback({ protocol: 'http:', hostname: 'localhost', port: '5173' })).toBe('https://de-admin.pmh.com.vn:8443/');
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

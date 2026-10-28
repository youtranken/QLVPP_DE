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
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login');
    expect(
      screen.getByText('Bạn sẽ được đưa sang trang đăng nhập chung của công ty rồi quay lại đây.'),
    ).toBeInTheDocument();
  });

  it('"Gợi ý tài khoản (tùy chọn)" mở ô email → login?login_hint=', async () => {
    renderWithI18n(<LoginScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Gợi ý tài khoản (tùy chọn)' }));
    await userEvent.type(screen.getByLabelText('Email công ty'), 'an.nguyen@pmh.com.vn');
    await userEvent.click(screen.getByRole('button', { name: 'Tiếp tục với PMH ID' }));
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login?login_hint=an.nguyen%40pmh.com.vn');
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
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(429, { code: 'SA_LOGIN_LOCKED' }))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true })),
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
      .mockResolvedValue(jsonResponse(200, { admin_contact: 'chị Bình (Hành chính) — 0909 123 456' }));
    vi.stubGlobal('fetch', fetchMock);
    renderWithI18n(<LoginScreen />);
    expect(
      screen.getByRole('heading', { name: 'Tài khoản chưa được cấp quyền dùng VPP Công trình' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/chị Bình \(Hành chính\) — 0909 123 456/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/public-config', undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập bằng tài khoản khác' }));
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/switch-account');
    expect(screen.getByRole('link', { name: 'Về trang PMH ID' })).toBeInTheDocument();
  });

  it('forbidden khi admin_contact rỗng → dùng "Hành chính phòng Công trình", không để trống', async () => {
    at('/?login=forbidden');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { admin_contact: '' })));
    renderWithI18n(<LoginScreen />);
    expect(await screen.findByText(/Liên hệ Hành chính phòng Công trình/)).toBeInTheDocument();
  });
});

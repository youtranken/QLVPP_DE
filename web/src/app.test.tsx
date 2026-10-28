import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode } from 'react';
import type { ComponentType } from 'react';
import { renderWithI18n, screen, jsonResponse } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

// session-relogin giữ cờ "đang chuyển hướng" ở module → nạp lại module mỗi test
let App: ComponentType;
let navigateTo: ReturnType<typeof vi.fn>;

const PRIMARY = 'Đăng nhập bằng tài khoản công ty (PMH ID)';

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
    expect(await screen.findByRole('button', { name: PRIMARY })).toBeInTheDocument();
    expect(screen.queryByText(/Phiên đã hết hạn/)).toBeNull();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('tab từng SSO + tải lại sau khi hết hạn → chuyển PMH ID, nhớ trang', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    window.history.replaceState(null, '', '/history?ym=2026-11');
    renderWithI18n(<App />);
    expect(await screen.findByText('Đang chuyển sang PMH ID…')).toBeInTheDocument();
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login');
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
    expect(await screen.findByText('Đang chuyển sang PMH ID…')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionStorage.getItem('vpp.auth.returnTo')).toBe('/me?x=1#h');
    expect(sessionStorage.getItem('vpp.auth.mode')).toBe('sso');
  });

  it('vừa thử tự đăng nhập < 60 s → màn đăng nhập + "Phiên đã hết hạn"', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    sessionStorage.setItem('vpp.auth.reloginAt', String(Date.now() - 1000));
    renderWithI18n(<App />);
    expect(await screen.findByText(/Phiên đã hết hạn/)).toBeInTheDocument();
    expect(sessionStorage.getItem('vpp.auth.mode')).toBeNull();
  });

  it('phiên SA hết hạn → màn đăng nhập (không SSO) + thông báo', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sa');
    renderWithI18n(<App />);
    expect(await screen.findByText(/Phiên đã hết hạn/)).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('mở từ portal PMH ID (?sso=1) chưa có phiên → đi thẳng SSO', async () => {
    window.history.replaceState(null, '', '/?sso=1');
    renderWithI18n(<App />);
    expect(await screen.findByText('Đang chuyển sang PMH ID…')).toBeInTheDocument();
    expect(navigateTo).toHaveBeenCalledWith('/api/auth/login');
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
          url.startsWith('/api/me/requests') ? jsonResponse(200, { items: [], next_cursor: null }) : jsonResponse(200, makeMe('member')),
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

  it('/api/auth/me lỗi 500 → báo lỗi hệ thống + Thử lại', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(500, {})));
    renderWithI18n(<App />);
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('/api/auth/me 503 SSO_UNAVAILABLE → màn đăng nhập kèm báo PMH ID không liên lạc được, mở được form SA', async () => {
    sessionStorage.setItem('vpp.auth.mode', 'sso');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(503, { code: 'SSO_UNAVAILABLE' })));
    renderWithI18n(<App />);
    expect(
      await screen.findByText(
        'PMH ID tạm thời không liên lạc được. Quản trị kỹ thuật có thể đăng nhập bằng tài khoản nội bộ.',
      ),
    ).toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Dành cho IT' }));
    expect(screen.getByLabelText('Tên tài khoản')).toBeInTheDocument();
    expect(screen.getByLabelText('Mật khẩu')).toBeInTheDocument();
  });
});

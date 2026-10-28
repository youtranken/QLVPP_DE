import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { navigateTo } from '@/lib/navigate';
import { jsonResponse } from '@/test/test-utils';
import { setLanguage } from '@/lib/i18n';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

afterEach(async () => {
  await setLanguage('vi');
  localStorage.clear();
});

describe('Trang Tôi', () => {
  it('hiện hồ sơ: họ tên, email, phòng ban, mã nhân viên, vai trò', () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/me');
    expect(screen.getByRole('heading', { level: 1, name: 'Tôi' })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(screen.getByText('an.nguyen@pmh.com.vn')).toBeInTheDocument();
    expect(screen.getByText('Phòng Công trình')).toBeInTheDocument();
    expect(screen.getByText('NV0231')).toBeInTheDocument();
    expect(screen.getByText('Nhân viên')).toBeInTheDocument();
  });

  it('đổi sang English → nhãn đổi và lưu lựa chọn', async () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/me');
    await userEvent.click(screen.getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Me' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(localStorage.getItem('vpp_lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
  });

  it('Đăng xuất gửi POST /api/auth/logout kèm X-CSRF-Token rồi về /', async () => {
    mockViewport(390);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderApp(makeMe('member'), '/me');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/'));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it('Hành chính thấy nút mở trang quản lý', () => {
    mockViewport(390);
    renderApp(makeMe('admin'), '/me');
    expect(screen.getByRole('link', { name: 'Mở trang quản lý' })).toHaveAttribute('href', '/admin');
    expect(screen.getByText('Hành chính')).toBeInTheDocument();
  });
});

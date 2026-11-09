import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
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
    expect(screen.getByText('Phòng Công trình · Nhân viên')).toBeInTheDocument();
    expect(screen.getByText('NV0231')).toBeInTheDocument();
    expect(screen.queryByText(/PMH ID/)).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('Đăng xuất gửi POST /api/auth/logout kèm X-CSRF-Token rồi về /', async () => {
    mockViewport(390);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderApp(makeMe('member'), '/me');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/'));
    const [url, init] = fetchMock.mock.calls.find(([u]) => u === '/api/auth/logout') as [string, RequestInit];
    expect(url).toBe('/api/auth/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it.each([
    ['403 CSRF_TOKEN_INVALID', () => Promise.resolve(jsonResponse(403, { code: 'CSRF_TOKEN_INVALID' }))],
    ['500', () => Promise.resolve(jsonResponse(500, null))],
    ['lỗi mạng', () => Promise.reject(new TypeError('Failed to fetch'))],
  ])('Đăng xuất thất bại (%s) → báo "Chưa đăng xuất được — thử lại.", ở lại trang, bấm lại được', async (_name, respond) => {
    mockViewport(390);
    vi.mocked(navigateTo).mockClear();
    vi.stubGlobal('fetch', vi.fn(respond));
    renderApp(makeMe('member'), '/me');
    const button = screen.getByRole('button', { name: 'Đăng xuất' });
    await userEvent.click(button);
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đăng xuất được — thử lại.');
    expect(navigateTo).not.toHaveBeenCalled();
    expect(button).toBeEnabled();
  });

  it('/me vẫn mở được (liên kết cũ) và hiện cùng nội dung AccountContent: Email, Mã nhân viên, Đăng xuất danger', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/me');
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Mã nhân viên')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('radiogroup')).toBeNull();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveClass('btn--danger');
  });
});

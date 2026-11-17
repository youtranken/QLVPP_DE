import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { submitForm } from '@/lib/navigate';
import { endLogout } from '@/lib/session-relogin';
import { jsonResponse } from '@/test/test-utils';
import { setLanguage } from '@/lib/i18n';

vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn(), submitForm: vi.fn() }));

afterEach(async () => {
  await setLanguage('vi');
  localStorage.clear();
  endLogout();
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
    expect(screen.queryByText(/Tài khoản D&E/, { ignore: 'button' })).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('có đổi ngôn ngữ (thanh trên điện thoại không còn VI/EN): chọn English thì trang đổi sang tiếng Anh', async () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/me');
    const group = within(screen.getByRole('main')).getByRole('radiogroup', { name: 'Ngôn ngữ' });
    await userEvent.click(within(group).getByRole('radio', { name: 'English' }));
    expect(await screen.findByRole('radiogroup', { name: 'Language' })).toBeInTheDocument();
  });

  it('Đăng xuất: gửi form POST /api/auth/logout với csrf + ui_locales — không fetch, JS không thấy đích chuyển hướng', async () => {
    mockViewport(390);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    renderApp(makeMe('member'), '/me');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(submitForm).toHaveBeenCalledWith('/api/auth/logout', { csrf: 'csrf-1', ui_locales: 'vi' });
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/auth/logout'))).toBe(false);
  });

  it('/me vẫn mở được (liên kết cũ) và hiện cùng nội dung AccountContent: Email, Mã nhân viên, Đăng xuất danger', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/me');
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Mã nhân viên')).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('radiogroup', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveClass('btn--danger');
  });
});

import { describe, expect, it } from 'vitest';
import { screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

describe('MemberShell', () => {
  it('390 px: thanh dưới "Điều hướng chính" có đúng 3 mục Đăng ký · Lịch sử · Tôi, không có tab trên', () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((a) => a.textContent)).toEqual(['Đăng ký', 'Lịch sử', 'Tôi']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/history', '/me']);
    expect(screen.queryByRole('navigation', { name: 'Chuyển trang' })).toBeNull();
  });

  it('1280 px: tab trên Đăng ký · Lịch sử, không có thanh dưới', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    const tabs = screen.getByRole('navigation', { name: 'Chuyển trang' });
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Đăng ký', 'Lịch sử']);
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tôi' })).toHaveAttribute('href', '/me');
  });

  it('mục đang ở được đánh dấu aria-current', () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/history');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Đăng ký' })).not.toHaveAttribute('aria-current');
  });

  it('member không thấy lối vào trang quản lý; Hành chính thấy "Quản lý VPP"', () => {
    mockViewport(1280);
    const { unmount } = renderApp(makeMe('member'), '/');
    expect(screen.queryByRole('link', { name: 'Quản lý VPP' })).toBeNull();
    unmount();
    renderApp(makeMe('admin'), '/');
    expect(screen.getByRole('link', { name: 'Quản lý VPP' })).toHaveAttribute('href', '/admin');
  });

  it('Lịch sử chưa làm hiện thẻ "Sắp có"', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/history');
    expect(screen.getByText('Sắp có')).toBeInTheDocument();
  });
});

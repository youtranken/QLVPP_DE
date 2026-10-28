import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

afterEach(() => vi.unstubAllGlobals());

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
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
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

  it('/history là trang Lịch sử thật, không còn "Sắp có"', async () => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Chưa có phiếu nào')).toBeInTheDocument();
    expect(screen.queryByText('Sắp có')).toBeNull();
  });

  it('390 px: ở /history/:ym mục "Lịch sử" vẫn sáng', () => {
    mockViewport(390);
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    renderApp(makeMe('member'), '/history/2026-10');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
  });
});

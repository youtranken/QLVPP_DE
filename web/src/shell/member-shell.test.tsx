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
    expect(within(tabs).getAllByRole('link').map((a) => a.textContent)).toEqual(['Đăng ký', 'Lịch sử', 'Tôi']);
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tôi' })).toHaveAttribute('href', '/me');
  });

  it.each([
    [900, true],
    [901, false],
  ])('mốc %i px: thanh dưới = %s, tab trên ngược lại', (width, bottom) => {
    mockViewport(width);
    renderApp(makeMe('member'), '/');
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' }) !== null).toBe(bottom);
    expect(screen.queryByRole('navigation', { name: 'Chuyển trang' }) !== null).toBe(!bottom);
  });

  it('mục đang ở được đánh dấu aria-current', () => {
    mockViewport(390);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    renderApp(makeMe('member'), '/history');
    const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
    expect(within(nav).getByRole('link', { name: 'Lịch sử' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Đăng ký' })).not.toHaveAttribute('aria-current');
  });

  it('1280 px: tab "Đăng ký" có aria-current=page ở /, các tab khác không', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    const tabs = screen.getByRole('navigation', { name: 'Chuyển trang' });
    expect(within(tabs).getByRole('link', { name: 'Đăng ký' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Lịch sử' })).not.toHaveAttribute('aria-current');
    expect(within(tabs).getByRole('link', { name: 'Tôi' })).not.toHaveAttribute('aria-current');
  });

  it('1280 px: khối avatar hiện chữ đầu, tên và phòng; 390 px chỉ còn chữ đầu', () => {
    mockViewport(1280);
    const { unmount } = renderApp(makeMe('member'), '/');
    const banner = screen.getByRole('banner');
    expect(within(banner).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(banner).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(banner).getByText('NA')).toBeInTheDocument();
    unmount();
    mockViewport(390);
    renderApp(makeMe('member'), '/');
    expect(within(screen.getByRole('banner')).queryByText('Phòng Công trình')).toBeNull();
    expect(within(screen.getByRole('banner')).getByText('NA')).toBeInTheDocument();
  });

  it('member không thấy lối vào trang quản lý', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/');
    expect(screen.queryByRole('link', { name: 'Quản lý VPP' })).toBeNull();
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

  it.each([390, 1280])('%i px: chuông thông báo nằm ở thanh trên, thanh dưới vẫn 3 mục', (width) => {
    mockViewport(width);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 3 }))));
    renderApp(makeMe('member'), '/history');
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }));
    if (width === 390) {
      const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' });
      expect(within(nav).getAllByRole('link')).toHaveLength(3);
    }
  });
});

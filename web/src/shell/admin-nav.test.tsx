import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const MONTHLY = ['Kỳ tháng', 'Gửi ADM', 'Hàng về', 'Giao hàng', 'Còn nợ', 'Báo cáo & in'];
const MONTHLY_PATHS = ['/admin/month', '/admin/send-adm', '/admin/arrivals', '/admin/delivery', '/admin/backlog', '/admin/reports'];

const sideNav = () => screen.getByRole('navigation', { name: 'Menu quản lý' });

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Menu theo luồng chuẩn', () => {
  it.each([1280, 390])('%ipx: nhóm "Hằng tháng" đúng 6 mục theo thứ tự, luôn mở; không còn nhóm "Xem lại sau"', async (width) => {
    mockViewport(width);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    if (width === 390) await userEvent.click(await screen.findByRole('button', { name: 'Mở menu quản lý' }));
    const monthly = within(await screen.findByRole('navigation', { name: 'Menu quản lý' })).getByRole('group', { name: 'Hằng tháng' });
    const links = within(monthly).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('title'))).toEqual(MONTHLY);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(MONTHLY_PATHS);
    expect(within(sideNav()).queryByRole('group', { name: 'Xem lại sau' })).toBeNull();
    expect(within(sideNav()).queryByRole('button', { name: 'Xem lại sau' })).toBeNull();
    expect(within(sideNav()).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Hằng tháng', 'Danh mục và tủ', 'Quản lý']);
  });

  it('Kỳ tháng, Còn nợ, Báo cáo mỗi trang xuất hiện đúng một lần trong menu', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/month');
    for (const name of ['Kỳ tháng', 'Còn nợ', 'Báo cáo & in']) expect(within(sideNav()).getAllByRole('link', { name })).toHaveLength(1);
  });

  it('sidebar ghi "Sản phẩm" và "Danh mục" (không còn "Danh mục món", "Nhóm & đơn vị")', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(within(sideNav()).getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('aria-current', 'page');
    expect(within(sideNav()).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('href', '/admin/categories');
    expect(within(sideNav()).queryByText('Danh mục món')).toBeNull();
    expect(within(sideNav()).queryByText('Nhóm & đơn vị')).toBeNull();
  });
});

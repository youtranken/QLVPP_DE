import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const MONTHLY = ['Kỳ tháng', 'Báo cáo & gửi NCC', 'Nhận hàng', 'Giao hàng', 'Còn nợ'];
const MONTHLY_PATHS = ['/admin/month', '/admin/reports', '/admin/arrivals', '/admin/delivery', '/admin/backlog'];

const sideNav = () => screen.getByRole('navigation', { name: 'Menu quản lý' });

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('Menu theo luồng chuẩn', () => {
  it.each([1280, 390])('%ipx: nhóm "Hằng tháng" đúng 5 mục theo thứ tự, luôn mở; không còn nhóm "Xem lại sau"', async (width) => {
    mockViewport(width);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    if (width === 390) await userEvent.click(await screen.findByRole('button', { name: 'Mở menu quản lý' }));
    const monthly = within(await screen.findByRole('navigation', { name: 'Menu quản lý' })).getByRole('group', { name: 'Hằng tháng' });
    const links = within(monthly).getAllByRole('link');
    expect(links.map((a) => a.querySelector('.side__label')?.textContent)).toEqual(MONTHLY);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(MONTHLY_PATHS);
    expect(within(sideNav()).queryByRole('group', { name: 'Xem lại sau' })).toBeNull();
    expect(within(sideNav()).queryByRole('button', { name: 'Xem lại sau' })).toBeNull();
    expect(within(sideNav()).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Hằng tháng', 'Danh mục và tủ', 'Quản lý']);
  });

  it('Kỳ tháng, Còn nợ, Báo cáo & gửi NCC mỗi trang xuất hiện đúng một lần trong menu', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/month');
    for (const name of ['Kỳ tháng', 'Còn nợ', 'Báo cáo & gửi NCC']) expect(within(sideNav()).getAllByRole('link', { name })).toHaveLength(1);
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

  it('AD-38: không còn mục "Xuất lẻ" (gộp vào Tủ / Kho); sau "Tủ / Kho" là "Danh mục"', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    const group = within(sideNav()).getByRole('group', { name: 'Danh mục và tủ' });
    const labels = within(group).getAllByRole('link').map((a) => a.querySelector('.side__label')?.textContent);
    expect(labels).not.toContain('Xuất lẻ');
    expect(labels[labels.indexOf('Tủ / Kho') + 1]).toBe('Danh mục');
  });

  it('G8: không còn mục "Món ngoài danh mục"; /admin/review chuyển về Kỳ tháng lọc "Có món chờ duyệt" ở kỳ cũ nhất còn món chờ', async () => {
    mockViewport(1280);
    stubShellApi({
      '/api/admin/review?status=pending': () => jsonResponse(200, { items: [{ line_id: 'l1', period_ym: '2026-10' }, { line_id: 'l2', period_ym: '2026-09' }] }),
    });
    renderApp(makeMe('admin'), '/admin/review');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/month'));
    expect(screen.getByTestId('location-search')).toHaveTextContent('ym=2026-09');
    expect(screen.getByTestId('location-search')).toHaveTextContent('chip=pending');
    expect(within(sideNav()).queryByRole('link', { name: /^Món ngoài danh mục/ })).toBeNull();
  });
});


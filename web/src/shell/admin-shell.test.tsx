import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const NAV_ORDER = [
  'Tổng hợp kỳ',
  'Món ngoài danh mục',
  'Giao hàng',
  'Còn nợ',
  'Báo cáo & in',
  'Kho',
  'Danh mục',
  'Nhóm món',
  'Danh bạ',
  'Nhật ký',
  'Cấu hình',
];

const sideNav = () => screen.getByRole('navigation', { name: 'Menu quản lý' });
const linkLabels = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((a) => a.getAttribute('title'));

afterEach(() => vi.unstubAllGlobals());

describe('AdminShell + RequireRole', () => {
  it('role member vào /admin/catalog → chuyển về /', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('member'), '/admin/catalog');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('navigation', { name: 'Menu quản lý' })).toBeNull();
  });

  it.each(['admin', 'sa'] as const)('role %s: sidebar 3 nhóm, đúng 11 mục theo thứ tự SPEC §4.1, mục đang chọn aria-current, không "Phiếu của tôi"', (role) => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe(role), '/admin/catalog');
    const side = sideNav();
    expect(within(side).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Hằng tháng', 'Kho & danh mục', 'Hệ thống']);
    expect(linkLabels(side)).toEqual(NAV_ORDER);
    expect(within(side).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('aria-current', 'page');
    expect(within(side).getAllByRole('link').filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Phiếu của tôi/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeInTheDocument();
  });

  it('Nhóm món là mục sidebar riêng: /admin/categories đánh dấu "Nhóm món"', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/categories');
    expect(within(sideNav()).getByRole('link', { name: 'Nhóm món' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Nhóm món' })).toBeInTheDocument();
  });

  it('/admin chuyển tới /admin/summary', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/summary');
    expect(screen.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeInTheDocument();
  });

  it('chuông nằm ở hàng thương hiệu (banner) của sidebar, cạnh "VPP Công trình" / "Hành chính"', async () => {
    mockViewport(1280);
    stubShellApi({
      '/api/me/notifications?unread=true&limit=1': () => jsonResponse(200, { items: [], next_cursor: null, unread_count: 2 }),
    });
    renderApp(makeMe('admin'), '/admin/summary');
    // jsdom coi <header> trong <main> (PageHeader) cũng là banner; trình duyệt thì không
    const banner = screen.getAllByRole('banner')[0];
    expect(banner).not.toBe(screen.getByRole('heading', { level: 1 }).closest('header'));
    expect(banner).toHaveTextContent('VPP Công trình');
    expect(await within(banner).findByRole('button', { name: 'Thông báo, 2 chưa đọc' })).toBeInTheDocument();
  });

  it('có liên kết "Tới nội dung" trỏ #main, vùng nội dung có id main', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/summary');
    expect(screen.getByRole('link', { name: 'Tới nội dung' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('767 px: không có sidebar, nút "Mở menu quản lý" mở hộp thoại liệt kê đủ 11 mục', async () => {
    mockViewport(767);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(screen.queryByRole('navigation', { name: 'Menu quản lý' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu quản lý' });
    expect(linkLabels(within(dialog).getByRole('navigation', { name: 'Menu quản lý' }))).toEqual(NAV_ORDER);
    await userEvent.click(within(dialog).getByRole('link', { name: 'Kho' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/stock');
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });

  it('768 px: có sidebar (thu thành cột icon bằng CSS), không có nút mở menu', () => {
    mockViewport(768);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(sideNav()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở menu quản lý' })).toBeNull();
  });
});

describe('AdminShell: mất vai Hành chính giữa chừng (FORBIDDEN_ROLE)', () => {
  it('API trả 403 FORBIDDEN_ROLE trên /admin/catalog → "Trang này dành cho Hành chính.", không màn trắng, không toast', async () => {
    mockViewport(1280);
    stubShellApi({ '/api/admin/items': () => jsonResponse(403, { code: 'FORBIDDEN_ROLE', message: 'x' }) });
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(await screen.findByRole('heading', { level: 1, name: 'Trang này dành cho Hành chính.' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Danh mục' })).toBeNull();
    expect(sideNav()).toBeInTheDocument();
    const toastHosts = screen.getAllByRole('status').filter((el) => el.tagName !== 'OUTPUT');
    expect(toastHosts.map((el) => el.textContent)).toEqual(['']);
  });

  it('403 mã khác (không phải FORBIDDEN_ROLE) → trang tự xử lý, không thay bằng NoPermission', async () => {
    mockViewport(1280);
    const f = stubShellApi({ '/api/admin/items': () => jsonResponse(403, { code: 'CSRF_INVALID' }) });
    renderApp(makeMe('admin'), '/admin/catalog');
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).startsWith('/api/admin/items'))).toBe(true));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.queryByText('Trang này dành cho Hành chính.')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeInTheDocument();
  });
});

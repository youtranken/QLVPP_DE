import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const NAV_ORDER = ['Kỳ tháng', 'Báo cáo & gửi ADM', 'Hàng về', 'Giao hàng', 'Còn nợ', 'Sản phẩm', 'Tủ / Kho', 'Món ngoài danh mục', 'Danh mục', 'Nhân viên', 'Nhật ký', 'Cấu hình'];

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

  it.each(['admin', 'sa'] as const)('role %s: sidebar 3 nhóm, 12 mục theo luồng chuẩn, mục đang chọn aria-current, không "Phiếu của tôi"', (role) => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe(role), '/admin/catalog');
    const side = sideNav();
    expect(within(side).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Hằng tháng', 'Danh mục và tủ', 'Quản lý']);
    expect(linkLabels(side)).toEqual(NAV_ORDER);
    expect(within(side).getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('aria-current', 'page');
    expect(within(side).getAllByRole('link').filter((a) => a.hasAttribute('aria-current'))).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Phiếu của tôi/ })).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeInTheDocument();
  });

  it('"Danh mục" là mục sidebar riêng: /admin/categories đánh dấu mục đó', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/categories');
    expect(within(sideNav()).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeInTheDocument();
  });

  it('/admin chuyển tới /admin/month (trang Kỳ tháng)', async () => {
    mockViewport(1280);
    const kpi = { registered: 30, headcount: 40, is_open: false, unregistered: 0, lines_pending_delivery: 0 };
    stubShellApi({
      '/api/admin/periods/2026-11/summary': () => jsonResponse(200, { ...kpi, is_open: true }),
      '/api/admin/periods/2026-10/summary': () => jsonResponse(200, kpi),
      '/api/admin/periods/2026-10/send-state': () => jsonResponse(200, { state: 'unsent', no_order_at: null, no_order_by_name: null, sent: null, changed_after: false, changed_at: null }),
      '/api/admin/periods/2026-10/arrivals-plan': () => jsonResponse(200, { snapshot: null, batches: [], rows: [], custom: [], makeup: [] }),
    });
    renderApp(makeMe('admin'), '/admin');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/month');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 10' })).toBeInTheDocument();
    expect(within(sideNav()).getByRole('link', { name: 'Kỳ tháng' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/admin/month', '/admin/config'])('%s tự dựng đầu trang: đúng một h1, shell không dựng h1 riêng', async (path) => {
    mockViewport(1280);
    stubShellApi({ '/api/admin/config': () => jsonResponse(500, { code: 'INTERNAL' }) });
    renderApp(makeMe('admin'), path);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('chuông (có số chưa đọc) nằm ở khối người dùng cuối sidebar', async () => {
    mockViewport(1280);
    stubShellApi({
      '/api/me/notifications?unread=true&limit=1': () => jsonResponse(200, { items: [], next_cursor: null, unread_count: 2 }),
    });
    const { container } = renderApp(makeMe('admin'), '/admin/month');
    const user = container.querySelector<HTMLElement>('.side__user')!;
    expect(await within(user).findByRole('button', { name: 'Thông báo, 2 chưa đọc' })).toBeInTheDocument();
  });

  it('có liên kết "Tới nội dung" trỏ #main, vùng nội dung có id main', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/month');
    expect(screen.getByRole('link', { name: 'Tới nội dung' })).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('nội dung trang nằm trong khung panel', () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/month');
    expect(screen.getByRole('main').querySelector('.shell__panel')).not.toBeNull();
  });

  it('767 px: không có sidebar, nút "Mở menu quản lý" mở hộp thoại liệt kê đủ 12 mục', async () => {
    mockViewport(767);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(screen.queryByRole('navigation', { name: 'Menu quản lý' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu quản lý' });
    expect(linkLabels(within(dialog).getByRole('navigation', { name: 'Menu quản lý' }))).toEqual(NAV_ORDER);
    await userEvent.click(within(dialog).getByRole('link', { name: 'Tủ / Kho' }));
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
    expect(screen.queryByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeNull();
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
    expect(screen.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeInTheDocument();
  });
});

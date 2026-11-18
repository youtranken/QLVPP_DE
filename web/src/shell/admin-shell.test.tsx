import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const NAV_ORDER = ['Việc hôm nay', 'Kỳ tháng', 'Báo cáo & gửi NCC', 'Nhận hàng', 'Giao hàng', 'Còn nợ', 'Sản phẩm', 'Tủ / Kho', 'Danh mục', 'Danh bạ', 'Nhật ký', 'Cấu hình'];

const sideNav = () => screen.getByRole('navigation', { name: 'Menu quản lý' });
const linkLabels = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((a) => a.querySelector('.side__label')?.textContent);

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

  it('/admin chuyển tới /admin/today (Việc hôm nay, TC-06)', async () => {
    mockViewport(1280);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/today');
    expect(await screen.findByRole('heading', { level: 1, name: /Nguyễn Văn An/ })).toBeInTheDocument();
    expect(within(sideNav()).getByRole('link', { name: 'Việc hôm nay' })).toHaveAttribute('aria-current', 'page');
  });

  it.each(['/admin/month', '/admin/config'])('%s tự dựng đầu trang: đúng một h1, shell không dựng h1 riêng', async (path) => {
    mockViewport(1280);
    stubShellApi({ '/api/admin/config': () => jsonResponse(500, { code: 'INTERNAL' }) });
    renderApp(makeMe('admin'), path);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('chuông (có số chưa đọc) nằm ở khối người dùng trên thanh trên', async () => {
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

  it('360×640: chân menu điện thoại một hàng — VI/EN ngắn và Đăng xuất là nút biểu tượng (còn chỗ cho mục điều hướng)', async () => {
    mockViewport(360, { height: 640 });
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu quản lý' });
    const user = within(dialog).getByRole('group', { name: 'Tài khoản và ngôn ngữ' });
    expect(user).toHaveAttribute('data-layout', 'low');
    expect(within(user).getByRole('radio', { name: 'VI – Tiếng Việt' })).toHaveTextContent('VI');
    const logout = within(user).getByRole('button', { name: 'Đăng xuất' });
    expect(logout).toHaveTextContent(/^$/);
  });

  it('360×800: chân menu điện thoại giữ dạng đủ chữ (Tiếng Việt / English, nút Đăng xuất có chữ)', async () => {
    mockViewport(360, { height: 800 });
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const dialog = screen.getByRole('dialog', { name: 'Menu quản lý' });
    expect(within(dialog).getByRole('radio', { name: 'Tiếng Việt' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Đăng xuất' })).toHaveTextContent('Đăng xuất');
  });

  it('768 px: có sidebar (thu thành cột icon bằng CSS), không có nút mở menu', () => {
    mockViewport(768);
    stubShellApi();
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(sideNav()).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở menu quản lý' })).toBeNull();
  });
});

describe('AdminShell: mất vai Adm D&E giữa chừng (FORBIDDEN_ROLE)', () => {
  it('API trả 403 FORBIDDEN_ROLE trên /admin/catalog → "Trang này dành cho Adm D&E.", không màn trắng, không toast', async () => {
    mockViewport(1280);
    stubShellApi({ '/api/admin/items': () => jsonResponse(403, { code: 'FORBIDDEN_ROLE', message: 'x' }) });
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(await screen.findByRole('heading', { level: 1, name: 'Trang này dành cho Adm D&E.' })).toBeInTheDocument();
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
    expect(screen.queryByText('Trang này dành cho Adm D&E.')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeInTheDocument();
  });
});

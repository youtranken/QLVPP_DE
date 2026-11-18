import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

// thanh trên trắng ≥ 768 — đường dẫn "QLVPP › trang", chuông và tài khoản ở bên phải; sidebar không còn khối người dùng
function open(path: string, width = 1280) {
  mockViewport(width);
  stubShellApi({}, () => jsonResponse(500, { code: 'INTERNAL' }));
  renderApp(makeMe('admin'), path);
}
// jsdom tính cả <header> tiêu đề trang là banner: thanh trên là banner đầu tiên
const header = () => screen.getAllByRole('banner')[0];

afterEach(() => vi.unstubAllGlobals());

describe('AdminHeader ≥ 768 (TC-01)', () => {
  it('1280: đường dẫn "QLVPP › Sản phẩm" (QLVPP là liên kết về /admin), trang hiện tại aria-current', async () => {
    open('/admin/catalog');
    const crumb = within(header()).getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumb).getByRole('link', { name: 'QLVPP' })).toHaveAttribute('href', '/admin');
    expect(within(crumb).getByText('Sản phẩm')).toHaveAttribute('aria-current', 'page');
  });

  it('1280: chuông và nút Đăng xuất nằm ở thanh trên, không còn trong sidebar', async () => {
    open('/admin/catalog');
    expect(await within(header()).findByRole('button', { name: /^Thông báo/ })).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    const side = screen.getByRole('navigation', { name: 'Menu quản lý' }).closest('.side')!;
    expect(within(side as HTMLElement).queryByRole('button', { name: 'Đăng xuất' })).toBeNull();
  });

  it('1024 (cột icon): bấm ảnh đại diện trên thanh trên mở hộp có VI/EN và Đăng xuất', async () => {
    open('/admin/catalog', 1024);
    await userEvent.click(within(header()).getByRole('button', { name: 'Tài khoản và ngôn ngữ' }));
    expect(within(header()).getByRole('radio', { name: 'Tiếng Việt' })).toBeInTheDocument();
    expect(within(header()).getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
  });

  it('sidebar: logo là ảnh QLVPP, không còn chữ "V"', () => {
    open('/admin/catalog');
    const side = screen.getByRole('navigation', { name: 'Menu quản lý' }).closest('.side') as HTMLElement;
    const brand = within(side).getByRole('link', { name: 'QLVPP' });
    expect(brand.querySelector('img')).toHaveAttribute('src', '/vpp-logo.png');
    expect(brand).not.toHaveTextContent(/^V/);
  });
});

describe('logo ở mọi chỗ (TC-01)', () => {
  it('390: menu điện thoại có ảnh logo QLVPP', async () => {
    open('/admin/catalog', 390);
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const sheet = await screen.findByRole('dialog', { name: 'Menu quản lý' });
    expect(sheet.querySelector('img[src="/vpp-logo.png"]')).not.toBeNull();
  });
});

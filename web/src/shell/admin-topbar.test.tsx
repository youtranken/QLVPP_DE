import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const NAV_ORDER = ['Kỳ tháng', 'Báo cáo & gửi NCC', 'Nhận hàng', 'Giao hàng', 'Còn nợ', 'Sản phẩm', 'Tủ / Kho', 'Xuất lẻ', 'Danh mục', 'Danh bạ', 'Nhật ký', 'Cấu hình'];

const topbar = () => screen.getAllByRole('banner')[0];

// Trang đích chỉ cần dựng được: API ngoài shell trả 500 → LoadError thay vì dữ liệu rỗng sai hình
function open(path: string) {
  mockViewport(390);
  stubShellApi({}, () => jsonResponse(500, { code: 'INTERNAL' }));
  renderApp(makeMe('admin'), path);
}

afterEach(() => vi.unstubAllGlobals());

describe('AdminTopbar 390 px', () => {
  it('thanh trên: nút "Mở menu quản lý", tên app "QLVPP" (không lặp tiêu đề trang "Sản phẩm"), dòng phụ kỳ "Kỳ hiện tại: tháng 11 · đang mở", chuông, avatar', async () => {
    open('/admin/catalog');
    const bar = topbar();
    expect(within(bar).getByRole('button', { name: 'Mở menu quản lý' })).toBeInTheDocument();
    expect(within(bar).getByText('QLVPP', { exact: true })).toBeInTheDocument();
    expect(within(bar).queryByText('Sản phẩm', { exact: true })).toBeNull();
    expect(await within(bar).findByText('Kỳ hiện tại: tháng 11 · đang mở')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Nguyễn Văn An, Adm D&E' })).toBeInTheDocument();
    expect(await within(bar).findByRole('button', { name: /^Thông báo/ })).toBeInTheDocument();
  });

  it('Tổng hợp kỳ đang xem tháng 10 (?ym=2026-10) → dòng phụ vẫn nói rõ "Kỳ hiện tại", không ghi trống "Kỳ tháng 11 đang mở"', async () => {
    open('/admin/month?ym=2026-10');
    expect(await within(topbar()).findByText('Kỳ hiện tại: tháng 11 · đang mở')).toBeInTheDocument();
    expect(within(topbar()).queryByText('Kỳ tháng 11 đang mở')).toBeNull();
  });

  it('Giao hàng: dòng phụ giống mọi màn "Kỳ hiện tại: tháng 11 · đang mở" (AD-03), không còn "Tháng 10/2026 · đã khóa"', async () => {
    open('/admin/delivery');
    expect(within(topbar()).getByRole('button', { name: 'Mở menu quản lý' })).toBeInTheDocument();
    expect(await within(topbar()).findByText('Kỳ hiện tại: tháng 11 · đang mở')).toBeInTheDocument();
    expect(within(topbar()).queryByText('Tháng 10/2026 · đã khóa')).toBeNull();
  });

  it('chạm avatar mở menu, chọn "Kho" → /admin/stock (2 chạm)', async () => {
    open('/admin/delivery');
    const avatar = within(topbar()).getByRole('button', { name: 'Nguyễn Văn An, Adm D&E' });
    expect(avatar).toHaveAttribute('aria-expanded', 'false');
    expect(avatar).toHaveAccessibleDescription('Mở menu quản lý');
    await userEvent.click(avatar);
    expect(avatar).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Menu quản lý' })).getByRole('link', { name: 'Tủ / Kho' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/stock');
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });
});

describe('Menu sheet 390 px', () => {
  it('tiêu đề "Menu quản lý", "QLVPP · Adm D&E", nút "Đóng menu", 12 mục, thẻ kỳ, ngôn ngữ, Đăng xuất', async () => {
    open('/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu quản lý' });
    expect(within(sheet).getByRole('heading', { name: 'Menu quản lý' })).toBeInTheDocument();
    expect(within(sheet).getByText('QLVPP · Adm D&E')).toBeInTheDocument();
    const nav = within(sheet).getByRole('navigation', { name: 'Menu quản lý' });
    expect(within(nav).getAllByRole('link').map((a) => a.querySelector('.side__label')?.textContent)).toEqual(NAV_ORDER);
    expect(within(nav).getAllByRole('link').every((a) => !a.hasAttribute('title'))).toBe(true);
    expect(await within(sheet).findByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng 11 · đang mở/ })).toBeInTheDocument();
    expect(within(sheet).getByRole('radio', { name: 'English' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Đóng menu' }));
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });

  it.each(NAV_ORDER.map((label, i) => [label, i] as const))('chọn "%s" → tới trang đó và đóng menu (2 chạm)', async (label) => {
    open('/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu quản lý' });
    const link = within(sheet).getByRole('link', { name: (n) => n === label || n.startsWith(`${label},`) });
    const href = link.getAttribute('href');
    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent(href!);
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });

  it('bấm thẻ kỳ trong menu → /admin/month và đóng menu', async () => {
    open('/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    await userEvent.click(await screen.findByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng 11 · đang mở/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/month');
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });
});

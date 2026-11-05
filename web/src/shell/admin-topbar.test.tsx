import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';

const NAV_ORDER = ['Tổng hợp kỳ', 'Giao hàng', 'Hàng về', 'Báo cáo & in', 'Danh mục món', 'Tủ / Kho', 'Món ngoài danh mục', 'Nhóm món', 'Đơn vị tính', 'Nhân viên', 'Nhật ký', 'Cấu hình', 'Còn nợ', 'Giao hàng (bản cũ)'];

const topbar = () => screen.getAllByRole('banner')[0];
const search = () => screen.getByTestId('location-search').textContent ?? '';

// Trang đích chỉ cần dựng được: API ngoài shell trả 500 → LoadError thay vì dữ liệu rỗng sai hình
function open(path: string) {
  mockViewport(390);
  stubShellApi({}, () => jsonResponse(500, { code: 'INTERNAL' }));
  renderApp(makeMe('admin'), path);
}

afterEach(() => vi.unstubAllGlobals());

describe('AdminTopbar 390 px', () => {
  it('thanh trên: nút "Mở menu quản lý", tên app "VPP Công trình" (không lặp tiêu đề trang "Danh mục"), dòng phụ kỳ "Kỳ hiện tại: tháng 11 · đang mở", chuông, avatar', async () => {
    open('/admin/catalog');
    const bar = topbar();
    expect(within(bar).getByRole('button', { name: 'Mở menu quản lý' })).toBeInTheDocument();
    expect(within(bar).getByText('VPP Công trình', { exact: true })).toBeInTheDocument();
    expect(within(bar).queryByText('Danh mục', { exact: true })).toBeNull();
    expect(await within(bar).findByText('Kỳ hiện tại: tháng 11 · đang mở')).toBeInTheDocument();
    expect(within(bar).getByRole('button', { name: 'Nguyễn Văn An, Hành chính' })).toBeInTheDocument();
    expect(await within(bar).findByRole('button', { name: /^Thông báo/ })).toBeInTheDocument();
  });

  it('Tổng hợp kỳ đang xem tháng 10 (?ym=2026-10) → dòng phụ vẫn nói rõ "Kỳ hiện tại", không ghi trống "Kỳ tháng 11 đang mở"', async () => {
    open('/admin/summary?ym=2026-10');
    expect(await within(topbar()).findByText('Kỳ hiện tại: tháng 11 · đang mở')).toBeInTheDocument();
    expect(within(topbar()).queryByText('Kỳ tháng 11 đang mở')).toBeNull();
  });

  it('Giao hàng không có ?request=: nút trái vẫn là "Mở menu quản lý", dòng phụ "Tháng 10/2026 · đã khóa"', async () => {
    open('/admin/delivery/classic');
    expect(within(topbar()).getByRole('button', { name: 'Mở menu quản lý' })).toBeInTheDocument();
    expect(within(topbar()).queryByRole('button', { name: 'Quay lại danh sách phiếu' })).toBeNull();
    expect(await within(topbar()).findByText('Tháng 10/2026 · đã khóa')).toBeInTheDocument();
  });

  it('chi tiết Giao hàng (?request=): nút trái "Quay lại danh sách phiếu" bỏ ?request= nhưng giữ bộ lọc ?all=1', async () => {
    open('/admin/delivery/classic?all=1&request=r-1');
    expect(within(topbar()).queryByRole('button', { name: 'Mở menu quản lý' })).toBeNull();
    await userEvent.click(within(topbar()).getByRole('button', { name: 'Quay lại danh sách phiếu' }));
    expect(search()).not.toContain('request=');
    expect(search()).toContain('all=1');
    expect(within(topbar()).getByRole('button', { name: 'Mở menu quản lý' })).toBeInTheDocument();
  });

  it('chi tiết Giao hàng: chạm avatar mở menu, chọn "Kho" → /admin/stock (2 chạm)', async () => {
    open('/admin/delivery/classic?request=r-1');
    const avatar = within(topbar()).getByRole('button', { name: 'Nguyễn Văn An, Hành chính' });
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
  it('tiêu đề "Menu quản lý", "VPP Công trình · Hành chính", nút "Đóng menu", 14 mục, thẻ kỳ, ngôn ngữ, Đăng xuất', async () => {
    open('/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    const sheet = screen.getByRole('dialog', { name: 'Menu quản lý' });
    expect(within(sheet).getByRole('heading', { name: 'Menu quản lý' })).toBeInTheDocument();
    expect(within(sheet).getByText('VPP Công trình · Hành chính')).toBeInTheDocument();
    const nav = within(sheet).getByRole('navigation', { name: 'Menu quản lý' });
    expect(within(nav).getAllByRole('link').map((a) => a.getAttribute('title'))).toEqual(NAV_ORDER);
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
    const link = within(sheet).getByTitle(label);
    const href = link.getAttribute('href');
    await userEvent.click(link);
    expect(screen.getByTestId('location')).toHaveTextContent(href!);
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });

  it('bấm thẻ kỳ trong menu → /admin/summary và đóng menu', async () => {
    open('/admin/catalog');
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu quản lý' }));
    await userEvent.click(await screen.findByRole('link', { name: /^Kỳ đăng ký hiện tại: tháng 11 · đang mở/ }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/summary');
    expect(screen.queryByRole('dialog', { name: 'Menu quản lý' })).toBeNull();
  });
});

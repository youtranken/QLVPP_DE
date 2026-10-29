import { describe, expect, it, vi } from 'vitest';
import { cleanup, jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

describe('AdminShell + RequireRole', () => {
  it('role member vào /admin/catalog → chuyển về /', () => {
    mockViewport(1280);
    renderApp(makeMe('member'), '/admin/catalog');
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/);
    expect(screen.queryByRole('navigation', { name: 'Menu quản lý' })).toBeNull();
  });

  it.each(['admin', 'sa'] as const)('role %s vào /admin/catalog thấy sidebar theo nhóm + tiêu đề trang', (role) => {
    mockViewport(1280);
    renderApp(makeMe(role), '/admin/catalog');
    const side = screen.getByRole('navigation', { name: 'Menu quản lý' });
    for (const g of ['Hằng tháng', 'Kho & danh mục', 'Hệ thống', 'Cá nhân']) {
      expect(within(side).getByText(g)).toBeInTheDocument();
    }
    expect(within(side).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('aria-current', 'page');
    expect(within(side).getByRole('link', { name: /Phiếu của tôi/ })).toHaveAttribute('href', '/');
    expect(screen.getByRole('heading', { level: 1, name: 'Danh mục' })).toBeInTheDocument();
  });

  it('sidebar đủ mục theo _SPEC.md, đúng thứ tự', () => {
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/catalog');
    const side = screen.getByRole('navigation', { name: 'Menu quản lý' });
    expect(within(side).getAllByRole('link').map((a) => a.textContent?.replace(' ↗', ''))).toEqual([
      'Tổng hợp kỳ',
      'Món ngoài danh mục',
      'Giao hàng',
      'Còn nợ',
      'Báo cáo & in',
      'Kho',
      'Danh mục',
      'Danh bạ',
      'Nhật ký',
      'Cấu hình',
      'Phiếu của tôi',
    ]);
  });

  it('mục chưa làm (Giao hàng) hiện "Sắp có"; Món ngoài danh mục là trang thật', () => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [] }))));
    renderApp(makeMe('admin'), '/admin/delivery');
    expect(screen.getByRole('heading', { level: 1, name: 'Giao hàng' })).toBeInTheDocument();
    expect(screen.getByText('Sắp có')).toBeInTheDocument();
    cleanup();
    renderApp(makeMe('admin'), '/admin/review');
    expect(screen.getByRole('heading', { level: 1, name: 'Món ngoài danh mục' })).toBeInTheDocument();
    expect(screen.queryByText('Sắp có')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('390 px: sidebar ẩn sau nút "Mở menu", bấm thì hiện', async () => {
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/catalog');
    expect(screen.queryByRole('navigation', { name: 'Menu quản lý' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mở menu' }));
    expect(screen.getByRole('navigation', { name: 'Menu quản lý' })).toBeInTheDocument();
  });

  it('/admin chuyển tới trang chủ Hành chính /admin/summary (Tổng hợp kỳ, không còn "Sắp có")', () => {
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/summary');
    expect(screen.getByRole('heading', { level: 1, name: 'Tổng hợp kỳ' })).toBeInTheDocument();
    expect(screen.queryByText('Sắp có')).toBeNull();
  });

  it('Hành chính thấy chuông thông báo ở đầu trang quản lý', () => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 2 }))));
    renderApp(makeMe('admin'), '/admin/summary');
    expect(screen.getByRole('banner')).toContainElement(screen.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }));
  });
});

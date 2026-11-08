import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

afterEach(() => vi.unstubAllGlobals());

describe('AppRoutes — đường dẫn lạ', () => {
  it('member mở /xyz → trang 404 nằm trong khung Nhân viên v2 (thanh dưới, panel sáng)', () => {
    mockViewport(390);
    renderApp(makeMe('member'), '/xyz');
    const heading = screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' });
    expect(heading.closest('.m-panel')).not.toBeNull();
    expect(screen.getByRole('navigation', { name: 'Điều hướng chính' })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/xyz');
  });

  it.each(['admin', 'sa'] as const)('%s mở /foo → trang 404 chung, không bị chuyển về /admin', (role) => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, {}))));
    renderApp(makeMe(role), '/foo');
    expect(screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(screen.getByTestId('location').textContent).toBe('/foo');
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).toBeNull();
    expect(within(document.body).queryByText('Đăng ký', { selector: 'a' })).toBeNull();
  });
});

describe('AppRoutes — chuyển hướng đường cũ của Hành chính (giữ nguyên query)', () => {
  it.each([
    ['/admin', '/admin/month', ''],
    ['/admin/home', '/admin/month', ''],
    ['/admin/summary?ym=2026-10&q=an&request=r1', '/admin/month', '?ym=2026-10&q=an&request=r1'],
    ['/admin/summary?ym=2026-11&left=1', '/admin/month', '?ym=2026-11&left=1'],
    ['/admin/summary?ym=2026-10&filter=pending_delivery', '/admin/month', '?ym=2026-10&chip=undelivered'] /* ?filter cũ đổi thành chip */,
    ['/admin/units?x=1', '/admin/categories/units', '?x=1'],
  ])('%s → %s%s', (from, path, query) => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, {}))));
    renderApp(makeMe('admin'), from);
    expect(screen.getByTestId('location').textContent).toBe(path);
    expect(screen.getByTestId('location-search').textContent).toBe(query);
  });
});

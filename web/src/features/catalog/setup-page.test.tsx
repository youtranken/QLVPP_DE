import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeContext } from '@/lib/me';
import { AppRoutes } from '@/shell/app-routes';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import { jsonResponse } from '@/test/test-utils';

const CATS = [{ id: 'c-1', name: 'Kẹp & dán', name_en: null, sort_order: 10, active: true }];

function Probe() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="where">{`${pathname}${search}`}</output>
      <button type="button" onClick={() => void navigate(-1)}>
        probe-back
      </button>
    </>
  );
}

function render(entries: string[]) {
  mockViewport(1280);
  stubShellApi({ '/api/item-categories?all=1': () => jsonResponse(200, CATS), '/api/units?all=1': () => jsonResponse(200, []) });
  return renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <ConfirmProvider>
          <AppRoutes />
          <Probe />
        </ConfirmProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const sideNav = () => within(screen.getByRole('navigation', { name: 'Menu quản lý' }));

afterEach(() => vi.unstubAllGlobals());

describe('Trang "Danh mục" (2 tab)', () => {
  it('/admin/units?x=1 → /admin/categories/units?x=1 (replace): Back về trang trước, không quay lại /admin/units', async () => {
    render(['/admin/catalog', '/admin/units?x=1']);
    await waitFor(() => expect(where()).toBe('/admin/categories/units?x=1'));
    await userEvent.click(screen.getByRole('button', { name: 'probe-back' }));
    await waitFor(() => expect(where()).toBe('/admin/catalog'));
  });

  it('h1 "Danh mục", tiêu đề phụ = tên tab; tablist 2 tab là link, tab đang mở aria-selected', async () => {
    render(['/admin/categories/units']);
    expect(await screen.findByRole('heading', { level: 1, name: 'Danh mục' })).toBeInTheDocument();
    const tabs = within(screen.getByRole('tablist'));
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Nhóm sản phẩm', 'Đơn vị tính']);
    expect(tabs.getByRole('tab', { name: 'Đơn vị tính' })).toHaveAttribute('aria-selected', 'true');
    expect(tabs.getByRole('tab', { name: 'Nhóm sản phẩm' })).toHaveAttribute('aria-selected', 'false');
    expect(tabs.getByRole('tab', { name: 'Nhóm sản phẩm' })).toHaveAttribute('href', '/admin/categories');
    expect(screen.getByRole('heading', { level: 2, name: 'Đơn vị tính' })).toBeInTheDocument();
  });

  it('tablist bàn phím: chỉ tab đang mở trong Tab; ←/→ chuyển focus giữa hai tab (vòng), Enter mới đổi trang', async () => {
    render(['/admin/categories/units']);
    const tabs = within(await screen.findByRole('tablist'));
    const units = tabs.getByRole('tab', { name: 'Đơn vị tính' });
    const groups = tabs.getByRole('tab', { name: 'Nhóm sản phẩm' });
    expect(units).toHaveAttribute('tabindex', '0');
    expect(groups).toHaveAttribute('tabindex', '-1');
    units.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(groups).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(units).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(groups).toHaveFocus();
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/categories/units');
  });

  it('bấm tab Nhóm sản phẩm → /admin/categories (push: Back về tab Đơn vị)', async () => {
    render(['/admin/categories/units']);
    await userEvent.click(within(await screen.findByRole('tablist')).getByRole('tab', { name: 'Nhóm sản phẩm' }));
    expect(where()).toBe('/admin/categories');
    expect(within(screen.getByRole('tablist')).getByRole('tab', { name: 'Nhóm sản phẩm' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Nhóm sản phẩm' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'probe-back' }));
    expect(where()).toBe('/admin/categories/units');
  });

  it.each(['/admin/categories', '/admin/categories/units'])('menu có đúng 1 mục "Danh mục", sáng ở %s; không còn mục "Đơn vị tính"/"Nhóm sản phẩm"', async (path) => {
    render([path]);
    await screen.findByRole('tablist');
    expect(sideNav().getAllByRole('link', { name: 'Danh mục' })).toHaveLength(1);
    expect(sideNav().getByRole('link', { name: 'Danh mục' })).toHaveAttribute('aria-current', 'page');
    expect(sideNav().queryByRole('link', { name: 'Đơn vị tính' })).toBeNull();
    expect(sideNav().queryByRole('link', { name: 'Nhóm sản phẩm' })).toBeNull();
  });

  it('?group= trên tab Đơn vị bị bỏ qua: không panel nhóm', async () => {
    render(['/admin/categories/units?group=c-1']);
    await screen.findByRole('tablist');
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

const SRC = resolve(__dirname, '../..');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('quét mã: không còn liên kết tới /admin/units', () => {
  it('không tệp nguồn nào trỏ "/admin/units" (trừ gọi API /api/admin/units)', () => {
    const hits = walk(SRC).filter((f) => /(?<!\/api)\/admin\/units\b/.test(readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });

  it('bộ quét bắt được to="/admin/units"', () => {
    expect(/(?<!\/api)\/admin\/units\b/.test('<Link to="/admin/units">')).toBe(true);
    expect(/(?<!\/api)\/admin\/units\b/.test("apiFetch('/api/admin/units')")).toBe(false);
  });
});

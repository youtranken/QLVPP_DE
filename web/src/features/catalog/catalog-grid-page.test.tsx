import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { OLD, PAPER, PEN, PENCIL, adminItem } from './catalog-fixtures';
import { locationSearch, openCatalog } from './catalog-fixtures-api';

const ITEMS = [PAPER, PEN, PENCIL, OLD];
const GRID = '/admin/catalog';
const tab = (name: RegExp) => screen.getByRole('button', { name });
const cards = () => screen.getAllByRole('article');
const open = (path = GRID, items = ITEMS) => openCatalog({ items }, path, true);

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage('vi');
});

describe('Danh mục — chế độ xem', () => {
  it('không có ?view → lưới thẻ (không có bảng), nút Lưới đang bật', async () => {
    await open();
    expect(cards()).toHaveLength(3);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lưới' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['?view=grid', '?view=linh-tinh', '?view='])('%s → lưới', async (search) => {
    await open(`${GRID}${search}`);
    expect(screen.queryByRole('table')).toBeNull();
    expect(cards().length).toBeGreaterThan(0);
  });

  it('?view=table → bảng cũ: thẻ thống kê, thao tác hàng loạt, không lưới', async () => {
    await open(`${GRID}?view=table`);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByRole('button', { name: /^Đang dùng/ })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: /Chọn cả nhóm/ }).length).toBeGreaterThan(0);
  });

  it('nút Bảng → ?view=table; nút Lưới trả về URL không còn view', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Bảng' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?view=table');
    expect(screen.getByRole('table')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưới' }));
    expect(screen.getByTestId('location-search').textContent).toBe('');
    expect(screen.queryByRole('table')).toBeNull();
  });
});

describe('Danh mục lưới — tab', () => {
  it('4 tab có số: Đang dùng 3 · Sắp hết/hết 2 · Chưa có ảnh 1 · Đã ngừng 1', async () => {
    await open();
    expect(tab(/^Đang dùng/)).toHaveTextContent('3');
    expect(tab(/^Sắp hết\/hết/)).toHaveTextContent('2');
    expect(tab(/^Chưa có ảnh/)).toHaveTextContent('1');
    expect(tab(/^Đã ngừng/)).toHaveTextContent('1');
    expect(tab(/^Đang dùng/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('Sắp hết/hết → ?tab=low: giấy (sắp hết) và bút chì (hết), không có bút bi', async () => {
    await open();
    await userEvent.click(tab(/^Sắp hết\/hết/));
    expect(locationSearch()).toBe('?tab=low');
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByText('Bút chì 2B')).toBeInTheDocument();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('Đã ngừng chỉ hiện món ngừng; Đang dùng không hiện món ngừng', async () => {
    await open(`${GRID}?tab=inactive`);
    expect(screen.getByText('Bút xóa cũ')).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    await userEvent.click(tab(/^Đang dùng/));
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
  });

  it('?tab lạ → Đang dùng', async () => {
    await open(`${GRID}?tab=xyz`);
    expect(tab(/^Đang dùng/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('chip nhóm và ô tìm vẫn lọc trong tab; không có món → "Không có món nào khớp"', async () => {
    await open();
    await userEvent.click(within(screen.getByRole('group', { name: 'Lọc theo nhóm' })).getByRole('button', { name: /^Bút & viết/ }));
    expect(cards()).toHaveLength(2);
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
  });
});

describe('Danh mục lưới — tab rỗng', () => {
  it.each([
    ['inactive', 'Không có món đã ngừng.'],
    ['low', 'Không có món sắp hết.'],
    ['noImage', 'Món nào cũng đã có ảnh.'],
  ])('tab %s rỗng, không lọc → "%s", không có "Bỏ lọc"', async (t, text) => {
    await open(`${GRID}?tab=${t}`, [PEN]);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bỏ lọc' })).toBeNull();
    expect(screen.queryByText('Không có món nào khớp')).toBeNull();
  });

  it('tab rỗng nhưng đang tìm → vẫn "Không có món nào khớp" kèm "Bỏ lọc"', async () => {
    await open(`${GRID}?tab=inactive&q=zz`, [PEN]);
    expect(screen.getByText('Không có món nào khớp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ lọc' })).toBeInTheDocument();
  });
});

describe('Danh mục lưới — thẻ và ngăn kéo', () => {
  it('thẻ chưa ảnh có "Tải ảnh lên"; thẻ có ảnh thì không', async () => {
    await open();
    expect(screen.getAllByText('Tải ảnh lên')).toHaveLength(1);
    expect(screen.getByLabelText('Tải ảnh lên cho Giấy A4')).toBeInTheDocument();
  });

  it('"Sửa" mở ngăn kéo ?item=id có khối "Nhân viên sẽ thấy"', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Bút bi xanh' }));
    expect(locationSearch()).toBe('?item=i-pen');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('region', { name: 'Nhân viên sẽ thấy' })).toBeInTheDocument();
  });

  it('tiếng Anh: thẻ hiện name_en khi có, rơi về name khi không', async () => {
    await open(GRID, [adminItem({ id: 'a', name: 'Bút', name_en: 'Pen' }), adminItem({ id: 'b', name: 'Kẹp', name_en: null })]);
    await act(() => i18n.changeLanguage('en'));
    expect(screen.getByRole('heading', { name: 'Pen' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kẹp' })).toBeInTheDocument();
  });

  it('món đã ngừng chưa có ảnh: không có nút "Tải ảnh lên"', async () => {
    await open(`${GRID}?tab=inactive`, [adminItem({ id: 'z', name: 'Món cũ', active: false, image_file_id: null, missing_image: true })]);
    expect(screen.getByText('Món cũ')).toBeInTheDocument();
    expect(screen.queryByLabelText('Tải ảnh lên cho Món cũ')).toBeNull();
  });

  it('thẻ chưa ảnh lấy tông nhóm của món cho ảnh tạm', async () => {
    await open();
    const thumb = document.querySelector('[data-thumb="placeholder"]') as HTMLElement;
    expect(thumb.style.background).toMatch(/^var\(--g[0-7]\)$/);
  });
});

describe('Danh mục lưới — tải và lỗi', () => {
  it('đang tải: không báo rỗng; lỗi tải: "Thử lại" lấy lại dữ liệu', async () => {
    let fail = true;
    const f = vi.fn(async (url: string) => {
      const path = new URL(url, 'http://x').pathname;
      if (path === '/api/admin/items') return fail ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, ITEMS);
      if (path === '/api/item-categories') return jsonResponse(200, []);
      return jsonResponse(200, {});
    });
    vi.stubGlobal('fetch', f);
    const { renderApp } = await import('@/test/render-app');
    const { makeMe } = await import('@/test/fixtures-me');
    renderApp(makeMe('admin'), GRID);
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    expect(screen.queryByText('Không có món nào khớp')).toBeNull();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    await waitFor(() => expect(screen.getAllByRole('article').length).toBeGreaterThan(0));
  });
});

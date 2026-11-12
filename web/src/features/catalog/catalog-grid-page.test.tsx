import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { OLD, PAPER, PEN, PENCIL, adminItem } from './catalog-fixtures';
import { locationSearch, openCatalog, patchCalls } from './catalog-fixtures-api';

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
    expect(cards()).toHaveLength(4);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lưới' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each(['?view=grid', '?view=linh-tinh', '?view='])('%s → lưới', async (search) => {
    await open(`${GRID}${search}`);
    expect(screen.queryByRole('table')).toBeNull();
    expect(cards().length).toBeGreaterThan(0);
  });

  it('?view=table → bảng: cùng tab trạng thái, thao tác hàng loạt, không lưới', async () => {
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
  it('4 tab có số: Tất cả 4 · Đang dùng 3 · Tạm ngưng 1 · Chưa có ảnh 1; không còn "Sắp hết/hết"; Tất cả đang chọn', async () => {
    await open();
    expect(tab(/^Tất cả \d/)).toHaveTextContent('4');
    expect(tab(/^Đang dùng/)).toHaveTextContent('3');
    expect(screen.queryByRole('button', { name: /^Sắp hết/ })).toBeNull();
    expect(tab(/^Chưa có ảnh/)).toHaveTextContent('1');
    expect(tab(/^Tạm ngưng \d/)).toHaveTextContent('1');
    expect(tab(/^Tất cả \d/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('liên kết cũ ?tab=low → tab Tất cả, tham số bị gỡ (replace), đủ 4 món', async () => {
    await open(`${GRID}?tab=low`);
    await waitFor(() => expect(locationSearch()).toBe(''));
    expect(tab(/^Tất cả \d/)).toHaveAttribute('aria-pressed', 'true');
    expect(cards()).toHaveLength(4);
  });

  it.each([
    ['?cat=c-pen', '?group=c-pen'],
    ['?inactive=1', '?tab=inactive'],
    ['?inactive=0', ''],
    ['?filter=noimage', '?tab=noImage'],
    ['?filter=low', ''],
    ['?q=b&filter=out', '?q=b'],
  ])('liên kết cũ %s → %s (đổi sang tham số mới, thay mục lịch sử)', async (old, next) => {
    await open(`${GRID}${old}`);
    await waitFor(() => expect(locationSearch()).toBe(next));
  });

  it('liên kết cũ ?inactive=1 mở tab Tạm ngưng', async () => {
    await open(`${GRID}?inactive=1`);
    await waitFor(() => expect(tab(/^Tạm ngưng \d/)).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByText('Bút xóa cũ')).toBeInTheDocument();
  });

  it('Tạm ngưng chỉ hiện món tạm ngưng; Đang dùng không hiện món tạm ngưng', async () => {
    await open(`${GRID}?tab=inactive`);
    expect(screen.getByText('Bút xóa cũ')).toBeInTheDocument();
    expect(cards()).toHaveLength(1);
    await userEvent.click(tab(/^Đang dùng/));
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
  });

  it('?tab lạ → Tất cả', async () => {
    await open(`${GRID}?tab=xyz`);
    expect(tab(/^Tất cả \d/)).toHaveAttribute('aria-pressed', 'true');
  });

  it('chip nhóm và ô tìm vẫn lọc trong tab; không có món → "Không có món nào khớp"', async () => {
    await open();
    await userEvent.click(within(screen.getByRole('group', { name: 'Lọc theo nhóm' })).getByRole('button', { name: /^Bút & viết/ }));
    expect(cards()).toHaveLength(3);
    await userEvent.type(screen.getByRole('searchbox'), 'zzzz');
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
  });
});

describe('Danh mục lưới — tab rỗng', () => {
  it.each([
    ['inactive', 'Không có sản phẩm tạm ngưng.'],
    ['noImage', 'Món nào cũng đã có ảnh.'],
  ])('tab %s rỗng, không lọc → "%s", không có "Xóa lọc"', async (t, text) => {
    await open(`${GRID}?tab=${t}`, [PEN]);
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa lọc' })).toBeNull();
    expect(screen.queryByText('Không có món nào khớp')).toBeNull();
  });

  it('tab rỗng nhưng đang tìm → vẫn "Không có món nào khớp" kèm "Xóa lọc"', async () => {
    await open(`${GRID}?tab=inactive&q=zz`, [PEN]);
    expect(screen.getByText('Không có món nào khớp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xóa lọc' })).toBeInTheDocument();
  });
});

describe('Danh mục lưới — thẻ và ngăn kéo', () => {
  it('thẻ chưa ảnh có "Tải ảnh lên"; thẻ có ảnh thì không', async () => {
    await open();
    expect(screen.getAllByText('Tải ảnh lên')).toHaveLength(1);
    expect(screen.getByLabelText('Tải ảnh lên cho Giấy A4')).toBeInTheDocument();
  });

  it('"Sửa" mở ngăn kéo ?item=id; không còn khối "Nhân viên sẽ thấy"', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Bút bi xanh' }));
    expect(locationSearch()).toBe('?item=i-pen');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText(/^Tên sản phẩm/)).toHaveValue('Bút bi xanh');
    expect(within(dialog).queryByRole('region', { name: 'Nhân viên sẽ thấy' })).toBeNull();
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

describe('Danh mục — một thanh lọc cho lưới và bảng', () => {
  it('lọc "giay" + nhóm Giấy & sổ ở lưới → đổi sang bảng giữ q/group/tab và cùng kết quả; bảng mở mọi nhóm', async () => {
    await open(`${GRID}?tab=noImage`, [...ITEMS, adminItem({ id: 'i-note', name: 'Giấy note', category_id: 'c-pen', image_file_id: null, missing_image: true })]);
    await userEvent.type(screen.getByRole('searchbox'), 'giay');
    await waitFor(() => expect(locationSearch()).toContain('q=giay'));
    await userEvent.click(within(screen.getByRole('group', { name: 'Lọc theo nhóm' })).getByRole('button', { name: /^Giấy & sổ/ }));
    await waitFor(() => expect(cards()).toHaveLength(1));
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    const before = new URLSearchParams(locationSearch());
    await userEvent.click(screen.getByRole('button', { name: 'Bảng' }));
    const after = new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
    expect(['q', 'group', 'tab'].map((k) => after.get(k))).toEqual(['q', 'group', 'tab'].map((k) => before.get(k)));
    expect(['giay', 'c-paper', 'noImage']).toEqual(['q', 'group', 'tab'].map((k) => after.get(k)));
    expect(screen.getByRole('searchbox')).toHaveValue('giay');
    expect(within(screen.getByRole('table')).getByText('Giấy A4')).toBeInTheDocument();
    expect(screen.queryByText('Giấy note')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Thu tất cả' })).toBeNull();
  });

  it('bảng mở mọi nhóm ngay lần đầu (không cần bấm "Mở tất cả")', async () => {
    await open(`${GRID}?view=table`);
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mở tất cả' })).toBeNull();
  });

  it('tìm không dấu ở bảng: "BUT CHI" khớp "Bút chì 2B"', async () => {
    await open(`${GRID}?view=table`);
    await userEvent.type(screen.getByRole('searchbox'), 'BUT CHI');
    await waitFor(() => expect(screen.queryByText('Bút bi xanh')).toBeNull());
    expect(screen.getByText('Bút chì 2B')).toBeInTheDocument();
  });
});

describe('Danh mục — tồn chỉ để tham khảo', () => {
  it.each(['', '?view=table'])('%s: chữ xám "Tủ: 0"/"Tủ: 2", không nhãn đỏ/cam hay "Hết"/"Sắp hết" về tồn', async (search) => {
    await open(`${GRID}${search}`);
    expect(screen.getByText('Tủ: 0')).toBeInTheDocument();
    expect(screen.getByText('Tủ: 2')).toBeInTheDocument();
    expect(screen.getByText('Tủ: 0').closest('.tag--danger, .tag--warn')).toBeNull();
    const stockTags = [...document.querySelectorAll('.tag--danger, .tag--warn')].filter((el) => /hết|Còn \d/i.test(el.textContent ?? ''));
    expect(stockTags).toEqual([]);
    expect(screen.queryByText(/^(Hết|Hết hàng|Sắp hết)$/)).toBeNull();
  });
});

describe('Sản phẩm lưới — món và nhóm tạm ngưng tại chỗ (Nhóm 1 · mục 6)', () => {
  const GROUPED = [
    PEN,
    OLD,
    adminItem({ id: 'i-g1', name: 'Kẹp A', category_id: 'c-old', usable: false, inactive_reason: 'group' }),
    adminItem({ id: 'i-g2', name: 'Kẹp B', category_id: 'c-old', usable: false, inactive_reason: 'group' }),
  ];

  it('mặc định tab "Tất cả" đang chọn; món tạm ngưng nằm tại chỗ trong nhóm của nó, có dấu; đầu nhóm "2 sản phẩm · 1 tạm ngưng"', async () => {
    await open(GRID, GROUPED);
    expect(tab(/^Tất cả \d/)).toHaveAttribute('aria-pressed', 'true');
    const pens = screen.getByRole('heading', { name: 'Bút & viết' }).closest('section') as HTMLElement;
    expect(within(pens).getByText('Bút xóa cũ')).toBeInTheDocument();
    expect(within(pens).getAllByRole('img', { name: 'Tạm ngưng' })).toHaveLength(1);
    expect(within(pens).getByText('2 sản phẩm · 1 tạm ngưng')).toBeInTheDocument();
  });

  it('nhóm tạm ngưng: một dòng "Tạm ngưng cả nhóm · 2 sản phẩm · thu gọn", thẻ ẩn; "Xem 2 sản phẩm" mở thẻ có dấu; "Thu gọn" đóng lại', async () => {
    await open(GRID, GROUPED);
    expect(screen.getByText('Tạm ngưng cả nhóm')).toBeInTheDocument();
    expect(screen.getByText('2 sản phẩm · thu gọn')).toBeInTheDocument();
    expect(screen.queryByText('Kẹp A')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Xem 2 sản phẩm' }));
    expect(screen.getByText('Kẹp A')).toBeInTheDocument();
    expect(screen.getByText('Kẹp B')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
    expect(screen.queryByText('Kẹp A')).toBeNull();
  });

  it('"Dùng lại nhóm" → PATCH item-categories/c-old {active:true}; dòng nhóm không có nút "+"', async () => {
    const f = await open(GRID, GROUPED);
    const row = screen.getByText('Tạm ngưng cả nhóm').closest('div') as HTMLElement;
    expect(within(row).queryByRole('button', { name: /^Thêm/ })).toBeNull();
    await userEvent.click(within(row).getByRole('button', { name: /^Dùng lại nhóm/ }));
    await waitFor(() => expect(patchCalls(f)).toEqual([{ id: 'c-old', body: { active: true } }]));
  });

  it('tab "Tạm ngưng" gồm cả món tạm ngưng riêng lẫn món của nhóm tạm ngưng', async () => {
    await open(`${GRID}?tab=inactive`, GROUPED);
    expect(tab(/^Tạm ngưng/)).toHaveAttribute('aria-pressed', 'true');
    expect(tab(/^Tạm ngưng/)).toHaveTextContent('3');
    expect(screen.getByText('Bút xóa cũ')).toBeInTheDocument();
  });
});

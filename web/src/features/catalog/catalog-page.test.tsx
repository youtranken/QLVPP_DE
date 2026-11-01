import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, userEvent, within } from '@/test/test-utils';
import { CATEGORIES, OLD, PAPER, PEN, PENCIL, STRAY, adminItem } from './catalog-fixtures';
import { inRow, openCatalog, rowOf } from './catalog-fixtures-api';
import { OPEN_GROUPS_KEY } from './use-group-collapse';

const ITEMS = [PAPER, PEN, PENCIL, OLD];
const location = () => screen.getByTestId('location-search').textContent;
const card = (name: RegExp) => screen.getByRole('button', { name });
const chips = () => within(screen.getByRole('group', { name: 'Lọc theo nhóm' }));
const groupHead = (name: string) => screen.getByRole('button', { name: `Thêm món vào nhóm ${name}` }).closest('tr') as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục — đầu trang, thẻ, lọc', () => {
  it('đúng một h1 "Danh mục" + mô tả; "Nhóm món" tới /admin/categories; nhóm lấy cả nhóm đã ngừng (?all=1)', async () => {
    const f = await openCatalog({ items: ITEMS });
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/item-categories?all=1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Danh mục');
    expect(screen.getByText(/^Nhân viên thấy món theo đúng thứ tự nhóm dưới đây/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Nhóm món' })).toHaveAttribute('href', '/admin/categories');
  });

  it('thẻ chỉ đếm món đang dùng: Đang dùng 3 món · 2 nhóm, Sắp hết 1, Hết hàng 1, Thiếu ảnh 1', async () => {
    await openCatalog({ items: ITEMS });
    expect(card(/^Đang dùng/)).toHaveTextContent('3');
    expect(card(/^Đang dùng/)).toHaveTextContent('2 nhóm');
    expect(card(/^Sắp hết/)).toHaveTextContent('1');
    expect(card(/^Hết hàng/)).toHaveTextContent('1');
    expect(card(/^Thiếu ảnh/)).toHaveTextContent('nhân viên không chọn được');
  });

  it('thẻ "Thiếu ảnh" → ?filter=noimage, chỉ món thiếu ảnh, "Đang lọc: Thiếu ảnh · 1"; bấm lại bỏ lọc', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(card(/^Thiếu ảnh/));
    expect(location()).toBe('?filter=noimage');
    expect(card(/^Thiếu ảnh/)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Đang lọc: Thiếu ảnh · 1')).toBeInTheDocument();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(inRow('Giấy A4').getByText('Thiếu ảnh')).toBeInTheDocument();
    await userEvent.click(card(/^Thiếu ảnh/));
    expect(location()).toBe('');
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });

  it('thẻ "Đang dùng" chỉ aria-pressed khi không có lọc nhóm/tìm/thẻ', async () => {
    await openCatalog({ items: ITEMS });
    expect(card(/^Đang dùng/)).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(chips().getByRole('button', { name: /^Bút & viết/ }));
    expect(card(/^Đang dùng/)).toHaveAttribute('aria-pressed', 'false');
  });

  it.each(['?q=but', '?cat=c-pen', '?filter=low'])('mở với %s → "Đang dùng" không pressed', async (search) => {
    await openCatalog({ items: ITEMS }, `/admin/catalog${search}`);
    expect(card(/^Đang dùng/)).toHaveAttribute('aria-pressed', 'false');
  });

  it('thẻ "Đang dùng" bỏ mọi lọc (filter, nhóm)', async () => {
    await openCatalog({ items: ITEMS }, '/admin/catalog?filter=out&cat=c-pen');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    await userEvent.click(card(/^Đang dùng/));
    expect(location()).toBe('');
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
  });

  it('chip nhóm aria-pressed; chọn "Bút & viết" → ?cat=c-pen chỉ còn món nhóm đó; "Tất cả nhóm" trả lại', async () => {
    await openCatalog({ items: ITEMS });
    expect(chips().getByRole('button', { name: /^Tất cả nhóm/ })).toHaveAttribute('aria-pressed', 'true');
    const pens = chips().getByRole('button', { name: /^Bút & viết/ });
    expect(pens).toHaveTextContent('2');
    await userEvent.click(pens);
    expect(location()).toBe('?cat=c-pen');
    expect(pens).toHaveAttribute('aria-pressed', 'true');
    expect(chips().getByRole('button', { name: /^Tất cả nhóm/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    await userEvent.click(chips().getByRole('button', { name: /^Tất cả nhóm/ }));
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
  });

  it('công tắc "Hiện món đã ngừng (1)" → ?inactive=1, món ngừng hiện kèm badge "Ngừng"', async () => {
    await openCatalog({ items: ITEMS });
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
    const toggle = screen.getByRole('switch', { name: 'Hiện món đã ngừng (1)' });
    await userEvent.click(toggle);
    expect(location()).toBe('?inactive=1');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(inRow('Bút xóa cũ').getByText('Ngừng')).toBeInTheDocument();
  });

  it('ô tìm "Tìm trong 3 món" lọc qua ?q=', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm trong 3 món' }), 'but chi');
    await vi.waitFor(() => expect(location()).toBe('?q=but+chi'));
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.getByText('Bút chì 2B')).toBeInTheDocument();
  });

  it('không món nào khớp → "Không có món nào khớp" + "Bỏ lọc" trả lại bảng', async () => {
    await openCatalog({ items: ITEMS }, '/admin/catalog?q=khongco');
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Bỏ lọc' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
  });
});

describe('Danh mục — bảng nhóm', () => {
  it('nhóm theo thứ tự nhóm, tiêu đề "{n} món · {k} sắp hết · {h} hết hàng"', async () => {
    await openCatalog({ items: ITEMS });
    const heads = screen.getAllByRole('button', { name: /^Thêm món vào nhóm / }).map((b) => b.getAttribute('aria-label'));
    expect(heads).toEqual(['Thêm món vào nhóm Giấy & sổ', 'Thêm món vào nhóm Bút & viết']);
    expect(groupHead('Giấy & sổ')).toHaveTextContent('1 món · 1 sắp hết');
    expect(groupHead('Bút & viết')).toHaveTextContent('2 món · 1 hết hàng');
  });

  it('món có category_id lạ → nhóm "Chưa xếp nhóm" ở cuối, không lỗi (Review Focus 5)', async () => {
    await openCatalog({ items: [PEN, STRAY] });
    expect(within(screen.getByRole('table')).getByText('Chưa xếp nhóm')).toBeInTheDocument();
    expect(rowOf('Kẹp lạ')).toBeInTheDocument();
  });

  it('danh sách nhóm rỗng → mọi món dưới "Chưa xếp nhóm"', async () => {
    await openCatalog({ items: [PEN, PAPER], categories: [] });
    expect(within(screen.getByRole('table')).getByText('Chưa xếp nhóm')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Chọn cả nhóm Chưa xếp nhóm/ })).toBeInTheDocument();
  });

  it('hàng: mã, quy cách, ĐVT, tồn + nhãn trạng thái, badge "Chỉ Hành chính"/"Thiếu ảnh"; mã trống hiện "—"', async () => {
    await openCatalog({ items: ITEMS });
    expect(screen.getByRole('columnheader', { name: 'Mã' })).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('VPP-010')).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('hộp 20 cây')).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('cây')).toBeInTheDocument();
    expect(inRow('Bút chì 2B').getAllByText('—')).toHaveLength(2);
    expect(inRow('Bút chì 2B').getByText('Hết hàng')).toBeInTheDocument();
    expect(inRow('Giấy A4').getByText('Sắp hết')).toBeInTheDocument();
    expect(inRow('Giấy A4').getByText('Chỉ Hành chính')).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByRole('img', { name: 'Bút bi xanh' })).toHaveAttribute('src', '/api/files/f-2');
  });

  it('"Thu tất cả" ẩn mọi hàng món, nút thành "Mở tất cả"', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('button', { name: 'Thu tất cả' }));
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Mở tất cả' }));
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });

  it('"Thêm món" mở ngăn kéo ?item=new; "Thêm món vào nhóm" chọn sẵn nhóm; bấm hàng mở ngăn kéo sửa ?item=id', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(within(screen.getByRole('main')).getAllByRole('button', { name: 'Thêm món' })[0]);
    expect(location()).toBe('?item=new');
    expect(await screen.findByRole('dialog', { name: 'Thêm món' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' }));

    await userEvent.click(screen.getByRole('button', { name: 'Thêm món vào nhóm Bút & viết' }));
    expect(location()).toBe('?item=new&itemCat=c-pen');
    const dialog = await screen.findByRole('dialog', { name: 'Thêm món' });
    expect(within(dialog).getByRole('radio', { name: 'Bút & viết' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));

    await userEvent.click(screen.getByText('hộp 20 cây'));
    expect(location()).toBe('?item=i-pen');
    expect(await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
  });

  it('145 món nhập không ảnh, không nhóm: một nhóm "Chưa xếp nhóm", thẻ Thiếu ảnh 145', async () => {
    const many = Array.from({ length: 145 }, (_, i) =>
      adminItem({ id: `i-${i}`, name: `Món nhập ${i}`, category_id: null, image_file_id: null, missing_image: true }),
    );
    await openCatalog({ items: many, categories: CATEGORIES });
    expect(card(/^Thiếu ảnh/)).toHaveTextContent('145');
    expect(screen.queryAllByRole('button', { name: /^Thêm món vào nhóm / })).toHaveLength(0);
    expect(screen.getAllByText(/^Món nhập \d+$/)).toHaveLength(145);
    // 145 hàng thật: khi cả bộ test chạy song song có thể quá 5 s mặc định
  }, 15_000);
});

describe('Danh mục — cột Tên tiếng Anh, nhóm đang ngừng', () => {
  it('cột "Tên tiếng Anh" hiện name_en, trống thì "—"', async () => {
    await openCatalog({ items: [{ ...PEN, name_en: 'Blue ballpoint pen' }, PENCIL] });
    expect(screen.getByRole('columnheader', { name: 'Tên tiếng Anh' })).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('Blue ballpoint pen')).toBeInTheDocument();
    expect(inRow('Bút chì 2B').getAllByText('—')).toHaveLength(2);
  });

  it('món active nhưng usable=false (nhóm ngừng) → nhãn "Nhóm đang ngừng", không phải "Ngừng"; tiêu đề nhóm ngừng cũng có nhãn', async () => {
    const paused = adminItem({ id: 'i-p', name: 'Bút dạ cũ', category_id: 'c-old', usable: false });
    await openCatalog({ items: [PEN, paused] });
    expect(inRow('Bút dạ cũ').getByText('Nhóm đang ngừng')).toBeInTheDocument();
    expect(inRow('Bút dạ cũ').queryByText('Ngừng')).toBeNull();
    expect(inRow('Bút bi xanh').queryByText('Nhóm đang ngừng')).toBeNull();
    expect(within(groupHead('Nhóm cũ')).getByText('Nhóm đang ngừng')).toBeInTheDocument();
    expect(within(groupHead('Bút & viết')).queryByText('Nhóm đang ngừng')).toBeNull();
  });

  it('món tự ngừng trong nhóm ngừng (active=false) chỉ có nhãn "Ngừng"', async () => {
    const both = adminItem({ id: 'i-b', name: 'Bút hỏng', category_id: 'c-old', active: false, usable: false });
    await openCatalog({ items: [PEN, both] }, '/admin/catalog?inactive=1');
    expect(inRow('Bút hỏng').getByText('Ngừng')).toBeInTheDocument();
    expect(inRow('Bút hỏng').queryByText('Nhóm đang ngừng')).toBeNull();
  });
});

describe('Danh mục — thu gọn nhóm mặc định', () => {
  const closed = { items: ITEMS, groupsOpen: false };

  it('mở trang lần đầu: mọi nhóm thu gọn, chỉ còn tiêu đề nhóm; nút "Mở tất cả"', async () => {
    await openCatalog(closed);
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.queryByText('Giấy A4')).toBeNull();
    expect(groupHead('Bút & viết')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở tất cả' })).toBeInTheDocument();
  });

  it('mở một nhóm → nhớ trong sessionStorage; tải lại trang nhóm đó vẫn mở, nhóm khác vẫn thu', async () => {
    await openCatalog(closed);
    await userEvent.click(within(groupHead('Bút & viết')).getByRole('button', { expanded: false }));
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem(OPEN_GROUPS_KEY) ?? '[]')).toEqual(['c-pen']);
    cleanup();
    await openCatalog({ ...closed, groupsOpen: 'keep' });
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByText('Giấy A4')).toBeNull();
  });

  it('tìm có kết quả → tự mở nhóm chứa kết quả dù đang thu', async () => {
    await openCatalog(closed, '/admin/catalog?q=but chi');
    expect(screen.getByText('Bút chì 2B')).toBeInTheDocument();
  });

  it('lọc theo nhóm (?cat=) cũng mở nhóm đó', async () => {
    await openCatalog(closed, '/admin/catalog?cat=c-paper');
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
  });

  it('sessionStorage hỏng/không đọc được → vẫn hiện trang, mọi nhóm thu gọn', async () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      await openCatalog({ ...closed, groupsOpen: false });
      expect(screen.queryByText('Bút bi xanh')).toBeNull();
      await userEvent.click(screen.getByRole('button', { name: 'Mở tất cả' }));
      expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { CATEGORIES, OLD, PAPER, PEN, PENCIL, STRAY, adminItem } from './catalog-fixtures';
import { inRow, locationSearch, openCatalog, rowOf } from './catalog-fixtures-api';
import { expectFixedColumns } from '@/test/fixed-columns';

const ITEMS = [PAPER, PEN, PENCIL, OLD];
const location = locationSearch;
const tab = (name: RegExp) => screen.getByRole('button', { name });
const groupHead = (name: string) => screen.getByRole('button', { name: `Thêm món vào nhóm ${name}` }).closest('tr') as HTMLElement;
const chips = () => within(screen.getByRole('group', { name: 'Lọc theo nhóm' }));

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục — đầu trang, thẻ, lọc', () => {
  it('đúng một h1 "Sản phẩm" + mô tả; "Danh mục" tới /admin/categories; nhóm lấy cả nhóm đã ngừng (?all=1)', async () => {
    const f = await openCatalog({ items: ITEMS });
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/item-categories?all=1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sản phẩm');
    expect(screen.getByText(/^Nhân viên thấy món theo đúng thứ tự nhóm dưới đây/)).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Danh mục' })).toHaveAttribute('href', '/admin/categories');
  });

  it('không còn thẻ thống kê tồn (Sắp hết/Hết hàng); bảng dùng tab Tất cả 4 · Đang dùng 3 · Tạm ngưng 1 · Chưa có ảnh 1', async () => {
    await openCatalog({ items: ITEMS });
    expect(screen.queryByRole('button', { name: /^Sắp hết/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Hết hàng/ })).toBeNull();
    expect(tab(/^Tất cả \d/)).toHaveTextContent('4');
    expect(tab(/^Đang dùng/)).toHaveTextContent('3');
    expect(tab(/^Chưa có ảnh/)).toHaveTextContent('1');
    expect(tab(/^Tạm ngưng \d/)).toHaveTextContent('1');
  });

  it('tab "Chưa có ảnh" → ?tab=noImage, chỉ món thiếu ảnh; về "Đang dùng" thì hết lọc', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(tab(/^Chưa có ảnh/));
    expect(location()).toBe('?tab=noImage');
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(inRow('Giấy A4').getByText('Thiếu ảnh')).toBeInTheDocument();
    expectFixedColumns(screen.getByRole('table'));
    await userEvent.click(tab(/^Tất cả \d/));
    expect(location()).toBe('');
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });

  it('chip nhóm aria-pressed; chọn "Bút & viết" → ?cat=c-pen chỉ còn món nhóm đó; "Tất cả nhóm" trả lại', async () => {
    await openCatalog({ items: ITEMS });
    expect(chips().getByRole('button', { name: /^Tất cả nhóm/ })).toHaveAttribute('aria-pressed', 'true');
    const pens = chips().getByRole('button', { name: /^Bút & viết/ });
    expect(pens).toHaveTextContent('3');
    await userEvent.click(pens);
    expect(location()).toBe('?group=c-pen');
    expect(pens).toHaveAttribute('aria-pressed', 'true');
    expect(chips().getByRole('button', { name: /^Tất cả nhóm/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByText('Giấy A4')).toBeNull();
    await userEvent.click(chips().getByRole('button', { name: /^Tất cả nhóm/ }));
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
  });

  it('tab "Tạm ngưng" → ?tab=inactive, chỉ còn món tạm ngưng (nhãn đỏ "Tạm ngưng", không "Ngừng riêng"); "Đang dùng" → ?tab=active ẩn nó', async () => {
    await openCatalog({ items: ITEMS });
    expect(screen.getByText('Bút xóa cũ')).toBeInTheDocument();
    await userEvent.click(tab(/^Đang dùng/));
    expect(location()).toBe('?tab=active');
    expect(screen.queryByText('Bút xóa cũ')).toBeNull();
    await userEvent.click(tab(/^Tạm ngưng \d/));
    expect(location()).toBe('?tab=inactive');
    expect(inRow('Bút xóa cũ').getByText('Tạm ngưng')).toBeInTheDocument();
    expect(inRow('Bút xóa cũ').queryByText('Ngừng riêng')).toBeNull();
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('ô tìm "Tìm trong 4 sản phẩm" lọc qua ?q=', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm trong 4 sản phẩm' }), 'but chi');
    await vi.waitFor(() => expect(location()).toBe('?q=but+chi'));
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.getByText('Bút chì 2B')).toBeInTheDocument();
  });

  it('không món nào khớp → "Không có món nào khớp" + "Xóa lọc" trả lại bảng', async () => {
    await openCatalog({ items: ITEMS }, '/admin/catalog?q=khongco');
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('table')).getByRole('button', { name: 'Xóa lọc' }));
    expect(await screen.findByText('Giấy A4')).toBeInTheDocument();
  });
});

describe('Danh mục — bảng nhóm', () => {
  it('nhóm theo thứ tự nhóm, tiêu đề chỉ "{n} món" (không đếm sắp hết/hết hàng)', async () => {
    await openCatalog({ items: ITEMS });
    const heads = screen.getAllByRole('button', { name: /^Thêm món vào nhóm / }).map((b) => b.getAttribute('aria-label'));
    expect(heads).toEqual(['Thêm món vào nhóm Giấy & sổ', 'Thêm món vào nhóm Bút & viết']);
    expect(groupHead('Giấy & sổ')).toHaveTextContent('1 món');
    expect(groupHead('Giấy & sổ')).not.toHaveTextContent('sắp hết');
    expect(groupHead('Bút & viết')).not.toHaveTextContent('hết hàng');
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

  it('hàng: mã, quy cách, ĐVT, số tồn xám (cột đã có tiêu đề, không lặp "Tủ:"), badge "Chỉ Adm D&E"/"Thiếu ảnh"; mã trống hiện "—"', async () => {
    await openCatalog({ items: ITEMS });
    expect(screen.getByRole('columnheader', { name: 'Mã' })).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('VPP-010')).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('hộp 20 cây')).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByText('cây')).toBeInTheDocument();
    expect(inRow('Bút chì 2B').getAllByText('—')).toHaveLength(2);
    expect(inRow('Bút chì 2B').getByText('0', { selector: '.ct-stock' })).toBeInTheDocument();
    expect(inRow('Bút chì 2B').queryByText('Hết hàng')).toBeNull();
    expect(inRow('Giấy A4').getByText('2', { selector: '.ct-stock' })).toBeInTheDocument();
    expect(inRow('Giấy A4').queryByText('Sắp hết')).toBeNull();
    expect(inRow('Giấy A4').getByText('Chỉ Adm D&E')).toBeInTheDocument();
    expect(inRow('Bút bi xanh').getByRole('img', { name: 'Bút bi xanh' })).toHaveAttribute('src', '/api/files/f-2');
  });

  it('"Thu tất cả" ẩn mọi hàng món và đầu bảng, nút thành "Mở tất cả"; mở lại một nhóm thì đầu bảng hiện lại', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('button', { name: 'Thu tất cả' }));
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Mã' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Mở tất cả' })).toBeInTheDocument();
    await userEvent.click(within(groupHead('Bút & viết')).getByRole('button', { name: /Thu\/mở nhóm/ }));
    expect(screen.getByRole('columnheader', { name: 'Mã' })).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });

  it('đang thu mọi nhóm mà tìm "but chi" → nhóm chứa kết quả tự mở; xóa ô tìm thì nhóm thu lại như cũ', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('button', { name: 'Thu tất cả' }));
    await userEvent.type(screen.getByRole('searchbox'), 'but chi');
    expect(await screen.findByText('Bút chì 2B')).toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));
    await waitFor(() => expect(screen.queryByText('Bút chì 2B')).toBeNull());
  });

  it('nút thêm món vào nhóm gọn: chỉ biểu tượng, tên đầy đủ ở aria-label và title', async () => {
    await openCatalog({ items: ITEMS });
    const add = screen.getByRole('button', { name: 'Thêm món vào nhóm Bút & viết' });
    expect(add).toHaveAttribute('title', 'Thêm món vào nhóm Bút & viết');
    expect(add).not.toHaveTextContent('Thêm món vào nhóm');
  });

  it('"Thêm sản phẩm" mở ngăn kéo ?item=new; "Thêm món vào nhóm" chọn sẵn nhóm; bấm hàng mở ngăn kéo sửa ?item=id', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(within(screen.getByRole('main')).getAllByRole('button', { name: 'Thêm sản phẩm' })[0]);
    expect(location()).toBe('?item=new');
    expect(await screen.findByRole('dialog', { name: 'Thêm sản phẩm' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quay lại' }));

    await userEvent.click(screen.getByRole('button', { name: 'Thêm món vào nhóm Bút & viết' }));
    expect(location()).toBe('?item=new&itemCat=c-pen');
    const dialog = await screen.findByRole('dialog', { name: 'Thêm sản phẩm' });
    expect(within(dialog).getByRole('combobox', { name: 'Nhóm' })).toHaveTextContent('Bút & viết');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));

    await userEvent.click(screen.getByText('hộp 20 cây'));
    expect(location()).toBe('?item=i-pen');
    expect(await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
  });

  it('145 món nhập không ảnh, không nhóm: một nhóm "Chưa xếp nhóm", tab Chưa có ảnh 145', async () => {
    const many = Array.from({ length: 145 }, (_, i) =>
      adminItem({ id: `i-${i}`, name: `Món nhập ${i}`, category_id: null, image_file_id: null, missing_image: true }),
    );
    await openCatalog({ items: many, categories: CATEGORIES });
    expect(tab(/^Chưa có ảnh/)).toHaveTextContent('145');
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

  it('nhóm tạm ngưng: thu gọn sẵn, tiêu đề tên gạch + "Tạm ngưng cả nhóm" (không "Nhóm đang ngừng"); mở nhóm → món chỉ có nhãn "Tạm ngưng", không "Ngừng theo nhóm"', async () => {
    const paused = adminItem({ id: 'i-p', name: 'Bút dạ cũ', category_id: 'c-old', usable: false, inactive_reason: 'group' });
    await openCatalog({ items: [PEN, paused] });
    expect(screen.queryByText('Bút dạ cũ')).toBeNull();
    const head = screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement;
    expect(within(head).queryByText('Nhóm đang ngừng')).toBeNull();
    await userEvent.click(within(head).getByRole('button', { expanded: false }));
    expect(inRow('Bút dạ cũ').getByText('Tạm ngưng', { selector: '.ct-item__paused' })).toBeInTheDocument();
    expect(inRow('Bút dạ cũ').queryByText(/^Ngừng/)).toBeNull();
    expect(inRow('Bút bi xanh').queryByText('Tạm ngưng', { selector: '.ct-item__paused' })).toBeNull();
  });

  it('món tạm ngưng riêng trong nhóm tạm ngưng (tab Tạm ngưng, mở nhóm) chỉ có nhãn "Tạm ngưng"', async () => {
    const both = adminItem({ id: 'i-b', name: 'Bút hỏng', category_id: 'c-old', active: false, usable: false });
    await openCatalog({ items: [PEN, both] }, '/admin/catalog?tab=inactive');
    await userEvent.click(within(screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement).getByRole('button', { expanded: false }));
    expect(inRow('Bút hỏng').getByText('Tạm ngưng')).toBeInTheDocument();
    expect(inRow('Bút hỏng').queryByText('Ngừng riêng')).toBeNull();
  });
});

describe('Danh mục — bảng mở mọi nhóm mặc định', () => {
  it('mở trang: mọi nhóm mở, thấy mọi món; nút là "Thu tất cả"', async () => {
    await openCatalog({ items: ITEMS });
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thu tất cả' })).toBeInTheDocument();
  });

  it('thu một nhóm rồi tìm → nhóm thu vẫn thu (người dùng chọn), nhóm khác mở', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(within(groupHead('Giấy & sổ')).getByRole('button', { expanded: true }));
    expect(screen.queryByText('Giấy A4')).toBeNull();
    await userEvent.type(screen.getByRole('searchbox'), 'but');
    await waitFor(() => expect(location()).toBe('?q=but'));
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });
});

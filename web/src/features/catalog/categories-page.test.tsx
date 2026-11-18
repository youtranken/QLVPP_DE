import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { Category } from './catalog.api';
import { adminItem } from './catalog-fixtures';
import { expectFixedColumns } from '@/test/fixed-columns';

const CATS: Category[] = [
  { id: 'c-1', name: 'Giấy & sổ', name_en: 'Paper', sort_order: 10, active: true },
  { id: 'c-2', name: 'Bút & viết', name_en: null, sort_order: 20, active: true },
  { id: 'c-3', name: 'Cũ', name_en: null, sort_order: 30, active: false },
];
const ITEMS = ['i-1', 'i-2', 'i-3']
  .map((id) => adminItem({ id, category_id: 'c-2' }))
  .concat(adminItem({ id: 'i-4', category_id: 'c-1' }), adminItem({ id: 'i-5', category_id: 'c-2', active: false }));

type Mutate = (url: string, method: string, body: Record<string, unknown>) => Response | undefined;

function stub(mutate: Mutate = () => undefined, categories = CATS, items: () => Promise<Response> = async () => jsonResponse(200, ITEMS)) {
  let list = categories.map((c) => ({ ...c }));
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/items') return items();
    if (!init?.method) return jsonResponse(200, list);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const custom = mutate(url, init.method, body);
    if (custom) return custom;
    const id = url.split('/').pop();
    list = list.map((c) => (c.id === id ? { ...c, ...body } : c));
    return jsonResponse(200, list.find((c) => c.id === id) ?? body);
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const mutations = (f: ReturnType<typeof stub>) =>
  f.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method)
    .map(([url, init]) => [url, (init as RequestInit).method, JSON.parse(String((init as RequestInit).body))]);

async function open(mutate?: Mutate, categories?: Category[]) {
  mockViewport(1280);
  const f = stub(mutate, categories);
  renderApp(makeMe('admin'), '/admin/categories');
  await screen.findByRole('table');
  await vi.waitFor(() => expect(f.mock.calls.some(([u]) => u === '/api/admin/items')).toBe(true));
  return f;
}

const table = () => within(screen.getByRole('table'));
const rowOf = (name: string) => table().getByText(name, { selector: 'span' }).closest('tr') as HTMLElement;
const names = () => table().getAllByRole('button', { name: /^Sửa nhóm / }).map((b) => b.getAttribute('aria-label')!.replace('Sửa nhóm ', ''));
const sortOn = () => userEvent.click(screen.getByRole('button', { name: 'Sắp xếp' }));

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage('vi');
});

describe('Trang Nhóm món', () => {
  it('một h1 "Danh mục", mô tả dưới h1, không h2 "Nhóm sản phẩm" lặp; segmented "Nhóm sản phẩm" đang chọn; lấy ?all=1', async () => {
    const f = await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Danh mục');
    expect(screen.queryByRole('heading', { level: 2, name: 'Nhóm sản phẩm' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Nhóm sản phẩm' })).toHaveAttribute('aria-selected', 'true');
    expect(within(screen.getByRole('navigation', { name: 'Vị trí' })).getByText('Danh mục và tủ')).toBeInTheDocument();
    expect(screen.getByText('Nhóm sản phẩm và đơn vị tính. Thứ tự nhóm là thứ tự nhân viên thấy khi đăng ký.')).toBeInTheDocument();
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/item-categories?all=1');
  });

  it('không còn khung "Nhân viên sẽ thấy" và "Màu theo thứ tự"; mỗi dòng có chấm màu', async () => {
    await open();
    expect(screen.queryByRole('region', { name: 'Nhân viên sẽ thấy' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Màu theo thứ tự' })).toBeNull();
    expect(screen.queryByText('Màu đi theo thứ tự nhóm; từ nhóm thứ 8 thì lặp lại.')).toBeNull();
    for (const name of ['Giấy & sổ', 'Bút & viết', 'Cũ']) expect(rowOf(name).querySelector('.cg-dot')).not.toBeNull();
  });

  it('cột Sản phẩm là số "4" bấm mở panel nhóm; tên tiếng Anh rỗng → nhắc "Thiếu tên EN" (giao diện EN sẽ hiện chữ Việt)', async () => {
    await open();
    const count = within(rowOf('Bút & viết')).getByRole('button', { name: 'Món trong nhóm (4)' });
    expect(count).toHaveTextContent(/^4$/);
    expect(within(rowOf('Bút & viết')).getByText('Thiếu tên EN')).toHaveClass('tag--warn');
    expect(table().getByRole('columnheader', { name: 'Sản phẩm' })).toBeInTheDocument();
    await userEvent.click(count);
    expect(await screen.findByRole('dialog', { name: /Bút & viết/ })).toBeInTheDocument();
  });

  it('màu theo vị trí: chấm nhóm 1 "xanh đá", nhóm 2 "rêu", nhóm đã ngừng vẫn giữ vị trí "cát mật"', async () => {
    await open();
    expect(within(rowOf('Giấy & sổ')).getByTitle('xanh đá')).toBeInTheDocument();
    expect(within(rowOf('Bút & viết')).getByTitle('rêu')).toBeInTheDocument();
    expect(within(rowOf('Cũ')).getByTitle('cát mật')).toBeInTheDocument();
  });

  it('bình thường không có cột Thứ tự và ▲▼; "Sắp xếp" bật ▲▼ + ⋮⋮ mỗi nhóm', async () => {
    await open();
    expect(table().queryByRole('columnheader', { name: 'Thứ tự' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Đưa / })).toBeNull();
    await sortOn();
    expect(screen.getAllByRole('button', { name: /^Đưa .+ lên$/ })).toHaveLength(3);
    expect(table().getAllByTitle('Kéo để đổi chỗ')).toHaveLength(3);
  });

  it('"Đưa {tên} lên" đổi vị trí tại chỗ, màu đổi theo, hiện "Thứ tự đã đổi (2 nhóm)", chưa gọi API', async () => {
    const f = await open();
    await sortOn();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    expect(names()).toEqual(['Bút & viết', 'Giấy & sổ', 'Cũ']);
    expect(within(rowOf('Bút & viết')).getByTitle('xanh đá')).toBeInTheDocument();
    expect(screen.getByText('Thứ tự đã đổi (2 nhóm)')).toBeInTheDocument();
    expect(mutations(f)).toHaveLength(0);
  });

  it('biên: ▲ nhóm đầu và ▼ nhóm cuối tắt; ▼ nhóm đầu và ▲ nhóm cuối bật', async () => {
    await open();
    await sortOn();
    expect(screen.getByRole('button', { name: 'Đưa Giấy & sổ xuống' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đưa Cũ lên' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Đưa Giấy & sổ lên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa Cũ xuống' })).toBeDisabled();
  });

  it('"Hủy" → xác nhận "Bỏ thay đổi" trả thứ tự server, ẩn thanh, thoát chế độ sắp xếp', async () => {
    await open();
    await sortOn();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Bỏ thay đổi?' })).getByRole('button', { name: 'Bỏ thay đổi' }));
    expect(names()).toEqual(['Giấy & sổ', 'Bút & viết', 'Cũ']);
    expect(screen.queryByText(/Thứ tự đã đổi/)).toBeNull();
    expect(screen.queryByRole('button', { name: /^Đưa / })).toBeNull();
  });

  it('"Lưu thứ tự" PATCH {sort_order: vị trí*10} lần lượt chỉ nhóm đổi vị trí → toast "Đã lưu thứ tự 2 nhóm"', async () => {
    const f = await open();
    await sortOn();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    expect(await screen.findByText('Đã lưu thứ tự 2 nhóm')).toBeInTheDocument();
    expect(mutations(f)).toEqual([
      ['/api/admin/item-categories/c-2', 'PATCH', { sort_order: 10 }],
      ['/api/admin/item-categories/c-1', 'PATCH', { sort_order: 20 }],
    ]);
    expect(screen.queryByText(/Thứ tự đã đổi/)).toBeNull();
    expect(names()).toEqual(['Bút & viết', 'Giấy & sổ', 'Cũ']);
  });

  it('dữ liệu cũ sort_order 1,2,3: lưu gửi cả nhóm được đánh số lại nhưng toast đếm nhóm đổi vị trí (2)', async () => {
    const legacy = CATS.map((c, i) => ({ ...c, sort_order: i + 1 }));
    const f = await open(undefined, legacy);
    await sortOn();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    expect(await screen.findByText('Đã lưu thứ tự 2 nhóm')).toBeInTheDocument();
    expect(mutations(f)).toHaveLength(3);
  });

  it('lỗi giữa chừng → toast warn "Chưa lưu hết thứ tự (1/2 nhóm) — đã tải lại thứ tự hiện có." và tải lại danh sách', async () => {
    const f = await open((url) => (url.endsWith('/c-1') ? jsonResponse(500, { code: 'X', message: 'x' }) : undefined));
    const loads = () => f.mock.calls.filter((c) => c[0] === '/api/item-categories?all=1').length;
    const before = loads();
    await sortOn();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    expect(await screen.findByText('Chưa lưu hết thứ tự (1/2 nhóm) — đã tải lại thứ tự hiện có.')).toBeInTheDocument();
    await vi.waitFor(() => expect(loads()).toBeGreaterThan(before));
    expect(screen.queryByText(/Thứ tự đã đổi/)).toBeNull();
  });

  it('nhóm tạm ngưng: tên gạch (cg-name--stopped) + nhãn "Tạm ngưng" trung tính (tag, không đỏ); nút "Dùng lại" primary; không nút "Tạm ngưng"; không công tắc', async () => {
    await open();
    expect(table().queryAllByRole('switch')).toHaveLength(0);
    const old = within(rowOf('Cũ'));
    expect(rowOf('Cũ').querySelector('.cg-name__text')).toHaveClass('cg-name--stopped');
    expect(old.getByText('Tạm ngưng')).toHaveClass('tag', 'tag--outline');
    expect(old.getByText('Tạm ngưng')).not.toHaveClass('tag--danger');
    expect(old.getByRole('button', { name: 'Dùng lại nhóm Cũ' })).toHaveClass('btn--primary');
    expect(old.queryByRole('button', { name: /^Tạm ngưng nhóm/ })).toBeNull();
    expect(within(rowOf('Giấy & sổ')).queryByText('Tạm ngưng', { selector: '.tag' })).toBeNull();
  });

  it('nhóm đang dùng: "Sửa" và "Tạm ngưng" (btn--danger-line) trực tiếp trên dòng, không menu ⋯', async () => {
    await open();
    const row = within(rowOf('Bút & viết'));
    expect(row.getByRole('button', { name: 'Sửa nhóm Bút & viết' })).toHaveClass('btn');
    expect(row.getByRole('button', { name: 'Tạm ngưng nhóm Bút & viết' })).toHaveClass('btn--danger-line');
    expect(screen.queryByRole('button', { name: /^Thao tác cho / })).toBeNull();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('"Tạm ngưng" nhóm có 3 món đang dùng → hỏi xác nhận như cũ → PATCH {active:false} → toast có "Hoàn tác" → PATCH {active:true}', async () => {
    const f = await open();
    await userEvent.click(within(rowOf('Bút & viết')).getByRole('button', { name: 'Tạm ngưng nhóm Bút & viết' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ngừng nhóm “Bút & viết”?' });
    expect(within(dialog).getByText('3 món sẽ ẩn với nhân viên. Dùng lại nhóm chỉ hiện lại những món này; món đã ngừng riêng vẫn ngừng.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng nhóm' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-2', 'PATCH', { active: false }]]));
    await userEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-2', 'PATCH', { active: false }], ['/api/admin/item-categories/c-2', 'PATCH', { active: true }]]));
  });

  it('nhóm có 1 món đang dùng → "1 món sẽ ẩn với nhân viên…"; Hủy thì không gọi API', async () => {
    const f = await open();
    await userEvent.click(within(rowOf('Giấy & sổ')).getByRole('button', { name: 'Tạm ngưng nhóm Giấy & sổ' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/^1 món sẽ ẩn với nhân viên/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(mutations(f)).toHaveLength(0);
  });

  it('tiếng Anh: hộp ngừng nhóm dùng tên tiếng Anh của nhóm (Paper), không phải tên tiếng Việt', async () => {
    await open();
    await act(() => i18n.changeLanguage('en'));
    await userEvent.click(screen.getByRole('button', { name: 'Pause group Giấy & sổ' }));
    expect(await screen.findByRole('dialog', { name: 'Retire “Paper”?' })).toBeInTheDocument();
  });

  it('"Dùng lại" nhóm đã ngừng: không hỏi, PATCH {active:true}, toast số món dùng lại / vẫn ngừng riêng', async () => {
    const f = await open((url, _m, body) => (url.endsWith('/c-3') && body.active === true ? jsonResponse(200, { ...CATS[2], active: true, affected_items: { reactivated: 2, still_inactive: 0 } }) : undefined));
    await userEvent.click(within(rowOf('Cũ')).getByRole('button', { name: 'Dùng lại nhóm Cũ' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-3', 'PATCH', { active: true }]]));
    expect(await screen.findByText('2 món dùng lại; 0 món vẫn ngừng riêng')).toBeInTheDocument();
  });

  it('"Sửa" mở hộp "Sửa nhóm" điền sẵn; lưu tên tiếng Anh → PATCH {name_en}', async () => {
    const f = await open();
    await userEvent.click(within(rowOf('Bút & viết')).getByRole('button', { name: 'Sửa nhóm Bút & viết' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Sửa nhóm' }));
    expect(dialog.getByLabelText(/^Tên nhóm/)).toHaveValue('Bút & viết');
    await userEvent.type(dialog.getByLabelText('Tên tiếng Anh'), 'Pens');
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-2', 'PATCH', { name_en: 'Pens' }]]));
  });

  it('chưa có nhóm → "Chưa có nhóm nào" + nút "Thêm nhóm"', async () => {
    mockViewport(1280);
    stub(undefined, []);
    renderApp(makeMe('admin'), '/admin/categories');
    expect(await screen.findByText('Chưa có nhóm nào')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Thêm nhóm' }).length).toBeGreaterThan(0);
  });
});

describe('Trang Nhóm món — "Ngừng nhóm" chờ danh sách món', () => {
  it.each([
    ['đang tải', () => new Promise<Response>(() => {})],
    ['tải lỗi', async () => jsonResponse(500, {})],
  ])('món %s → "Tạm ngưng" nhóm vô hiệu (không hỏi "0 món"); "Sửa" vẫn bấm được', async (_label, items) => {
    mockViewport(1280);
    stub(undefined, CATS, items);
    renderApp(makeMe('admin'), '/admin/categories');
    await screen.findByRole('table');
    const row = within(rowOf('Bút & viết'));
    expect(row.getByRole('button', { name: 'Tạm ngưng nhóm Bút & viết' })).toBeDisabled();
    expect(row.getByRole('button', { name: 'Sửa nhóm Bút & viết' })).toBeEnabled();
    await userEvent.click(row.getByRole('button', { name: 'Tạm ngưng nhóm Bút & viết' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('món tải xong → "Tạm ngưng" nhóm bấm được', async () => {
    await open();
    expect(await within(rowOf('Bút & viết')).findByRole('button', { name: 'Món trong nhóm (4)' })).toBeInTheDocument();
    expect(within(rowOf('Bút & viết')).getByRole('button', { name: 'Tạm ngưng nhóm Bút & viết' })).toBeEnabled();
  });
});

describe('Trang Nhóm món — ô tìm và bảng gọn', () => {
  it('ô tìm lọc tên vi/en không cần dấu; chưa tìm không có "Đang hiện" (AD-47), đang tìm "Đang hiện 1/3 nhóm" role=status; màu nhóm giữ theo vị trí khi lọc', async () => {
    await open();
    expect(screen.queryByText(/^Đang hiện/)).toBeNull();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm nhóm (không cần dấu)' }), 'but');
    expect(await screen.findByText('Đang hiện 1/3 nhóm')).toHaveAttribute('role', 'status');
    expect(screen.getByText('Đang hiện 1/3 nhóm').closest('.cg-search > .list-meta')).not.toBeNull();
    expectFixedColumns(screen.getByRole('table'), { cssWidths: true });
    expect(within(rowOf('Bút & viết')).getByTitle('rêu')).toBeInTheDocument();
    expect(screen.queryByText('Giấy & sổ')).toBeNull();
    await userEvent.clear(screen.getByRole('searchbox', { name: 'Tìm nhóm (không cần dấu)' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm nhóm (không cần dấu)' }), 'zzz');
    expect(await screen.findByText('Không có nhóm nào khớp')).toBeInTheDocument();
  });

  it('đang lọc "i" (2/3 nhóm): panel nhóm đếm "2/2" và ↑/↓ chỉ đi qua các nhóm đang hiện', async () => {
    await open();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm nhóm (không cần dấu)' }), 'i');
    expect(await screen.findByText('Đang hiện 2/3 nhóm')).toBeInTheDocument();
    await userEvent.click(within(rowOf('Bút & viết')).getByRole('button', { name: 'Món trong nhóm (4)' }));
    const panel = await screen.findByRole('dialog', { name: 'Nhóm Bút & viết' });
    expect(within(panel).getByText('2/2')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Nhóm sau' })).toBeDisabled();
    await userEvent.click(within(panel).getByRole('button', { name: 'Nhóm trước' }));
    expect(await screen.findByRole('dialog', { name: 'Nhóm Giấy & sổ' })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog', { name: 'Nhóm Giấy & sổ' })).getByText('1/2')).toBeInTheDocument();
  });

  it('nút Sửa/Tạm ngưng nằm trong ô td.acts > .acts__in (đường kẻ hàng liền, ô co vừa nút)', async () => {
    await open();
    const edit = within(rowOf('Bút & viết')).getByRole('button', { name: 'Sửa nhóm Bút & viết' });
    expect(edit.parentElement).toHaveClass('acts__in');
    expect(edit.closest('td')).toHaveClass('acts');
  });
});


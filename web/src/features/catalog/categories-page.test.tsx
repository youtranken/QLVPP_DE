import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { Category } from './catalog.api';
import { adminItem } from './catalog-fixtures';

const CATS: Category[] = [
  { id: 'c-1', name: 'Giấy & sổ', name_en: 'Paper', sort_order: 10, active: true },
  { id: 'c-2', name: 'Bút & viết', name_en: null, sort_order: 20, active: true },
  { id: 'c-3', name: 'Cũ', name_en: null, sort_order: 30, active: false },
];
const ITEMS = ['i-1', 'i-2', 'i-3']
  .map((id) => adminItem({ id, category_id: 'c-2' }))
  .concat(adminItem({ id: 'i-4', category_id: 'c-1' }), adminItem({ id: 'i-5', category_id: 'c-2', active: false }));

type Mutate = (url: string, method: string, body: Record<string, unknown>) => Response | undefined;

function stub(mutate: Mutate = () => undefined, categories = CATS) {
  let list = categories.map((c) => ({ ...c }));
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/admin/items') return jsonResponse(200, ITEMS);
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
  return f;
}

const table = () => within(screen.getByRole('table'));
const rowOf = (name: string) => table().getByText(name, { selector: 'span' }).closest('tr') as HTMLElement;
const names = () => table().getAllByRole('button', { name: /^Thao tác cho / }).map((b) => b.getAttribute('aria-label')!.replace('Thao tác cho ', ''));
const openMenu = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: `Thao tác cho ${name}` }));
  return within(screen.getByRole('menu', { name: `Thao tác cho ${name}` }));
};

afterEach(() => vi.unstubAllGlobals());

describe('Trang Nhóm món', () => {
  it('đúng một h1 "Nhóm món", breadcrumb, mô tả; lấy ?all=1 và số món mỗi nhóm', async () => {
    const f = await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nhóm món');
    expect(within(screen.getByRole('navigation', { name: 'Vị trí' })).getByText('Danh mục')).toBeInTheDocument();
    expect(screen.getByText('Thứ tự nhóm quyết định thứ tự trên trang Đăng ký và màu của từng nhóm.')).toBeInTheDocument();
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/item-categories?all=1');
    expect(within(rowOf('Bút & viết')).getByText('4')).toBeInTheDocument();
    expect(within(rowOf('Cũ')).getByText('Ngừng')).toBeInTheDocument();
    expect(within(rowOf('Giấy & sổ')).getByText('Đang dùng')).toBeInTheDocument();
  });

  it('màu theo vị trí: chấm nhóm 1 "xanh đá", nhóm 2 "rêu", nhóm đã ngừng vẫn giữ vị trí "cát mật"', async () => {
    await open();
    expect(within(rowOf('Giấy & sổ')).getByTitle('xanh đá')).toBeInTheDocument();
    expect(within(rowOf('Bút & viết')).getByTitle('rêu')).toBeInTheDocument();
    expect(within(rowOf('Cũ')).getByTitle('cát mật')).toBeInTheDocument();
  });

  it('"Đưa {tên} lên" đổi vị trí tại chỗ, màu đổi theo, hiện "Thứ tự đã đổi (2 nhóm)", chưa gọi API', async () => {
    const f = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    expect(names()).toEqual(['Bút & viết', 'Giấy & sổ', 'Cũ']);
    expect(within(rowOf('Bút & viết')).getByTitle('xanh đá')).toBeInTheDocument();
    expect(screen.getByText('Thứ tự đã đổi (2 nhóm)')).toBeInTheDocument();
    expect(mutations(f)).toHaveLength(0);
  });

  it('nhóm đầu không đưa lên được, nhóm cuối không đưa xuống được', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Đưa Giấy & sổ lên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa Cũ xuống' })).toBeDisabled();
  });

  it('"Hoàn về" trả thứ tự server, ẩn dải', async () => {
    await open();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn về' }));
    expect(names()).toEqual(['Giấy & sổ', 'Bút & viết', 'Cũ']);
    expect(screen.queryByText(/Thứ tự đã đổi/)).toBeNull();
  });

  it('"Lưu thứ tự" PATCH {sort_order: vị trí*10} lần lượt chỉ nhóm đổi vị trí → toast "Đã lưu thứ tự 2 nhóm"', async () => {
    const f = await open();
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
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    expect(await screen.findByText('Đã lưu thứ tự 2 nhóm')).toBeInTheDocument();
    expect(mutations(f)).toHaveLength(3);
  });

  it('lỗi giữa chừng → toast warn "Chưa lưu hết thứ tự (1/2 nhóm) — đã tải lại thứ tự hiện có." và tải lại danh sách', async () => {
    const f = await open((url) => (url.endsWith('/c-1') ? jsonResponse(500, { code: 'X', message: 'x' }) : undefined));
    const loads = () => f.mock.calls.filter((c) => c[0] === '/api/item-categories?all=1').length;
    const before = loads();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa Bút & viết lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    expect(await screen.findByText('Chưa lưu hết thứ tự (1/2 nhóm) — đã tải lại thứ tự hiện có.')).toBeInTheDocument();
    await vi.waitFor(() => expect(loads()).toBeGreaterThan(before));
    expect(screen.queryByText(/Thứ tự đã đổi/)).toBeNull();
  });

  it('trạng thái chỉ một chỗ: nhãn "Đang dùng"/"Ngừng", không còn công tắc trong bảng', async () => {
    await open();
    expect(table().queryAllByRole('switch')).toHaveLength(0);
    expect(within(rowOf('Cũ')).getByText('Ngừng')).toBeInTheDocument();
  });

  it('menu ⋯ của nhóm đang dùng có "Sửa", "Ngừng nhóm"; nhóm đã ngừng có "Sửa", "Dùng lại"', async () => {
    await open();
    expect((await openMenu('Bút & viết')).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Sửa', 'Ngừng nhóm']);
    await userEvent.keyboard('{Escape}');
    expect((await openMenu('Cũ')).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Sửa', 'Dùng lại']);
  });

  it('"Ngừng nhóm" hỏi xác nhận nói rõ 3 món đang dùng sẽ ẩn (món đã ngừng không tính) rồi PATCH {active:false}', async () => {
    const f = await open();
    await userEvent.click((await openMenu('Bút & viết')).getByRole('menuitem', { name: 'Ngừng nhóm' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ngừng nhóm “Bút & viết”?' });
    expect(within(dialog).getByText('3 món trong nhóm sẽ ẩn khỏi trang Đăng ký. Mở lại nhóm thì món hiện lại.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng nhóm' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-2', 'PATCH', { active: false }]]));
  });

  it('nhóm có 1 món đang dùng → "1 món trong nhóm sẽ ẩn…"; Hủy thì không gọi API', async () => {
    const f = await open();
    await userEvent.click((await openMenu('Giấy & sổ')).getByRole('menuitem', { name: 'Ngừng nhóm' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/^1 món trong nhóm sẽ ẩn/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(mutations(f)).toHaveLength(0);
  });

  it('"Dùng lại" nhóm đã ngừng: xác nhận rồi PATCH {active:true}', async () => {
    const f = await open();
    await userEvent.click((await openMenu('Cũ')).getByRole('menuitem', { name: 'Dùng lại' }));
    const dialog = await screen.findByRole('dialog', { name: 'Dùng lại nhóm “Cũ”?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Dùng lại' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-3', 'PATCH', { active: true }]]));
  });

  it('"Sửa" mở hộp "Sửa nhóm" điền sẵn; lưu tên tiếng Anh → PATCH {name_en}', async () => {
    const f = await open();
    await userEvent.click((await openMenu('Bút & viết')).getByRole('menuitem', { name: 'Sửa' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Sửa nhóm' }));
    expect(dialog.getByLabelText(/^Tên nhóm/)).toHaveValue('Bút & viết');
    await userEvent.type(dialog.getByLabelText('Tên tiếng Anh'), 'Pens');
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-2', 'PATCH', { name_en: 'Pens' }]]));
  });

  it('cột xem trước: "Nhân viên sẽ thấy" chỉ nhóm đang dùng theo thứ tự; 7 ô "Màu theo thứ tự"', async () => {
    await open();
    const preview = within(screen.getByRole('region', { name: 'Nhân viên sẽ thấy' }));
    expect(preview.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Giấy & sổ', 'Bút & viết']);
    expect(within(screen.getByRole('list', { name: 'Màu theo thứ tự' })).getAllByRole('listitem')).toHaveLength(7);
  });

  it('chưa có nhóm → "Chưa có nhóm nào" + nút "Thêm nhóm"', async () => {
    mockViewport(1280);
    stub(undefined, []);
    renderApp(makeMe('admin'), '/admin/categories');
    expect(await screen.findByText('Chưa có nhóm nào')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Thêm nhóm' }).length).toBeGreaterThan(0);
  });
});

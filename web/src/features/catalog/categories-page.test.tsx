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
const ITEMS = ['i-1', 'i-2', 'i-3'].map((id) => adminItem({ id, category_id: 'c-2' })).concat(adminItem({ id: 'i-4', category_id: 'c-1' }));

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
const rowOf = (name: string) => table().getByText(name, { selector: 'button, span' }).closest('tr') as HTMLElement;
const names = () => within(screen.getByRole('table')).getAllByRole('button', { name: /^Sửa tên nhóm / }).map((b) => b.textContent);

afterEach(() => vi.unstubAllGlobals());

describe('Trang Nhóm món', () => {
  it('đúng một h1 "Nhóm món", breadcrumb, mô tả; lấy ?all=1 và số món mỗi nhóm', async () => {
    const f = await open();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nhóm món');
    expect(within(screen.getByRole('navigation', { name: 'Vị trí' })).getByText('Danh mục')).toBeInTheDocument();
    expect(screen.getByText('Thứ tự nhóm quyết định thứ tự trên trang Đăng ký và màu của từng nhóm.')).toBeInTheDocument();
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/item-categories?all=1');
    expect(within(rowOf('Bút & viết')).getByText('3')).toBeInTheDocument();
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

  it('sửa tên tại chỗ: Enter PATCH {name}; CATEGORY_EXISTS → "Đã có nhóm tên này." tại ô; Esc bỏ không gọi API', async () => {
    const f = await open((_url, _m, body) => (body.name === 'giấy & sổ' ? jsonResponse(409, { code: 'CATEGORY_EXISTS', message: 'x' }) : undefined));
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên nhóm Bút & viết' }));
    const input = screen.getByRole('textbox', { name: 'Sửa tên nhóm Bút & viết' });
    expect(input).toHaveAttribute('maxLength', '120');
    await userEvent.clear(input);
    await userEvent.type(input, 'giấy & sổ{Enter}');
    await vi.waitFor(() => expect(input).toHaveAccessibleDescription('Đã có nhóm tên này.'));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên nhóm Bút & viết' }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.type(screen.getByRole('textbox'), 'Bút{Enter}');
    await vi.waitFor(() => expect(mutations(f).at(-1)).toEqual(['/api/admin/item-categories/c-2', 'PATCH', { name: 'Bút' }]));
  });

  it('sửa tên tiếng Anh tại chỗ: xóa hết → PATCH {name_en: null}', async () => {
    const f = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Sửa tên tiếng Anh của Giấy & sổ' }));
    await userEvent.clear(screen.getByRole('textbox'));
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-1', 'PATCH', { name_en: null }]]));
  });

  it('công tắc "Ngừng {tên}" hỏi xác nhận rồi PATCH {active:false}; nhóm đã ngừng có "Mở lại {tên}"', async () => {
    const f = await open();
    expect(screen.getByRole('switch', { name: 'Mở lại Cũ' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('switch', { name: 'Ngừng Bút & viết' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ngừng nhóm “Bút & viết”?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng nhóm' }));
    await vi.waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-2', 'PATCH', { active: false }]]));
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

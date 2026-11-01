import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminUnit } from './units.api';

const U = (code: string, name: string, over: Partial<AdminUnit> = {}): AdminUnit => ({
  code,
  name,
  name_en: null,
  sort_order: 10,
  active: true,
  in_use: false,
  item_count: 0,
  ...over,
});
const UNITS = [
  U('cai', 'cái', { name_en: 'piece', sort_order: 10, in_use: true, item_count: 4 }),
  U('hop', 'hộp', { sort_order: 20 }),
  U('cu', 'Cũ', { sort_order: 30, active: false }),
];

type Mutate = (url: string, method: string, body: Record<string, unknown>) => Response | undefined;

function stub(mutate: Mutate = () => undefined, units = UNITS) {
  let list = units.map((u) => ({ ...u }));
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.method) {
      if (url === '/api/admin/items' || url.startsWith('/api/item-categories')) return jsonResponse(200, []);
      return jsonResponse(200, url === '/api/units' ? list.map(({ in_use: _a, item_count: _b, ...unit }) => unit) : list);
    }
    const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const custom = mutate(url, init.method, body);
    if (custom) return custom;
    const code = url.split('/').pop();
    if (init.method === 'DELETE') {
      list = list.filter((u) => u.code !== code);
      return new Response(null, { status: 204 });
    }
    if (init.method === 'POST') {
      const created = U('moi', String(body.name), { sort_order: Number(body.sort_order ?? 0) });
      list = [...list, created];
      return jsonResponse(201, created);
    }
    list = list.map((u) => (u.code === code ? { ...u, ...body } : u));
    return jsonResponse(200, list.find((u) => u.code === code));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const mutations = (f: ReturnType<typeof stub>) =>
  f.mock.calls
    .filter((c) => (c[1] as RequestInit | undefined)?.method)
    .map(([url, init]) => [url, (init as RequestInit).method, (init as RequestInit).body ? JSON.parse(String((init as RequestInit).body)) : undefined]);

async function open(mutate?: Mutate, units?: AdminUnit[]) {
  mockViewport(1280);
  const f = stub(mutate, units);
  renderApp(makeMe('admin'), '/admin/units');
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
const pick = async (name: string, item: string) => userEvent.click((await openMenu(name)).getByRole('menuitem', { name: item }));

afterEach(() => vi.unstubAllGlobals());

describe('Trang Đơn vị tính', () => {
  it('h1 "Đơn vị tính", lấy GET units?all=1, hiện số món đang dùng và trạng thái từng ĐVT', async () => {
    const f = await open();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Đơn vị tính');
    expect(f.mock.calls.map((c) => c[0])).toContain('/api/units?all=1');
    expect(within(rowOf('cái')).getByText('4')).toBeInTheDocument();
    expect(within(rowOf('cái')).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(rowOf('Cũ')).getByText('Ngừng')).toBeInTheDocument();
  });

  it('trạng thái chỉ một chỗ: nhãn "Đang dùng"/"Ngừng", không còn công tắc hay nút chữ "Xóa …" trong bảng', async () => {
    await open();
    expect(table().queryAllByRole('switch')).toHaveLength(0);
    expect(table().queryByRole('button', { name: /^Xóa/ })).toBeNull();
  });

  it('menu ⋯: ĐVT đang dùng có món → "Sửa", "Ngừng" (không có Xóa); chưa dùng → thêm "Xóa"; đã ngừng → "Dùng lại"', async () => {
    await open();
    const items = async (name: string) => (await openMenu(name)).getAllByRole('menuitem').map((m) => m.textContent);
    expect(await items('cái')).toEqual(['Sửa', 'Ngừng']);
    await userEvent.keyboard('{Escape}');
    expect(await items('hộp')).toEqual(['Sửa', 'Ngừng', 'Xóa']);
    await userEvent.keyboard('{Escape}');
    expect(await items('Cũ')).toEqual(['Sửa', 'Dùng lại', 'Xóa']);
  });

  it('menu "Xóa" chỉ có ở ĐVT chưa dùng; xác nhận rồi DELETE admin/units/:code và hàng biến mất', async () => {
    const f = await open();
    await pick('hộp', 'Xóa');
    expect(mutations(f)).toHaveLength(0);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa đơn vị' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/units/hop', 'DELETE', undefined]]));
    await waitFor(() => expect(names()).toEqual(['cái', 'Cũ']));
  });

  it('xóa mà server báo UNIT_IN_USE → toast danger "Đơn vị đang được dùng — chỉ ngừng được."', async () => {
    await open((_url, method) => (method === 'DELETE' ? jsonResponse(409, { code: 'UNIT_IN_USE', message: 'x' }) : undefined));
    await pick('hộp', 'Xóa');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa đơn vị' }));
    expect(await screen.findByText('Đơn vị đang được dùng — chỉ ngừng được.')).toBeInTheDocument();
    expect(document.querySelector('.toast--danger')).not.toBeNull();
  });

  it('menu "Ngừng" hỏi xác nhận rồi PATCH {active:false}; "Dùng lại" Cũ xác nhận rồi {active:true}; Hủy thì không gọi API', async () => {
    const f = await open();
    await pick('cái', 'Ngừng');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' }));
    expect(mutations(f)).toHaveLength(0);
    await pick('cái', 'Ngừng');
    expect(screen.getByRole('dialog', { name: 'Ngừng đơn vị “cái”?' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ngừng' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/units/cai', 'PATCH', { active: false }]]));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await pick('Cũ', 'Dùng lại');
    expect(screen.getByRole('dialog', { name: 'Dùng lại đơn vị “Cũ”?' })).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dùng lại' }));
    await waitFor(() => expect(mutations(f).at(-1)).toEqual(['/api/admin/units/cu', 'PATCH', { active: true }]));
  });

  it('lỗi khác UNIT_IN_USE khi ngừng/xóa → khối role=alert (không toast danger); UNIT_NOT_FOUND còn tải lại danh sách', async () => {
    const f = await open((_u, method) => (method === 'PATCH' ? jsonResponse(404, { code: 'UNIT_NOT_FOUND', message: 'x' }) : undefined));
    await pick('cái', 'Ngừng');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ngừng' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Đơn vị này không còn — tải lại trang.');
    expect(document.querySelector('.toast--danger')).toBeNull();
    await waitFor(() => expect(f.mock.calls.filter((c) => c[0] === '/api/units?all=1').length).toBeGreaterThan(1));
  });

  it('xóa mà server 500 → khối role=alert "Chưa lưu được"', async () => {
    await open((_u, method) => (method === 'DELETE' ? jsonResponse(500, { code: 'X', message: 'x' }) : undefined));
    await pick('hộp', 'Xóa');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Xóa đơn vị' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa lưu được — thử lại sau ít phút.');
  });

  it('ngừng ĐVT xong, mở Danh mục > Thêm món trong cùng phiên: ô Đơn vị tính không còn ĐVT đó', async () => {
    await open();
    await pick('hộp', 'Ngừng');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ngừng' }));
    await waitFor(() => expect(within(rowOf('hộp')).getByText('Ngừng')).toBeInTheDocument());
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Menu quản lý' })).getByRole('link', { name: 'Danh mục' }));
    await userEvent.click((await screen.findAllByRole('button', { name: 'Thêm món' }))[0]);
    const select = await screen.findByLabelText(/Đơn vị tính/);
    await waitFor(() => expect(within(select).getByRole('option', { name: 'cái' })).toBeInTheDocument());
    expect(within(select).queryByRole('option', { name: 'hộp' })).toBeNull();
  });

  it('menu "Sửa" mở hộp "Sửa đơn vị tính" điền sẵn; UNIT_EXISTS → lỗi tại ô Tên; lưu chỉ gửi trường đổi', async () => {
    const f = await open((_url, method, body) => (method === 'PATCH' && body.name === 'HỘP' ? jsonResponse(409, { code: 'UNIT_EXISTS', message: 'x' }) : undefined));
    await pick('hộp', 'Sửa');
    const dialog = within(await screen.findByRole('dialog', { name: 'Sửa đơn vị tính' }));
    const name = dialog.getByLabelText(/Tên đơn vị/);
    expect(name).toHaveValue('hộp');
    expect(name).toHaveAttribute('maxlength', '40');
    await userEvent.clear(name);
    await userEvent.type(name, 'HỘP');
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await dialog.findByText('Đã có đơn vị tính tên này.')).toBeInTheDocument();
    expect(name).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(name);
    await userEvent.type(name, 'thùng');
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mutations(f).at(-1)).toEqual(['/api/admin/units/hop', 'PATCH', { name: 'thùng' }]));
    expect(await screen.findByText('Đã lưu đơn vị tính thùng')).toBeInTheDocument();
  });

  it('sửa: xóa trắng tên tiếng Anh gửi {name_en: null}', async () => {
    const f = await open();
    await pick('cái', 'Sửa');
    const dialog = within(await screen.findByRole('dialog', { name: 'Sửa đơn vị tính' }));
    await userEvent.clear(dialog.getByLabelText('Tên tiếng Anh'));
    await userEvent.click(dialog.getByRole('button', { name: 'Lưu thay đổi' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/units/cai', 'PATCH', { name_en: null }]]));
  });

  it('"Đưa {tên} lên" đổi vị trí tại chỗ, chưa gọi API; "Lưu thứ tự" PATCH {sort_order: vị trí*10} chỉ ĐVT lệch', async () => {
    const f = await open();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa hộp lên' }));
    expect(names()).toEqual(['hộp', 'cái', 'Cũ']);
    expect(screen.getByText('Thứ tự đã đổi (2 đơn vị)')).toBeInTheDocument();
    expect(mutations(f)).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thứ tự' }));
    expect(await screen.findByText('Đã lưu thứ tự 2 đơn vị')).toBeInTheDocument();
    expect(mutations(f)).toEqual([
      ['/api/admin/units/hop', 'PATCH', { sort_order: 10 }],
      ['/api/admin/units/cai', 'PATCH', { sort_order: 20 }],
    ]);
  });

  it('ĐVT đầu không đưa lên được, cuối không đưa xuống được; "Hoàn về" trả thứ tự cũ', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Đưa cái lên' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Đưa Cũ xuống' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Đưa hộp lên' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn về' }));
    expect(names()).toEqual(['cái', 'hộp', 'Cũ']);
  });

  it('thêm ĐVT: Tên tối đa 40; POST {name, name_en, sort_order: max+10}; trùng → lỗi ô "Đã có đơn vị tính tên này."', async () => {
    const f = await open((_url, method, body) => (method === 'POST' && body.name === 'CÁI' ? jsonResponse(409, { code: 'UNIT_EXISTS', message: 'x' }) : undefined));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm đơn vị tính' }));
    const dialog = screen.getByRole('dialog', { name: 'Thêm đơn vị tính' });
    expect(within(dialog).getByLabelText(/Tên đơn vị/)).toHaveAttribute('maxlength', '40');
    expect(within(dialog).getByLabelText('Tên tiếng Anh')).toHaveAttribute('maxlength', '40');
    await userEvent.type(within(dialog).getByLabelText(/Tên đơn vị/), 'CÁI');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm đơn vị tính' }));
    expect(await within(dialog).findByText('Đã có đơn vị tính tên này.')).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Tên đơn vị/)).toHaveAttribute('aria-invalid', 'true');
    await userEvent.clear(within(dialog).getByLabelText(/Tên đơn vị/));
    await userEvent.type(within(dialog).getByLabelText(/Tên đơn vị/), 'bộ');
    await userEvent.type(within(dialog).getByLabelText('Tên tiếng Anh'), 'set');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm đơn vị tính' }));
    await waitFor(() => expect(mutations(f).at(-1)).toEqual(['/api/admin/units', 'POST', { name: 'bộ', name_en: 'set', sort_order: 40 }]));
    expect(await screen.findByText('Đã thêm đơn vị tính bộ')).toBeInTheDocument();
  });

  it('thêm ĐVT: VALIDATION fields [name_en] → lỗi gắn ô Tên tiếng Anh, ô tên không bị đánh dấu', async () => {
    await open((_u, method) => (method === 'POST' ? jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['name_en'] }) : undefined));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm đơn vị tính' }));
    const dialog = screen.getByRole('dialog', { name: 'Thêm đơn vị tính' });
    await userEvent.type(within(dialog).getByLabelText(/Tên đơn vị/), 'bộ');
    await userEvent.type(within(dialog).getByLabelText('Tên tiếng Anh'), 'set');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm đơn vị tính' }));
    await waitFor(() => expect(within(dialog).getByLabelText('Tên tiếng Anh')).toHaveAttribute('aria-invalid', 'true'));
    expect(within(dialog).getByLabelText(/Tên đơn vị/)).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('chưa có ĐVT nào → "Chưa có đơn vị tính nào" kèm nút thêm', async () => {
    mockViewport(1280);
    stub(undefined, []);
    renderApp(makeMe('admin'), '/admin/units');
    expect(await screen.findByText('Chưa có đơn vị tính nào')).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminItem, Category } from './catalog.api';
import { adminItem } from './catalog-fixtures';

const CATS: Category[] = [
  { id: 'c-1', name: 'Kẹp & dán', name_en: 'Clips', sort_order: 10, active: true },
  { id: 'c-2', name: 'Rỗng', name_en: null, sort_order: 20, active: true },
];
const KEP = (over: Partial<AdminItem> = {}) => adminItem({ category_id: 'c-1', unit: 'cai', ...over });
// Thứ tự đầu vào xáo trộn: panel phải xếp theo sort_order rồi tên
const FIVE = [
  KEP({ id: 'i-d', name: 'Kẹp D', sort_order: 40 }),
  KEP({ id: 'i-a', name: 'Kẹp A', sort_order: 10, active: false, usable: false, inactive_reason: 'item' }),
  KEP({ id: 'i-c', name: 'Kẹp C', sort_order: 30 }),
  KEP({ id: 'i-b', name: 'Kẹp B', sort_order: 20 }),
  KEP({ id: 'i-e', name: 'Kẹp E', sort_order: 50 }),
];

type Handler = (url: string, method: string, body: Record<string, unknown>) => Response | undefined | Promise<Response | undefined>;

function stub({ cats = CATS, items = FIVE, mutate = (() => undefined) as Handler, pending = {} as Record<string, unknown> } = {}) {
  let catList = cats.map((c) => ({ ...c }));
  let itemList = items.map((i) => ({ ...i }));
  const f = vi.fn(async (url: string, init?: RequestInit) => {
    const pend = /^\/api\/admin\/items\/([^/]+)\/pending-arrival$/.exec(url);
    if (pend) return pending[pend[1]] === 'error' ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, pending[pend[1]] ?? { remaining: 0 });
    if (!init?.method) return jsonResponse(200, url === '/api/admin/items' ? itemList : catList);
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const custom = await mutate(url, init.method, body);
    if (custom) return custom;
    const id = url.split('/').pop();
    if (url.startsWith('/api/admin/items/')) {
      itemList = itemList.map((i) => (i.id === id ? { ...i, ...body } : i));
      return jsonResponse(200, itemList.find((i) => i.id === id));
    }
    catList = catList.map((c) => (c.id === id ? { ...c, ...body } : c));
    return jsonResponse(200, catList.find((c) => c.id === id));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const mutations = (f: ReturnType<typeof stub>) =>
  f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method).map(([url, init]) => [url, (init as RequestInit).method, JSON.parse(String((init as RequestInit).body))]);

async function openAt(path: string, opts?: Parameters<typeof stub>[0]) {
  mockViewport(1280);
  const f = stub(opts);
  renderApp(makeMe('admin'), path);
  await screen.findByRole('table', { hidden: true });
  return f;
}
const panel = () => within(screen.getByRole('dialog', { name: /^Nhóm / }));
const itemSwitch = (name: string) => panel().getByRole('switch', { name });
const rowNames = () => panel().getAllByRole('listitem').map((li) => within(li).getByRole('switch').getAttribute('aria-label'));

afterEach(() => vi.unstubAllGlobals());

describe('Panel nhóm (?group=)', () => {
  it('bấm tên nhóm → ?group=c-1, panel "Nhóm Kẹp & dán" liệt kê đủ 5 món kể cả món ngừng, theo thứ tự chung', async () => {
    await openAt('/admin/categories');
    await userEvent.click(screen.getByRole('button', { name: 'Kẹp & dán' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?group=c-1');
    expect(await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' })).toBeInTheDocument();
    expect(rowNames()).toEqual(['Kẹp A', 'Kẹp B', 'Kẹp C', 'Kẹp D', 'Kẹp E']);
    expect(itemSwitch('Kẹp A')).toHaveAttribute('aria-checked', 'false');
    expect(itemSwitch('Kẹp B')).toHaveAttribute('aria-checked', 'true');
    expect(within(itemSwitch('Kẹp B')).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(itemSwitch('Kẹp A')).getByText('Ngừng')).toBeInTheDocument();
  });

  it('nút "Món trong nhóm (5)" cũng mở panel', async () => {
    await openAt('/admin/categories');
    await userEvent.click(screen.getByRole('button', { name: 'Món trong nhóm (5)' }));
    expect(await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' })).toBeInTheDocument();
  });

  it('biên ô tìm: nhóm 12 món không có ô tìm; 13 món có, tìm không dấu "kep 13" còn 1 món', async () => {
    const many = (n: number) => Array.from({ length: n }, (_, i) => KEP({ id: `m-${i + 1}`, name: `Kẹp ${i + 1}`, sort_order: i + 1 }));
    await openAt('/admin/categories?group=c-1', { items: many(12) });
    expect(await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' })).toBeInTheDocument();
    expect(panel().queryByRole('searchbox')).toBeNull();
    cleanup();
    vi.unstubAllGlobals();
    await openAt('/admin/categories?group=c-1', { items: many(13) });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.type(panel().getByRole('searchbox'), 'kep 13');
    await waitFor(() => expect(panel().getAllByRole('listitem')).toHaveLength(1));
  });

  it('tắt món → đúng 1 PATCH {active:false} dù bấm nhanh 2 lần; toast "Đã tạm ngưng Kẹp B" + "Hoàn tác" → PATCH {active:true}', async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const f = await openAt('/admin/categories?group=c-1', { mutate: async (url, _m, body) => { if (url.endsWith('/i-b') && body.active === false) await gate; return undefined; } });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(itemSwitch('Kẹp B'));
    expect(itemSwitch('Kẹp B')).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(itemSwitch('Kẹp B'));
    release();
    expect(await panel().findByText('Đã tạm ngưng Kẹp B')).toBeInTheDocument();
    expect(mutations(f)).toEqual([['/api/admin/items/i-b', 'PATCH', { active: false }]]);
    expect(screen.queryByRole('dialog', { name: /Ngừng/ })).toBeNull();
    await userEvent.click(panel().getByRole('button', { name: 'Hoàn tác' }));
    expect(screen.getByRole('dialog', { name: 'Nhóm Kẹp & dán' })).toBeInTheDocument();
    await waitFor(() => expect(mutations(f).at(-1)).toEqual(['/api/admin/items/i-b', 'PATCH', { active: true }]));
  });

  it('tắt món đang chờ ADM giao 3 → hỏi "Ngừng Kẹp B?" kèm khối cam; Quay lại → không PATCH, vẫn "Đang dùng"; Ngừng → PATCH', async () => {
    const f = await openAt('/admin/categories?group=c-1', { pending: { 'i-b': { remaining: 3, unit: 'cai', snapshot_at: '2026-11-03T02:15:00.000Z' } } });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(itemSwitch('Kẹp B'));
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Kẹp B?' });
    expect(within(ask).getByRole('note')).toHaveTextContent(/Món này đang chờ ADM giao 3 cái \(bản in .+\) — ngừng thì vẫn nhập được hàng đã đặt\./);
    await userEvent.click(within(ask).getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tạm ngưng Kẹp B?' })).toBeNull());
    expect(mutations(f)).toEqual([]);
    expect(itemSwitch('Kẹp B')).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(itemSwitch('Kẹp B'));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Tạm ngưng Kẹp B?' })).getByRole('button', { name: 'Tạm ngưng' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/items/i-b', 'PATCH', { active: false }]]));
  });

  it('tắt món chờ 0 → không hỏi, PATCH ngay', async () => {
    const f = await openAt('/admin/categories?group=c-1');
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(itemSwitch('Kẹp C'));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/items/i-c', 'PATCH', { active: false }]]));
    expect(screen.queryByRole('dialog', { name: 'Tạm ngưng Kẹp C?' })).toBeNull();
  });

  it('lỗi tải pending-arrival → không biết còn hàng đang về hay không nên vẫn hỏi (hộp thường, không khối cam); Ngừng → PATCH', async () => {
    const f = await openAt('/admin/categories?group=c-1', { pending: { 'i-c': 'error' } });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(itemSwitch('Kẹp C'));
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Kẹp C?' });
    expect(within(ask).queryByRole('note')).toBeNull();
    expect(mutations(f)).toEqual([]);
    await userEvent.click(within(ask).getByRole('button', { name: 'Tạm ngưng' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/items/i-c', 'PATCH', { active: false }]]));
  });

  it('PATCH lỗi 500 → công tắc trả lại "Đang dùng" và báo lỗi tại dòng', async () => {
    await openAt('/admin/categories?group=c-1', { mutate: () => jsonResponse(500, { code: 'X' }) });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(itemSwitch('Kẹp C'));
    const row = itemSwitch('Kẹp C').closest('li') as HTMLElement;
    expect(await within(row).findByRole('alert')).toBeInTheDocument();
    expect(itemSwitch('Kẹp C')).toHaveAttribute('aria-checked', 'true');
  });

  it('nhóm ngừng: 4 công tắc "Ngừng theo nhóm" vô hiệu, Kẹp A "Ngừng riêng"; gợi ý bật lại nhóm; bấm không gửi request', async () => {
    const off = FIVE.map((i) => ({ ...i, usable: false, inactive_reason: i.active ? ('group' as const) : ('item' as const) }));
    const f = await openAt('/admin/categories?group=c-1', { cats: [{ ...CATS[0], active: false }, CATS[1]], items: off });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    for (const name of ['Kẹp B', 'Kẹp C', 'Kẹp D', 'Kẹp E']) {
      expect(itemSwitch(name)).toBeDisabled();
      expect(itemSwitch(name)).toHaveAttribute('aria-checked', 'false');
    }
    expect(itemSwitch('Kẹp A')).toBeDisabled();
    expect(panel().getAllByText('Ngừng theo nhóm')).toHaveLength(4);
    expect(within(itemSwitch('Kẹp A').closest('li') as HTMLElement).getByText('Ngừng riêng')).toBeInTheDocument();
    expect(panel().getByText('Bật lại nhóm để đổi từng món')).toBeInTheDocument();
    await userEvent.click(itemSwitch('Kẹp B'));
    expect(mutations(f)).toHaveLength(0);
  });

  it('nhóm đang dùng: công tắc món bật được (Kẹp A ngừng riêng → PATCH {active:true})', async () => {
    const f = await openAt('/admin/categories?group=c-1');
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    expect(itemSwitch('Kẹp A')).toBeEnabled();
    await userEvent.click(itemSwitch('Kẹp A'));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/items/i-a', 'PATCH', { active: true }]]));
  });

  it('công tắc nhóm "Ngừng": hỏi xác nhận với 4 món đang dùng → PATCH {active:false}', async () => {
    const f = await openAt('/admin/categories?group=c-1');
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(panel().getByRole('switch', { name: 'Nhóm Kẹp & dán' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ngừng nhóm “Kẹp & dán”?' });
    expect(within(dialog).getByText(/^4 món sẽ ẩn với nhân viên/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng nhóm' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-1', 'PATCH', { active: false }]]));
  });

  it('bật lại nhóm: không hỏi, PATCH {active:true}, toast "4 món dùng lại; 1 món vẫn ngừng riêng" nằm trong panel', async () => {
    const f = await openAt('/admin/categories?group=c-1', {
      cats: [{ ...CATS[0], active: false }, CATS[1]],
      mutate: (url, _m, body) => (url.endsWith('/c-1') && body.active === true ? jsonResponse(200, { ...CATS[0], active: true, affected_items: { reactivated: 4, still_inactive: 1 } }) : undefined),
    });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(panel().getByRole('switch', { name: 'Nhóm Kẹp & dán' }));
    expect(await panel().findByText('4 món dùng lại; 1 món vẫn ngừng riêng')).toBeInTheDocument();
    expect(mutations(f)).toEqual([['/api/admin/item-categories/c-1', 'PATCH', { active: true }]]);
    expect(screen.queryByRole('dialog', { name: /^Dùng lại nhóm/ })).toBeNull();
  });

  it('W24: ngừng nhóm có món đang chờ ADM giao 3 → khối cam trong hộp, không chặn nút "Ngừng nhóm"; không chờ → không khối', async () => {
    const f = await openAt('/admin/categories?group=c-1', { pending: { 'i-c': { remaining: 3, unit: 'cai', snapshot_at: '2026-11-03T02:15:00.000Z' } } });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(panel().getByRole('switch', { name: 'Nhóm Kẹp & dán' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Ngừng nhóm “Kẹp & dán”?' }));
    const note = dialog.getByRole('note');
    expect(note).toHaveTextContent('Kẹp C');
    expect(note).toHaveTextContent(/Món này đang chờ ADM giao 3 cái \(bản in .+\) — ngừng thì vẫn nhập được hàng đã đặt\./);
    expect(f.mock.calls.map((c) => c[0])).not.toContain('/api/admin/items/i-a/pending-arrival');
    await userEvent.click(dialog.getByRole('button', { name: 'Ngừng nhóm' }));
    await waitFor(() => expect(mutations(f)).toEqual([['/api/admin/item-categories/c-1', 'PATCH', { active: false }]]));
  });

  it('W24 không có khi không món nào chờ; lỗi tải pending-arrival cũng không chặn hộp', async () => {
    await openAt('/admin/categories?group=c-1', { pending: { 'i-b': 'error' } });
    await screen.findByRole('dialog', { name: 'Nhóm Kẹp & dán' });
    await userEvent.click(panel().getByRole('switch', { name: 'Nhóm Kẹp & dán' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Ngừng nhóm “Kẹp & dán”?' }));
    expect(dialog.queryByRole('note')).toBeNull();
  });

  it('nhóm rỗng → "Nhóm chưa có món" + liên kết Sản phẩm', async () => {
    await openAt('/admin/categories?group=c-2');
    await screen.findByRole('dialog', { name: 'Nhóm Rỗng' });
    expect(panel().getByText('Nhóm chưa có món')).toBeInTheDocument();
    expect(panel().getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/admin/catalog');
  });

  it('?group= không tồn tại → gỡ khỏi URL, không mở panel', async () => {
    await openAt('/admin/categories?group=zzz&x=1');
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?x=1'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
